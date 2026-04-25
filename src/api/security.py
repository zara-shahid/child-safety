"""
EPCID Security Module

JWT authentication and password hashing utilities.
"""

import os
from datetime import datetime, timedelta
from typing import Any, cast

import bcrypt
import jwt

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "epcid-development-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    try:
        return cast(
            bool, bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return cast(str, bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"))


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(__import__("datetime").timezone.utc) + expires_delta
    else:
        expire = datetime.now(__import__("datetime").timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(__import__("datetime").timezone.utc),
            "type": "access",
        }
    )

    return cast(str, jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM))


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT refresh token.

    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(__import__("datetime").timezone.utc) + expires_delta
    else:
        expire = datetime.now(__import__("datetime").timezone.utc) + timedelta(
            days=REFRESH_TOKEN_EXPIRE_DAYS
        )

    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(__import__("datetime").timezone.utc),
            "type": "refresh",
        }
    )

    return cast(str, jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM))


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded payload

    Raises:
        PyJWTError: If token is invalid or expired
    """
    return cast(dict[str, Any], jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]))


def verify_token(token: str, token_type: str = "access") -> dict[str, Any] | None:
    """
    Verify a token and return the payload if valid.

    Args:
        token: JWT token string
        token_type: Expected token type ("access" or "refresh")

    Returns:
        Decoded payload if valid, None otherwise
    """
    try:
        payload = decode_token(token)

        # Verify token type
        if payload.get("type") != token_type:
            return None

        return payload

    except jwt.PyJWTError:
        return None


def create_verification_token(email: str) -> str:
    """Create an email verification token."""
    return create_access_token(
        data={"sub": email, "type": "verify"},
        expires_delta=timedelta(hours=24),
    )


def create_password_reset_token(email: str) -> str:
    """Create a password reset token."""
    return create_access_token(
        data={"sub": email, "type": "reset"},
        expires_delta=timedelta(hours=1),
    )
