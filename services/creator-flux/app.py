import asyncio
import base64
import hmac
import io
import os
import secrets
import threading
from typing import Literal

import torch
from diffusers import FluxPipeline
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL_ID = os.getenv("ATLAS_FLUX_MODEL_ID", "black-forest-labs/FLUX.1-schnell")
ALLOW_CPU = os.getenv("ATLAS_ALLOW_CPU_FLUX", "false").lower() == "true"
CPU_OFFLOAD = os.getenv("ATLAS_FLUX_CPU_OFFLOAD", "true").lower() == "true"
LOCAL_FILES_ONLY = os.getenv("ATLAS_FLUX_LOCAL_FILES_ONLY", "false").lower() == "true"
RUNTIME_TOKEN = os.getenv("ATLAS_FLUX_RUNTIME_TOKEN", "").strip()

app = FastAPI(title="ATLAS Creator FLUX Runtime", version="1.0.0")
_pipeline: FluxPipeline | None = None
_pipeline_lock = threading.Lock()
_generation_lock = asyncio.Lock()


class GenerationRequest(BaseModel):
    model: str = "FLUX.1-schnell"
    prompt: str = Field(min_length=8, max_length=4000)
    format: str = "Adaptive"
    organization_id: str
    requested_by: str
    seed: int | None = None


def authorize_runtime(x_atlas_runtime_token: str | None = Header(default=None, alias="x-atlas-runtime-token")) -> None:
    if not RUNTIME_TOKEN:
        raise HTTPException(status_code=503, detail="runtime_auth_not_configured")
    supplied = (x_atlas_runtime_token or "").strip()
    if not supplied or not hmac.compare_digest(supplied, RUNTIME_TOKEN):
        raise HTTPException(status_code=401, detail="runtime_auth_required")


def runtime_device() -> Literal["cuda", "cpu"]:
    return "cuda" if torch.cuda.is_available() else "cpu"


def readiness() -> tuple[bool, str]:
    device = runtime_device()
    if device == "cpu" and not ALLOW_CPU:
        return False, "resource-blocked"
    return True, "ready"


def dimensions_for(format_name: str) -> tuple[int, int]:
    normalized = format_name.strip().lower()
    if normalized == "portrait 9:16":
        return 768, 1344
    if normalized == "landscape 16:9":
        return 1344, 768
    return 1024, 1024


def get_pipeline() -> FluxPipeline:
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline

        device = runtime_device()
        if device == "cpu" and not ALLOW_CPU:
            raise RuntimeError("resource-blocked")

        dtype = torch.bfloat16 if device == "cuda" else torch.float32
        pipe = FluxPipeline.from_pretrained(
            MODEL_ID,
            torch_dtype=dtype,
            local_files_only=LOCAL_FILES_ONLY,
        )

        if device == "cuda" and CPU_OFFLOAD:
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)

        _pipeline = pipe
        return _pipeline


def generate_image(request: GenerationRequest) -> dict:
    pipe = get_pipeline()
    width, height = dimensions_for(request.format)
    seed = request.seed if request.seed is not None else secrets.randbelow(2**31 - 1)
    generator = torch.Generator(device="cpu").manual_seed(seed)

    image = pipe(
        prompt=request.prompt,
        guidance_scale=0.0,
        num_inference_steps=4,
        max_sequence_length=256,
        width=width,
        height=height,
        generator=generator,
    ).images[0]

    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=90, method=4)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return {
        "url": f"data:image/webp;base64,{encoded}",
        "mimeType": "image/webp",
        "width": width,
        "height": height,
        "seed": seed,
        "model": MODEL_ID,
    }


@app.get("/health")
def health(x_atlas_runtime_token: str | None = Header(default=None, alias="x-atlas-runtime-token")):
    authorize_runtime(x_atlas_runtime_token)
    ready, state = readiness()
    device = runtime_device()
    details = {
        "ready": ready,
        "state": state,
        "provider": "flux-schnell-local",
        "model": MODEL_ID,
        "device": device,
        "model_loaded": _pipeline is not None,
        "cpu_allowed": ALLOW_CPU,
        "local_files_only": LOCAL_FILES_ONLY,
    }
    if not ready:
        details["message"] = "FLUX requires a supported GPU unless ATLAS_ALLOW_CPU_FLUX=true is explicitly enabled."
    return details


@app.post("/generate")
async def generate(request: GenerationRequest, x_atlas_runtime_token: str | None = Header(default=None, alias="x-atlas-runtime-token")):
    authorize_runtime(x_atlas_runtime_token)
    ready, state = readiness()
    if not ready:
        raise HTTPException(
            status_code=503,
            detail={
                "state": "resource-blocked",
                "provider": "flux-schnell-local",
                "message": "No supported FLUX runtime is available on this host.",
            },
        )

    if request.model.lower() not in {"flux.1-schnell", "flux1-schnell", MODEL_ID.lower()}:
        raise HTTPException(status_code=400, detail="unsupported_model")

    try:
        async with _generation_lock:
            asset = await asyncio.to_thread(generate_image, request)
        return {
            "ok": True,
            "provider": "flux-schnell-local",
            "state": "completed",
            "asset": asset,
        }
    except torch.cuda.OutOfMemoryError as error:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        raise HTTPException(
            status_code=503,
            detail={"state": "resource-blocked", "message": "Insufficient GPU memory for this generation."},
        ) from error
    except RuntimeError as error:
        if str(error) == "resource-blocked":
            raise HTTPException(status_code=503, detail={"state": state, "message": str(error)}) from error
        raise HTTPException(status_code=500, detail="generation_runtime_error") from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="generation_failed") from error
