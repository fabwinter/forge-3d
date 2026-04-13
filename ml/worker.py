"""
MeshForge Modal GPU Worker
InstantMesh 3D generation pipeline:
  1. Background removal (rembg)
  2. Multi-view generation + mesh reconstruction (InstantMesh)
  3. Decimation (PyMeshLab)
  4. Export (trimesh)
  5. Upload to Cloudflare R2
  6. Update Supabase job record
"""

import os
import modal
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO

# ---------------------------------------------------------------------------
# Modal app + shared volume for cached model weights
# ---------------------------------------------------------------------------
app = modal.App("meshforge-worker")

volume = modal.Volume.from_name("meshforge-models", create_if_missing=True)

# ---------------------------------------------------------------------------
# Container image
#
# Use nvcr.io/nvidia/pytorch:23.10-py3 as recommended by nvdiffrast docs.
# This image ships with:
#   - CUDA 12.2 + full toolkit headers (CUDA_HOME=/usr/local/cuda)
#   - PyTorch 2.1 pre-installed
#   - nvcc, cuDNN, NCCL all pre-configured
#
# nvdiffrast also requires libegl1-mesa-dev for EGL headless rendering.
#
# Build order:
#   1. nvcr pytorch base  (CUDA + PyTorch pre-installed)
#   2. System libs incl. libegl1-mesa-dev  (nvdiffrast EGL requirement)
#   3. numpy<2  (pin to avoid ABI mismatch)
#   4. ninja + setuptools + wheel  (nvdiffrast build deps)
#   5. nvdiffrast  (--no-build-isolation, TORCH_CUDA_ARCH_LIST=8.0 for A100)
#   6. InstantMesh  (clone + install minus nvdiffrast)
#   7. All remaining deps
# ---------------------------------------------------------------------------
image = (
    modal.Image.from_registry(
        "nvcr.io/nvidia/pytorch:23.10-py3",
    )
    .apt_install([
        "git",
        "libgl1",
        "libglib2.0-0",
        "libgomp1",
        "build-essential",
        "libegl1-mesa-dev",   # required by nvdiffrast for EGL headless rendering
        "libgles2-mesa-dev",
    ])
    # Pin numpy<2 before any CUDA extension builds
    .pip_install("numpy<2")
    # Build tools required by nvdiffrast's setup.py
    .pip_install("ninja", "setuptools>=65", "wheel")
    # nvdiffrast: EGL headers now present, torch pre-installed in base image
    # TORCH_CUDA_ARCH_LIST=8.0 targets A100 (sm_80)
    .run_commands(
        "TORCH_CUDA_ARCH_LIST='8.0' "
        "pip install --no-build-isolation "
        "git+https://github.com/NVlabs/nvdiffrast/"
    )
    # InstantMesh: clone repo, install deps minus nvdiffrast (already done)
    .run_commands(
        "git clone https://github.com/TencentARC/InstantMesh /opt/InstantMesh",
        "grep -v nvdiffrast /opt/InstantMesh/requirements.txt "
        "| pip install --no-build-isolation -r /dev/stdin",
    )
    # InstantMesh runtime deps not in requirements.txt
    # xformers 0.0.22.post7 matches torch 2.1 in the nvcr base image
    .pip_install(
        "pytorch_lightning==2.2.0",
        "lightning==2.2.0",
        "xformers==0.0.22.post7",
        "timm==0.9.16",
        "tqdm",
        "einops==0.7.0",
        "omegaconf==2.3.0",
    )
    # Remaining application deps
    .pip_install(
        "rembg[gpu]==2.0.56",
        "pymeshlab==2023.12",
        "trimesh==4.3.0",
        "boto3==1.34.0",
        "supabase==2.5.0",
        "huggingface_hub==0.22.0",
        "diffusers==0.27.0",
        "transformers==4.39.0",
        "accelerate==0.28.0",
        "httpx==0.27.0",
        "Pillow==10.3.0",
    )
)


# ---------------------------------------------------------------------------
# Helper: update Supabase job status
# ---------------------------------------------------------------------------
def _update_status(sb, job_id: str, status: str, **extra_fields) -> None:
    payload = {"status": status, **extra_fields}
    sb.table("jobs").update(payload).eq("id", job_id).execute()


