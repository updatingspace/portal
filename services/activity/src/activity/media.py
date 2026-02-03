from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any

from django.conf import settings


_FILENAME_SAFE_RE = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class UploadUrl:
    key: str
    upload_url: str
    upload_headers: dict[str, str]
    expires_in: int


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


def build_news_media_key(*, tenant_id: str, filename: str) -> str:
    prefix = getattr(settings, "NEWS_MEDIA_PREFIX", "news").strip("/")
    safe = _safe_filename(filename)
    return f"{prefix}/{tenant_id}/{uuid.uuid4().hex}-{safe}"


def generate_upload_url(*, key: str, content_type: str) -> UploadUrl:
    bucket = getattr(settings, "NEWS_MEDIA_BUCKET", "")
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
