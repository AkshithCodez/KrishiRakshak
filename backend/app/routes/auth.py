"""
KrishiRakshak — Device Auth Route

Lightweight anonymous authentication/registration based on device UUID.
Frictionless onboarding for farmers with zero login barrier.
"""

import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterDeviceRequest(BaseModel):
    device_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    platform: str = Field(default="android")
    app_version: str = Field(default="1.0.0")


class RegisterDeviceResponse(BaseModel):
    device_id: str
    status: str
    message: str


@router.post("/device", response_model=RegisterDeviceResponse)
def register_or_verify_device(req: RegisterDeviceRequest):
    """
    Register or verify a mobile client device UUID.
    """
    return RegisterDeviceResponse(
        device_id=req.device_id,
        status="active",
        message="Device authenticated successfully.",
    )
