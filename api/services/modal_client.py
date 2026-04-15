import os
import httpx


async def trigger_generation(
    job_id: str,
    input_url: str,
    poly_budget: str,
    texture_res: int,
    export_format: str,
    user_id: str,
) -> None:
    """
    Fire-and-forget POST to the Modal webhook to kick off the GPU worker.
    Does not wait for the job to complete.
    Raises RuntimeError if the webhook call fails.
    """
    webhook_url = os.environ["MODAL_WEBHOOK_URL"]
    payload = {
        "job_id": job_id,
        "input_url": input_url,
        "poly_budget": poly_budget,
        "texture_res": texture_res,
        "format": export_format,
        "user_id": user_id,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Modal webhook returned {exc.response.status_code}: {exc.response.text}"
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"Failed to reach Modal webhook: {exc}") from exc
