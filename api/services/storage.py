import os
import boto3
from botocore.exceptions import BotoCoreError, ClientError


def _get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["CLOUDFLARE_R2_ENDPOINT"],
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_KEY"],
        region_name="auto",
    )


def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload bytes to Cloudflare R2 and return the object key.
    Raises RuntimeError on failure.
    """
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    try:
        client = _get_r2_client()
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return key
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"R2 upload failed for key '{key}': {exc}") from exc


def generate_presigned_url(key: str, expiry: int = 3600) -> str:
    """
    Generate a presigned GET URL for an R2 object.
    Raises RuntimeError on failure.
    """
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    try:
        client = _get_r2_client()
        url: str = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry,
        )
        return url
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Failed to generate presigned URL for '{key}': {exc}") from exc


def delete_file(key: str) -> None:
    """
    Delete an object from R2.
    Raises RuntimeError on failure.
    """
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    try:
        client = _get_r2_client()
        client.delete_object(Bucket=bucket, Key=key)
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Failed to delete R2 object '{key}': {exc}") from exc
