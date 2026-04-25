"""
EPCID Authentication Routes

JWT-based authentication endpoints:
- User registration
- Login/logout
- Token refresh
- Password management
"""

from datetime import datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from ...api.dependencies import get_current_active_user
from ...api.schemas import UserResponse
from ...api.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)

router = APIRouter()


# Request/Response Models
class LoginRequest(BaseModel):
    """Login request model."""

    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    """Registration request model."""

    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "parent@example.com",
                "password": "securepassword123",
                "full_name": "Jane Doe",
                "phone": "+1-555-123-4567",
            }
        }
    )


class TokenResponse(BaseModel):
    """Token response model."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiry in seconds")
    user: "UserResponse"


class RefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """Password change request."""

    current_password: str
    new_password: str = Field(..., min_length=8)


class PasswordResetRequest(BaseModel):
    """Password reset request."""

    email: EmailStr


# Simulated user database (replace with real DB in production)
fake_users_db: dict[str, dict[str, Any]] = {
    "demo@epcid.health": {
        "id": "user-001",
        "email": "demo@epcid.health",
        "full_name": "Demo User",
        "hashed_password": "$2b$12$jqNwrSPEQUg4GCCK1B/Ex.jNZcdc8IG3D.c3t.BCXXkR9xoWxqRGW",  # "password123"
        "is_active": True,
        "is_verified": True,
        "created_at": "2024-01-01T00:00:00Z",
    }
}


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account and return authentication tokens.",
)
async def register(request: RegisterRequest) -> TokenResponse:
    """
    Register a new user account.

    - **email**: Valid email address (must be unique)
    - **password**: Minimum 8 characters
    - **full_name**: User's full name
    - **phone**: str | None phone number
    """
    # Check if user exists
    if request.email in fake_users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user_id = f"user-{len(fake_users_db) + 1:03d}"
    hashed_password = get_password_hash(request.password)

    new_user = {
        "id": user_id,
        "email": request.email,
        "full_name": request.full_name,
        "phone": request.phone,
        "hashed_password": hashed_password,
        "is_active": True,
        "is_verified": False,
        "created_at": datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }

    fake_users_db[request.email] = new_user

    # Generate tokens
    access_token = create_access_token(data={"sub": request.email, "user_id": user_id})
    refresh_token = create_refresh_token(data={"sub": request.email, "user_id": user_id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=3600,  # 1 hour
        user=UserResponse(
            id=str(user_id),
            email=request.email,
            full_name=request.full_name,
            is_active=True,
            is_verified=False,
        ),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and get tokens",
    description="Authenticate with email and password to receive JWT tokens.",
)
async def login(request: LoginRequest) -> TokenResponse:
    """
    Authenticate and receive access tokens.

    Returns both access_token and refresh_token.
    Access token expires in 1 hour, refresh token in 7 days.
    """
    user = fake_users_db.get(request.email)

    if not user or not verify_password(request.password, str(user["hashed_password"])):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Generate tokens
    access_token = create_access_token(data={"sub": user["email"], "user_id": user["id"]})
    refresh_token = create_refresh_token(data={"sub": user["email"], "user_id": user["id"]})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=3600,
        user=UserResponse(
            id=str(user["id"]),
            email=str(user["email"]),
            full_name=str(user["full_name"]),
            is_active=bool(user["is_active"]),
            is_verified=bool(user["is_verified"]),
        ),
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Login with form data (OAuth2)",
    description="OAuth2 compatible token endpoint. Accepts form-encoded username/password.",
)
async def token(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """OAuth2 compatible token endpoint — used by frontend login."""
    return cast(
        TokenResponse,
        await login(LoginRequest(email=form_data.username, password=form_data.password)),
    )


@router.post(
    "/login/form",
    response_model=TokenResponse,
    summary="Login with form data",
    description="OAuth2 compatible login endpoint.",
)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """OAuth2 compatible login endpoint for Swagger UI."""
    return cast(
        TokenResponse,
        await login(LoginRequest(email=form_data.username, password=form_data.password)),
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Use refresh token to get a new access token.",
)
async def refresh_token(request: RefreshRequest) -> TokenResponse:
    """
    Refresh an access token using a valid refresh token.

    The refresh token must be valid and not expired.
    """
    try:
        payload = decode_token(request.refresh_token)
        email = payload.get("sub")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        user = fake_users_db.get(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        # Generate new tokens
        access_token = create_access_token(data={"sub": email, "user_id": user["id"]})
        new_refresh_token = create_refresh_token(data={"sub": email, "user_id": user["id"]})

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=3600,
            user=UserResponse(
                id=str(user["id"]),
                email=str(user["email"]),
                full_name=str(user["full_name"]),
                is_active=bool(user["is_active"]),
                is_verified=bool(user["is_verified"]),
            ),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from None


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the currently authenticated user's profile.",
)
async def get_me(current_user: dict[str, Any] = Depends(get_current_active_user)) -> UserResponse:
    """Get the current authenticated user's profile."""
    return UserResponse(
        id=str(current_user["id"]),
        email=str(current_user["email"]),
        full_name=str(current_user["full_name"]),
        is_active=bool(current_user["is_active"]),
        is_verified=bool(current_user["is_verified"]),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout",
    description="Invalidate the current session (client should discard tokens).",
)
async def logout(current_user: dict[str, Any] = Depends(get_current_active_user)) -> None:
    """
    Logout the current user.

    Note: In a production system, this would add the token to a blacklist.
    The client should discard the tokens after calling this endpoint.
    """
    # In production, add token to blacklist
    return None


@router.post(
    "/password/change",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password",
    description="Change the current user's password.",
)
async def change_password(
    request: PasswordChangeRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> None:
    """Change the current user's password."""
    if not verify_password(request.current_password, str(current_user["hashed_password"])):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Update password
    fake_users_db[current_user["email"]]["hashed_password"] = get_password_hash(
        request.new_password
    )

    return None


@router.post(
    "/password/reset",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request password reset",
    description="Request a password reset email.",
)
async def request_password_reset(request: PasswordResetRequest) -> dict[str, str]:
    """
    Request a password reset.

    If the email exists, a reset link will be sent.
    Always returns 202 to prevent email enumeration.
    """
    # In production, send email with reset link
    # Always return success to prevent email enumeration
    return {"message": "If this email exists, a reset link will be sent."}
