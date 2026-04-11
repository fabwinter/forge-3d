import os
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from middleware.auth import verify_token
from services.modal_client import trigger_generation
from supabase import create_client, Client

router = APIRouter()

PolyBudget = Literal["low", "medium", "high"]
TextureRes = Literal[512, 1024, 2048]
ExportFormat = Literal["GLB", "OBJ", "FBX"]


def _get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


class GenerateRequest(BaseModel):
    input_url: str
    poly_budget: PolyBudget
    texture_res: TextureRes
    format: ExportFormat
    user_id: str

    @field_validator("input_url")
    @classmethod
    def input_url_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("input_url must not be empty")
        return v


class GenerateResponse(BaseModel):
    job_id: str
    status: str


@router.post("/generate", response_model=GenerateResponse)
async def create_generation_job(
    body: GenerateRequest,
    token_user: dict = Depends(verify_token),
) -> GenerateResponse:
    """
    Create a new generation job and enqueue it on Modal.
    Returns job_id immediately; client polls GET /jobs/{job_id}.
    """
    # Ensure the authenticated user matches the request user_id
    if token_user["id"] != body.user_id:
        raise HTTPException(status_code=403, detail="user_id does not match authenticated user")

    sb = _get_supabase()

    # Check generation limit
    profile_resp = sb.table("profiles").select("generations_used, generations_limit").eq("id", body.user_id).single().execute()
    if profile_resp.data is None:
        raise HTTPException(status_code=404, detail="User profile not found")

    profile = profile_resp.data
    if profile["generations_used"] >= profile["generations_limit"]:
        raise HTTPException(
            status_code=429,
            detail="Monthly generation limit reached. Upgrade to continue.",
        )

    # Create job record
    job_id = str(uuid.uuid4())
    sb.table("jobs").insert(
        {
            "id": job_id,
            "user_id": body.user_id,
            "status": "pending",
            "poly_budget": body.poly_budget,
            "texture_res": body.texture_res,
            "format": body.format,
            "input_url": body.input_url,
        }
    ).execute()

    # Trigger Modal worker (non-blocking)
    try:
        await trigger_generation(
            job_id=job_id,
            input_url=body.input_url,
            poly_budget=body.poly_budget,
            texture_res=body.texture_res,
            export_format=body.format,
        )
    except RuntimeError as exc:
        # Mark job as failed if we can't reach Modal
        sb.table("jobs").update(
            {"status": "failed", "error_message": str(exc)}
        ).eq("id", job_id).execute()
        raise HTTPException(status_code=503, detail=f"Failed to queue job: {exc}") from exc

    return GenerateResponse(job_id=job_id, status="pending")


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    token_user: dict = Depends(verify_token),
) -> dict:
    """
    Fetch the current state of a generation job.
    Returns 404 if not found or if the job belongs to a different user.
    """
    sb = _get_supabase()

    job_resp = (
        sb.table("jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", token_user["id"])
        .maybe_single()
        .execute()
    )

    if job_resp.data is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_resp.data
