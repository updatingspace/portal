from __future__ import annotations

import mimetypes
import re
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core import signing


_FILENAME_SAFE_RE = re.compile(r"[^a-zA-Z0-9._-]+")
_LOCAL_UPLOAD_TOKEN_SALT = "activity.news-media.upload"
_LOCAL_DOWNLOAD_TOKEN_SALT = "activity.news-media.download"


@dataclass(frozen=True)
class UploadUrl:
    key: str
    upload_url: str
    upload_headers: dict[str, str]
    expires_in: int


@dataclass(frozen=True)
class LocalMediaToken:
    key: str
    content_type: str | None
    expires_at: int


def _s3_client():
    import boto3
    from botocore.client import Config

    endpoint = getattr(settings, "S3_ENDPOINT_URL", "") or None
    region = getattr(settings, "S3_REGION", "") or None
    access_key = getattr(settings, "S3_ACCESS_KEY_ID", "") or None
    secret_key = getattr(settings, "S3_SECRET_ACCESS_KEY", "") or None
    force_path_style = bool(getattr(settings, "S3_FORCE_PATH_STYLE", False))

    config = Config(
        signature_version="s3v4",
        s3={"addressing_style": "path" if force_path_style else "auto"},
    )

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=config,
    )


def _safe_filename(filename: str) -> str:
    cleaned = _FILENAME_SAFE_RE.sub("-", filename).strip("-").lower()
    return cleaned or "upload"


def _local_media_enabled() -> bool:
    return bool(getattr(settings, "DEBUG", False) and not getattr(settings, "NEWS_MEDIA_BUCKET", ""))


def _local_media_public_prefix() -> str:
    prefix = getattr(settings, "NEWS_MEDIA_LOCAL_PUBLIC_PREFIX", "/api/v1/activity") or "/api/v1/activity"
    return prefix.rstrip("/")


def _local_media_storage_root() -> Path:
    root = Path(
        getattr(
            settings,
            "NEWS_MEDIA_LOCAL_STORAGE_ROOT",
            "/tmp/updspace-activity-news-media",
        )
    )
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve_local_media_path(key: str) -> Path:
    parts = [part for part in key.split("/") if part and part not in {".", ".."}]
    if not parts:
        raise ValueError("Invalid media key")

    root = _local_media_storage_root().resolve()
    path = root.joinpath(*parts).resolve()
    if path != root and root not in path.parents:
        raise ValueError("Media key escapes storage root")
    return path


def _build_signed_token(*, key: str, content_type: str | None, expires_in: int, salt: str) -> str:
    payload = {
        "key": key,
        "content_type": content_type,
        "expires_at": int(time.time()) + int(expires_in),
    }
    return signing.dumps(payload, salt=salt)


def _parse_signed_token(token: str, *, salt: str, default_max_age: int) -> LocalMediaToken:
    payload = signing.loads(token, salt=salt, max_age=max(1, default_max_age))
    if not isinstance(payload, dict):
        raise signing.BadSignature("Invalid media token payload")

    key = payload.get("key")
    expires_at = payload.get("expires_at")
    content_type = payload.get("content_type")
    if not isinstance(key, str) or not key:
        raise signing.BadSignature("Invalid media token key")
    if not isinstance(expires_at, int):
        raise signing.BadSignature("Invalid media token expiry")
    if expires_at < int(time.time()):
        raise signing.SignatureExpired("Media token expired")
    if content_type is not None and not isinstance(content_type, str):
        raise signing.BadSignature("Invalid media token content_type")
    return LocalMediaToken(key=key, content_type=content_type, expires_at=expires_at)


def build_local_upload_token(*, key: str, content_type: str, expires_in: int | None = None) -> str:
    ttl = int(expires_in or getattr(settings, "NEWS_MEDIA_UPLOAD_TTL_SECONDS", 900))
    return _build_signed_token(
        key=key,
        content_type=content_type,
        expires_in=ttl,
        salt=_LOCAL_UPLOAD_TOKEN_SALT,
    )


def parse_local_upload_token(token: str) -> LocalMediaToken:
    ttl = int(getattr(settings, "NEWS_MEDIA_UPLOAD_TTL_SECONDS", 900))
    return _parse_signed_token(token, salt=_LOCAL_UPLOAD_TOKEN_SALT, default_max_age=ttl)


