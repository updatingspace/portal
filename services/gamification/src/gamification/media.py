"""Tenant-scoped achievement images in the existing private S3 media bucket."""

from __future__ import annotations

import io
import os
import uuid
import warnings

import boto3
from botocore.exceptions import ClientError
from ninja.errors import HttpError
from PIL import Image, UnidentifiedImageError

MAX_BYTES = 2 * 1024 * 1024
FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


def storage():
    bucket = os.getenv("ACHIEVEMENT_MEDIA_BUCKET", "")
    if not bucket:
        raise HttpError(
            503,
            {"code": "MEDIA_UNAVAILABLE", "message": "Image storage is unavailable"},
        )
    client = boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        region_name=os.getenv("S3_REGION"),
        aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
    )
    return client, bucket


def save_image(*, tenant_id: str, upload) -> dict[str, str]:
    if not upload or upload.size > MAX_BYTES:
        raise HttpError(
            400, {"code": "FILE_TOO_LARGE", "message": "Choose an image up to 2 MB"}
        )
    body = upload.read(MAX_BYTES + 1)
    if not body or len(body) > MAX_BYTES:
        raise HttpError(400, {"code": "INVALID_IMAGE", "message": "Invalid image size"})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(body)) as image:
                content_type = FORMATS.get(image.format or "")
                if not content_type or image.width * image.height > 25_000_000:
                    raise ValueError("Unsupported image")
                image.verify()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise HttpError(
            400,
            {"code": "INVALID_IMAGE", "message": "Choose a PNG, JPEG or WebP image"},
        ) from exc
    image_id = str(uuid.uuid4())
    client, bucket = storage()
    client.put_object(
        Bucket=bucket,
        Key=f"achievements/{tenant_id}/{image_id}",
        Body=body,
        ContentType=content_type,
    )
    return {"url": f"/api/v1/gamification/media/{image_id}"}


def read_image(*, tenant_id: str, image_id: str) -> tuple[bytes, str]:
    try:
        image_id = str(uuid.UUID(image_id))
    except ValueError as exc:
        raise HttpError(404, "Image not found") from exc
    client, bucket = storage()
    try:
        result = client.get_object(
            Bucket=bucket, Key=f"achievements/{tenant_id}/{image_id}"
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
            raise HttpError(404, "Image not found") from exc
        raise
    stream = result["Body"]
    try:
        return stream.read(MAX_BYTES + 1), result.get(
            "ContentType", "application/octet-stream"
        )
    finally:
        stream.close()
