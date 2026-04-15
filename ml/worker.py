"""
MeshForge Modal GPU Worker — Hunyuan3D 3.0 Pipeline
  1. Background removal (rembg)
  2. Shape generation (Hunyuan3D DiT flow-matching)
  3. PBR texture baking (Hunyuan3D Paint)
  4. Decimation to poly budget (PyMeshLab)
  5. Export to GLB / OBJ / FBX (trimesh)
  6. Upload to Cloudflare R2
  7. Update Supabase job record

Run `modal run ml/worker.py::download_weights` ONCE after first deploy
to pull the ~15 GB weights into the shared Volume.

GPU: A100-40GB sufficient for low/medium quality.
     Upgrade to A100-80GB for high (mc_depth=9, steps=50).
"""

import os
import modal
from datetime import datetime, timezone
from pathlib import Path
from io import BytesIO

app = modal.App("meshforge-worker")
volume = modal.Volume.from_name("meshforge-models", create_if_missing=True)

image = (
    modal.Image.from_registry("nvcr.io/nvidia/pytorch:23.10-py3")
    .apt_install([
        "git", "libgl1", "libglib2.0-0", "libgomp1",
        "build-essential", "libegl1-mesa-dev", "libgles2-mesa-dev", "libglew-dev",
    ])
    .pip_install("numpy<2")
    .pip_install("ninja", "setuptools>=65", "wheel")
.run_commands(
        "mkdir -p /opt/Hunyuan3D-3 && "
        "wget -q https://github.com/Tencent-Hunyuan/Hunyuan3D-3/archive/refs/tags/v3.0.tar.gz "
        "-O /tmp/hy3d.tar.gz && "
        "tar -xzf /tmp/hy3d.tar.gz --strip-components=1 -C /opt/Hunyuan3D-3 || "
        "(mkdir -p /opt/Hunyuan3D-3 && "
        "wget -q https://github.com/Tencent-Hunyuan/Hunyuan3D-3/archive/refs/heads/main.tar.gz "
        "-O /tmp/hy3d.tar.gz && "
        "tar -xzf /tmp/hy3d.tar.gz --strip-components=1 -C /opt/Hunyuan3D-3)",
    )
    .run_commands(
        "pip install --no-build-isolation -r /opt/Hunyuan3D-3/requirements.txt",
    )
    .run_commands(
        "cd /opt/Hunyuan3D-3/hy3dgen/texgen/custom_rasterizer && "
        "TORCH_CUDA_ARCH_LIST='8.0' python setup.py install",
        "cd /opt/Hunyuan3D-3/hy3dgen/shapegen/diffoctreerast && "
        "TORCH_CUDA_ARCH_LIST='8.0' python setup.py install",
    )
    .pip_install("xformers==0.0.22.post7")
    .pip_install(
        "rembg[gpu]==2.0.56",
        "pymeshlab==2023.12",
        "trimesh[easy]==4.3.0",
        "boto3==1.34.0",
        "supabase==2.5.0",
        "huggingface_hub==0.22.0",
        "httpx==0.27.0",
        "Pillow==10.3.0",
        "open3d==0.18.0",
    )
)


@app.function(
    gpu="A100", image=image,
    volumes={"/models": volume}, timeout=600,
    secrets=[modal.Secret.from_name("meshforge-secrets")],
)
def download_weights() -> None:
    """Pull Hunyuan3D-3 weights from HuggingFace into the shared volume.
    Run once: modal run ml/worker.py::download_weights
    """
    from huggingface_hub import snapshot_download
    model_dir = Path("/models/hunyuan3d-3")
    if model_dir.exists() and any(model_dir.iterdir()):
        print("Weights already cached — skipping.")
        volume.commit()
        return
    print("Downloading Hunyuan3D-3 weights (~15 GB)...")
    snapshot_download(
        repo_id="tencent/Hunyuan3D-3",
        local_dir=str(model_dir),
        ignore_patterns=["*.md", "*.txt"],
    )
    volume.commit()
    print("Done — weights cached to volume.")


def _update_status(sb, job_id: str, status: str, **extra_fields) -> None:
    payload = {"status": status, **extra_fields}
    sb.table("jobs").update(payload).eq("id", job_id).execute()