def build_local_download_token(*, key: str, expires_in: int | None = None) -> str:
    ttl = int(expires_in or getattr(settings, "NEWS_MEDIA_URL_TTL_SECONDS", 604800))
    return _build_signed_token(
        key=key,
        content_type=None,
        expires_in=ttl,
        salt=_LOCAL_DOWNLOAD_TOKEN_SALT,
    )


def parse_local_download_token(token: str) -> LocalMediaToken:
    ttl = int(getattr(settings, "NEWS_MEDIA_URL_TTL_SECONDS", 604800))
    return _parse_signed_token(token, salt=_LOCAL_DOWNLOAD_TOKEN_SALT, default_max_age=ttl)


def save_local_media_file(*, key: str, content: bytes) -> Path:
    path = _resolve_local_media_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return path


def load_local_media_file(*, key: str) -> tuple[Path, str]:
    path = _resolve_local_media_path(key)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(key)
    guessed_type, _ = mimetypes.guess_type(path.name)
    return path, guessed_type or "application/octet-stream"


def build_news_media_key(*, tenant_id: str, filename: str) -> str:
    prefix = getattr(settings, "NEWS_MEDIA_PREFIX", "news").strip("/")
    safe = _safe_filename(filename)
    return f"{prefix}/{tenant_id}/{uuid.uuid4().hex}-{safe}"


def generate_upload_url(*, key: str, content_type: str) -> UploadUrl:
    bucket = getattr(settings, "NEWS_MEDIA_BUCKET", "")
    if not bucket and _local_media_enabled():
        expires_in = int(getattr(settings, "NEWS_MEDIA_UPLOAD_TTL_SECONDS", 900))
        token = build_local_upload_token(key=key, content_type=content_type, expires_in=expires_in)
        prefix = _local_media_public_prefix()
        return UploadUrl(
            key=key,
            upload_url=f"{prefix}/news/media/upload/{token}",
            upload_headers={"Content-Type": content_type},
            expires_in=expires_in,
        )
    if not bucket:
        raise RuntimeError("NEWS_MEDIA_BUCKET is not configured")
    expires_in = int(getattr(settings, "NEWS_MEDIA_UPLOAD_TTL_SECONDS", 900))

    client = _s3_client()
    url = client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )
    return UploadUrl(
        key=key,
        upload_url=url,
        upload_headers={"Content-Type": content_type},
        expires_in=expires_in,
    )


def generate_download_url(*, key: str) -> str:
    bucket = getattr(settings, "NEWS_MEDIA_BUCKET", "")
    if not bucket and _local_media_enabled():
        token = build_local_download_token(key=key)
        return f"{_local_media_public_prefix()}/news/media/file/{token}"
    if not bucket:
        raise RuntimeError("NEWS_MEDIA_BUCKET is not configured")
    expires_in = int(getattr(settings, "NEWS_MEDIA_URL_TTL_SECONDS", 604800))

    client = _s3_client()
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
        HttpMethod="GET",
    )


def is_news_media_key_allowed(*, tenant_id: str, key: str) -> bool:
    prefix = getattr(settings, "NEWS_MEDIA_PREFIX", "news").strip("/")
    expected = f"{prefix}/{tenant_id}/"
    return key.startswith(expected)


def sanitize_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    for raw in tags:
        tag = raw.strip().lower()
        if not tag:
            continue
        tag = tag.replace(" ", "-")
        if tag not in cleaned:
            cleaned.append(tag)
    return cleaned


def normalize_media_payload(media: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in media:
        if not isinstance(item, dict):
            continue
        kind = (item.get("type") or "").strip().lower()
        if kind == "image":
            normalized.append(
                {
                    "type": "image",
                    "key": item.get("key"),
                    "content_type": item.get("content_type"),
                    "size_bytes": item.get("size_bytes"),
                    "width": item.get("width"),
                    "height": item.get("height"),
                    "caption": item.get("caption"),
                }
            )
        elif kind == "youtube":
            normalized.append(
                {
                    "type": "youtube",
                    "url": item.get("url"),
                    "video_id": item.get("video_id"),
                    "title": item.get("title"),
                }
            )
    return normalized
