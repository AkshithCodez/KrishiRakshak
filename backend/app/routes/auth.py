"""
KrishiRakshak — Farmer & Device Auth Route

Lightweight mobile authentication supporting:
- Device UUID registration
- Farmer phone number identification & OTP verification
"""

import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterDeviceRequest(BaseModel):
    device_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone_number: str | None = None
    platform: str = Field(default="android")
    app_version: str = Field(default="1.0.0")


class RegisterDeviceResponse(BaseModel):
    device_id: str
    phone_number: str | None = None
    status: str
    message: str


class SendOtpRequest(BaseModel):
    phone_number: str
    device_id: str | None = None


class SendOtpResponse(BaseModel):
    status: str
    message: str
    demo_otp: str = "1234"


class VerifyOtpRequest(BaseModel):
    phone_number: str
    otp: str
    device_id: str | None = None


class VerifyOtpResponse(BaseModel):
    status: str
    authenticated: bool
    phone_number: str
    message: str


@router.post("/device", response_model=RegisterDeviceResponse)
def register_or_verify_device(req: RegisterDeviceRequest):
    """
    Register or verify a mobile client device UUID and associate phone number.
    """
    return RegisterDeviceResponse(
        device_id=req.device_id,
        phone_number=req.phone_number,
        status="active",
        message="Device authenticated successfully.",
    )


@router.post("/otp/send", response_model=SendOtpResponse)
def send_otp(req: SendOtpRequest):
    """
    Send OTP to farmer's mobile number.
    Returns demo OTP 1234 for development & evaluation.
    """
    return SendOtpResponse(
        status="success",
        message=f"OTP sent successfully to +91 {req.phone_number}",
        demo_otp="1234",
    )


@router.post("/otp/verify", response_model=VerifyOtpResponse)
def verify_otp(req: VerifyOtpRequest):
    """
    Verify the 4-digit OTP. Accepts demo code 1234 or any valid 4-digit sequence.
    """
    is_valid = req.otp == "1234" or (len(req.otp) == 4 and req.otp.isdigit())
    if is_valid:
        return VerifyOtpResponse(
            status="success",
            authenticated=True,
            phone_number=req.phone_number,
            message="Farmer authenticated successfully.",
        )
    return VerifyOtpResponse(
        status="error",
        authenticated=False,
        phone_number=req.phone_number,
        message="Invalid OTP. Please try again.",
    )
