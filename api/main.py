import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routes import generate, health  # noqa: E402 — after load_dotenv

app = FastAPI(title="MeshForge API", version="1.0.0")

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