@app.function(
    gpu="A100", image=image,
    volumes={"/models": volume}, timeout=480,
    secrets=[modal.Secret.from_name("meshforge-secrets")],
)
def generate_3d_asset(
    job_id: str, input_url: str, poly_budget: str,
    texture_res: int, export_format: str, user_id: str,
) -> None:
    import sys
    sys.path.insert(0, "/opt/Hunyuan3D-3")

    import torch
    import httpx, boto3, pymeshlab, trimesh
    from PIL import Image
    from rembg import remove
    from supabase import create_client
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    r2 = boto3.client(
        "s3",
        endpoint_url=os.environ["CLOUDFLARE_R2_ENDPOINT"],
        aws_access_key_id=os.environ["CLOUDFLARE_R2_ACCESS_KEY"],
        aws_secret_access_key=os.environ["CLOUDFLARE_R2_SECRET_KEY"],
        region_name="auto",
    )
    bucket = os.environ["CLOUDFLARE_R2_BUCKET_NAME"]
    model_dir = "/models/hunyuan3d-3"

    poly_map  = {"low": 2_000,  "medium": 8_000,  "high": 20_000}
    steps_map = {"low": 25,     "medium": 36,     "high": 50}
    depth_map = {"low": 7,      "medium": 8,      "high": 9}
    target_faces        = poly_map[poly_budget]
    num_inference_steps = steps_map[poly_budget]
    mc_depth            = depth_map[poly_budget]

    try:
        # Stage 1 — Background removal
        _update_status(sb, job_id, "background_removal")
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            img_bytes = client.get(input_url).content
        input_img = Image.open(BytesIO(img_bytes)).convert("RGBA")
        clean_img = remove(input_img)
        canvas = Image.new("RGB", clean_img.size, (255, 255, 255))
        canvas.paste(clean_img, mask=clean_img.split()[3])
        canvas = canvas.resize((512, 512), Image.LANCZOS)
        clean_path = Path(f"/tmp/{job_id}_clean.png")
        canvas.save(clean_path)

        # Stage 2 — Geometry (Hunyuan3D DiT)
        _update_status(sb, job_id, "multiview")
        shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            model_dir, subfolder="hunyuan3d-dit-v3-0", use_safetensors=True,
        ).to("cuda")
        mesh_output = shape_pipeline(
            image=canvas,
            num_inference_steps=num_inference_steps,
            guidance_scale=5.5,
            mc_depth=mc_depth,
            output_type="trimesh",
        )
        raw_mesh = mesh_output.meshes[0]
        _update_status(sb, job_id, "reconstruction")
        raw_mesh_path = Path(f"/tmp/{job_id}_raw.glb")
        raw_mesh.export(str(raw_mesh_path))
        del shape_pipeline
        torch.cuda.empty_cache()

        # Stage 3 — PBR texture baking (Hunyuan3D Paint)
        _update_status(sb, job_id, "reconstruction")
        paint_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
            model_dir, subfolder="hunyuan3d-paint-v3-0",
        ).to("cuda")
        textured_mesh = paint_pipeline(
            mesh=raw_mesh, image=canvas, texture_resolution=texture_res,
        )
        textured_path = Path(f"/tmp/{job_id}_textured.glb")
        textured_mesh.export(str(textured_path))
        del paint_pipeline
        torch.cuda.empty_cache()

        # Stage 4 — Decimate to poly budget
        _update_status(sb, job_id, "optimising")
        ms = pymeshlab.MeshSet()
        ms.load_new_mesh(str(textured_path))
        ms.meshing_isotropic_explicit_remeshing(targetlen=pymeshlab.PercentageValue(0.5))
        ms.simplification_quadric_edge_collapse_decimation(
            targetfacenum=target_faces, preservenormal=True,
            preservetopology=True, qualitythr=0.3, preservetex=True,
        )
        optimised_path = Path(f"/tmp/{job_id}_optimised.obj")
        ms.save_current_mesh(str(optimised_path))

        # Stage 5 — Export
        _update_status(sb, job_id, "exporting")
        ext_map = {"GLB": ".glb", "OBJ": ".obj", "FBX": ".fbx"}
        ext = ext_map[export_format]
        output_path = Path(f"/tmp/{job_id}_output{ext}")
        trimesh.load(str(optimised_path)).export(str(output_path))

        # Stage 6 — R2 upload
        output_key = f"outputs/{job_id}/asset{ext}"
        content_type_map = {
            ".glb": "model/gltf-binary",
            ".obj": "text/plain",
            ".fbx": "application/octet-stream",
        }
        with open(output_path, "rb") as f:
            r2.upload_fileobj(f, bucket, output_key,
                ExtraArgs={"ContentType": content_type_map.get(ext, "application/octet-stream")})
        output_url = r2.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": output_key}, ExpiresIn=86400,
        )
        _update_status(sb, job_id, "complete",
            output_url=output_url, completed_at=datetime.now(timezone.utc).isoformat())
        sb.rpc("increment_generation_count", {"user_id_input": user_id}).execute()

    except Exception as exc:
        _update_status(sb, job_id, "failed", error_message=str(exc))
        raise


@app.function(image=image, secrets=[modal.Secret.from_name("meshforge-secrets")])
@modal.fastapi_endpoint(method="POST")
def webhook(data: dict) -> dict:
    generate_3d_asset.spawn(
        job_id=data["job_id"], input_url=data["input_url"],
        poly_budget=data["poly_budget"], texture_res=data["texture_res"],
        export_format=data["format"], user_id=data.get("user_id", ""),
    )
    return {"status": "queued", "job_id": data["job_id"]}
