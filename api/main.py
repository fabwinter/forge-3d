import os
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

from routes import generate, health  # noqa: E402 — after load_dotenv

# Warn loudly at startup if required server-side env vars are missing
_REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MODAL_WEBHOOK_URL"]
_missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
if _missing:
    print(f"[MeshForge] WARNING: missing env vars: {', '.join(_missing)}")

app = FastAPI(title="MeshForge API", version="1.0.0")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return the real error detail on unexpected 500s to aid debugging."""
    tb = traceback.format_exc()
    print(f"[MeshForge] Unhandled exception on {request.method} {request.url}:\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
    )

# CORS — allow Vercel frontend and local dev
frontend_url = os.getenv("FRONTEND_URL", "*")
origins = [frontend_url] if frontend_url != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/api")
app.include_router(health.router, prefix="/api")


@app.get("/")
def root() -> dict:
    return {"name": "MeshForge API", "docs": "/docs"}
