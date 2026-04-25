"""
EPCID API Module

FastAPI-based REST API for the EPCID platform.
Provides endpoints for:
- Health assessments
- Symptom management
- Risk analysis
- Care guidance
- User management
"""

from .main import app, create_app
from .routes import assessment, auth, children, environment, guidelines, symptoms

__all__ = [
    "app",
    "create_app",
    "assessment",
    "children",
    "symptoms",
    "auth",
    "guidelines",
    "environment",
]
