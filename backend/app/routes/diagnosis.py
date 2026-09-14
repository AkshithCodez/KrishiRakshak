"""Same-origin adapter for the existing ML API, including its query-based crop hint."""
import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from ..config import get_settings

router = APIRouter(tags=["Diagnosis"])


@router.post("/api/diagnose")
async def diagnose(file: UploadFile = File(...), crop: str | None = None):
    contents = await file.read(5 * 1024 * 1024 + 1)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose an image smaller than 5 MB.")
    try:
        async with httpx.AsyncClient(timeout=55) as client:
            response = await client.post(
                f"{get_settings().ML_SERVICE_URL.rstrip('/')}/predict",
                params={"crop": crop} if crop else {},
                files={"file": (file.filename, contents, file.content_type)},
            )
        return JSONResponse(response.json(), status_code=response.status_code)
    except (httpx.RequestError, ValueError):
        raise HTTPException(503, "The diagnosis service is unavailable. Please try again.")