# ---------------------------------------------------------------------------
# Main generation function
# ---------------------------------------------------------------------------
@app.function(
    gpu="A100",
    image=image,
    volumes={"/models": volume},
    timeout=300,
    secrets=[modal.Secret.from_name("meshforge-secrets")],
)
def generate_3d_asset(
    job_id: str,
    input_url: str,
    poly_budget: str,
    texture_res: int,
    export_format: str,
    user_id: str,
) -> None:
    import sys
    sys.path.insert(0, "/opt/InstantMesh")

    import httpx
    import boto3
    import pymeshlab
    import trimesh
    from PIL import Image
    from rembg import remove
    from supabase import create_client

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    r2 = boto3.client(
        "s3",
        endpoint_url=os.environ["CLOUDFLARE_R2_ENDPOINT"],
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_KEY"],
        region_name="auto",
    )
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]

    try:
        _update_status(sb, job_id, "background_removal")

        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            img_response = client.get(input_url)
            img_response.raise_for_status()

        input_img = Image.open(BytesIO(img_response.content)).convert("RGBA")

        clean_img: Image.Image = remove(input_img)  # type: ignore[assignment]
        clean_path = Path(f"/tmp/{job_id}_clean.png")
        clean_img.save(clean_path)

        _update_status(sb, job_id, "multiview")

        from run import main as instantmesh_run  # type: ignore[import]

        mesh_path = Path(f"/tmp/{job_id}_mesh.obj")
        instantmesh_run(
            input_path=str(clean_path),
            config="configs/instant-mesh-large.yaml",
            output_path=str(mesh_path),
            texture_resolution=texture_res,
            no_rembg=True,
        )

        _update_status(sb, job_id, "reconstruction")
        _update_status(sb, job_id, "optimising")

        poly_map: dict[str, int] = {"low": 2000, "medium": 8000, "high": 16000}
        target_faces = poly_map[poly_budget]

        ms = pymeshlab.MeshSet()
        ms.load_new_mesh(str(mesh_path))
        ms.meshing_isotropic_explicit_remeshing(
            targetlen=pymeshlab.PercentageValue(0.5)
        )
        ms.simplification_quadric_edge_collapse_decimation(
            targetfacenum=target_faces,
            preservenormal=True,
            preservetopology=True,
            qualitythr=0.3,
        )
        optimised_path = Path(f"/tmp/{job_id}_optimised.obj")
        ms.save_current_mesh(str(optimised_path))

        _update_status(sb, job_id, "exporting")

        ext_map: dict[str, str] = {"GLB": ".glb", "OBJ": ".obj", "FBX": ".fbx"}
        ext = ext_map[export_format]
        output_path = Path(f"/tmp/{job_id}_output{ext}")

        mesh = trimesh.load(str(optimised_path))
        mesh.export(str(output_path))

        output_key = f"outputs/{job_id}/asset{ext}"
        content_type_map: dict[str, str] = {
            ".glb": "model/gltf-binary",
            ".obj": "text/plain",
            ".fbx": "application/octet-stream",
        }

        with open(output_path, "rb") as f:
            r2.upload_fileobj(
                f,
                bucket,
                output_key,
                ExtraArgs={"ContentType": content_type_map.get(ext, "application/octet-stream")},
            )

        output_url: str = r2.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": output_key},
            ExpiresIn=86400,
        )

        _update_status(
            sb, job_id, "complete",
            output_url=output_url,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

        sb.rpc("increment_generation_count", {"user_id_input": user_id}).execute()

    except Exception as exc:
        _update_status(sb, job_id, "failed", error_message=str(exc))
        raise


# ---------------------------------------------------------------------------
# Modal webhook — triggered by the FastAPI backend
# ---------------------------------------------------------------------------
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("meshforge-secrets")],
)
@modal.fastapi_endpoint(method="POST")
def webhook(data: dict) -> dict:
    generate_3d_asset.spawn(
        job_id=data["job_id"],
        input_url=data["input_url"],
        poly_budget=data["poly_budget"],
        texture_res=data["texture_res"],
        export_format=data["format"],
        user_id=data.get("user_id", ""),
    )
    return {"status": "queued", "job_id": data["job_id"]}
