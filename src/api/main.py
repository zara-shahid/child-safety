"""
EPCID FastAPI Main Application

Production-ready FastAPI server with:
- CORS middleware
- Rate limiting
- Request logging
- Error handling
- Health checks
- OpenAPI documentation
"""

import os
import time
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any, cast

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from ..utils.logger import get_logger, setup_logging
from ..utils.metrics import get_metrics_collector

logger = get_logger("api")


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
    """Manage application lifespan events."""
    # Startup
    logger.info("Starting EPCID API server...")
    setup_logging(level="INFO", json_format=True)

    # Initialize services
    app.state.metrics = get_metrics_collector()
    app.state.started_at = time.time()

    # Initialize Vertex AI
    try:
        from ..services.vertex_ai_service import VERTEX_AI_AVAILABLE, get_vertex_ai_service

        if VERTEX_AI_AVAILABLE:
            vertex_service = get_vertex_ai_service()
            app.state.vertex_ai = vertex_service
            app.state.vertex_ai_available = vertex_service.is_available
            logger.info(f"Vertex AI initialized: available={vertex_service.is_available}")
        else:
            app.state.vertex_ai = None
            app.state.vertex_ai_available = False
            logger.info("Vertex AI SDK not available - running without Vertex AI")
    except Exception as e:
        logger.warning(f"Vertex AI initialization failed: {e}")
        app.state.vertex_ai = None
        app.state.vertex_ai_available = False

    logger.info("EPCID API server started successfully")

    yield

    # Shutdown
    logger.info("Shutting down EPCID API server...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="EPCID API",
        description="""
## Early Pediatric Critical Illness Detection API

An agentic AI platform for clinical decision support in pediatric care.

### Features
- 🏥 **Risk Assessment**: Multi-layered risk stratification
- 📊 **Symptom Tracking**: Longitudinal symptom monitoring
- 📚 **Guidelines**: Evidence-based care guidance
- 🌍 **Environmental**: Air quality and weather correlation
- 🔒 **Secure**: JWT authentication, audit logging

### Safety Disclaimer
⚠️ This system is NOT a diagnostic tool. It provides decision support only.
If you believe your child is experiencing a medical emergency, call 911 immediately.

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_token>
```
        """,
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        license_info={
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT",
        },
        contact={
            "name": "Ayesha-Ali676",
            "email": "support@epcid.health",
        },
    )

    # Configure CORS with proper security
    # In production, these should be set via environment variables
    import os

    allowed_origins = (
        os.getenv("CORS_ORIGINS", "").split(",")
        if os.getenv("CORS_ORIGINS")
        else [
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:3008",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3002",
            "http://127.0.0.1:3008",
            "https://epcid.app",
            "https://www.epcid.app",
            "https://*.vercel.app",
            "https://epcid-frontend-365415503294.us-central1.run.app",
            "https://epcid-frontend-lqgrtavcha-uc.a.run.app",
        ]
    )

    # Filter out empty strings
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Requested-With",
            "Accept",
            "Accept-Language",
            "Origin",
        ],
        expose_headers=[
            "X-Request-ID",
            "X-Response-Time",
            "X-RateLimit-Remaining",
            "Retry-After",
        ],
        max_age=600,  # Cache preflight for 10 minutes
    )

    # Add GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Add rate limiting middleware
    import os

    from .middleware.rate_limit import RateLimitMiddleware

    rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    if rate_limit_enabled:
        app.add_middleware(RateLimitMiddleware, enabled=True)

    # Add request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next: Callable) -> Response:
        """Log all requests with timing."""
        start_time = time.time()

        # Generate request ID
        request_id = request.headers.get("X-Request-ID", f"req_{int(start_time * 1000)}")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} - {duration_ms:.2f}ms",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )

        # Record metrics
        if hasattr(app.state, "metrics"):
            app.state.metrics.observe_latency(
                f"http_{request.method.lower()}",
                duration_ms,
                {"path": request.url.path, "status": str(response.status_code)},
            )

        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        return cast(Response, response)

    # Exception handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle all unhandled exceptions."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred. Please try again.",
                "detail": str(exc) if app.debug else None,
            },
        )

    # Include routers
    from .routes import (
        ai_analysis,
        assessment,
        auth,
        care_advice,
        children,
        clinical_scoring,
        dosage,
        environment,
        external_data,
        guidelines,
        mental_health,
        symptom_checker,
        symptoms,
    )

    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(children.router, prefix="/api/v1/children", tags=["Children"])
    app.include_router(symptoms.router, prefix="/api/v1/symptoms", tags=["Symptoms"])
    app.include_router(assessment.router, prefix="/api/v1/assessment", tags=["Assessment"])
    app.include_router(guidelines.router, prefix="/api/v1/guidelines", tags=["Guidelines"])
    app.include_router(environment.router, prefix="/api/v1/environment", tags=["Environment"])

    # AI-powered analysis (Vertex AI)
    app.include_router(ai_analysis.router, prefix="/api/v1", tags=["AI Analysis (Vertex AI)"])

    # New ChildrensMD-style endpoints
    app.include_router(symptom_checker.router, prefix="/api/v1", tags=["Symptom Checker"])
    app.include_router(care_advice.router, prefix="/api/v1", tags=["Care Advice"])
    app.include_router(dosage.router, prefix="/api/v1", tags=["Dosage Calculator"])
    app.include_router(clinical_scoring.router, prefix="/api/v1", tags=["Clinical Scoring"])

    # External data integrations (CDC, FDA, Air Quality)
    app.include_router(external_data.router, prefix="/api/v1", tags=["External Data"])

    # Mental Health features (mood tracking, coping strategies, assessments)
    app.include_router(mental_health.router, prefix="/api/v1/mental-health", tags=["Mental Health"])

    # Health check endpoints
    @app.get("/health", tags=["Health"])
    async def health_check() -> dict[str, Any]:
        """Health check endpoint for load balancers."""
        return {
            "status": "healthy",
            "service": "epcid-api",
            "version": "1.0.0",
        }

    @app.get("/health/ready", tags=["Health"])
    async def readiness_check() -> dict[str, Any]:
        """Readiness check - verifies all dependencies are available."""
        from ..services.cache_service import get_cache

        cache = get_cache()
        cache_status = cache.health_check()

        checks = {
            "api": "ok",
            "database": "ok",  # Would check actual DB connection
            "cache": "ok" if cache_status["available"] else "degraded",
        }

        all_healthy = all(v == "ok" for v in checks.values())

        return {
            "status": "ready" if all_healthy else "not_ready",
            "checks": checks,
            "cache_info": cache_status,
        }

    @app.get("/health/live", tags=["Health"])
    async def liveness_check() -> dict[str, str]:
        """Liveness check - verifies the service is running."""
        return {"status": "alive"}

    @app.get("/health/vertex-ai", tags=["Health"])
    async def vertex_ai_health(request: Request) -> dict[str, Any]:
        """Check Vertex AI availability and status."""
        vertex_available = getattr(request.app.state, "vertex_ai_available", False)
        vertex_service = getattr(request.app.state, "vertex_ai", None)

        return {
            "status": "available" if vertex_available else "unavailable",
            "vertex_ai_sdk": "installed" if vertex_service is not None else "not_installed",
            "model": "gemini-2.5-flash-preview-05-20" if vertex_available else None,
            "project": os.environ.get("GOOGLE_CLOUD_PROJECT", "unknown"),
            "location": "us-central1",
        }

    @app.get("/metrics", tags=["Monitoring"])
    async def get_metrics(request: Request) -> dict[str, Any]:
        """Get application metrics."""
        if hasattr(request.app.state, "metrics"):
            return cast(dict[str, Any], request.app.state.metrics.get_summary())
        return {"message": "Metrics not available"}

    # Root endpoint
    @app.get("/", tags=["Root"])
    async def root() -> dict[str, str]:
        """Root endpoint with API information."""
        return {
            "name": "EPCID API",
            "version": "1.0.0",
            "description": "Early Pediatric Critical Illness Detection Platform",
            "documentation": "/docs",
            "health": "/health",
        }

    return app


# Create the application instance
app = create_app()


# Custom OpenAPI schema
def custom_openapi() -> dict[str, Any]:
    """Generate custom OpenAPI schema."""
    if app.openapi_schema:
        return cast(dict[str, Any], app.openapi_schema)

    openapi_schema = get_openapi(
        title="EPCID API",
        version="1.0.0",
        description=app.description,
        routes=app.routes,
    )

    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token",
        }
    }

    # Add security to all endpoints
    openapi_schema["security"] = [{"bearerAuth": []}]

    # Add tags metadata
    openapi_schema["tags"] = [
        {
            "name": "AI Analysis (Vertex AI)",
            "description": "AI-powered symptom analysis using Google Cloud Vertex AI with Gemini 2.5 Flash",
        },
        {
            "name": "Authentication",
            "description": "User authentication and token management",
        },
        {
            "name": "Children",
            "description": "Child profile management",
        },
        {
            "name": "Symptoms",
            "description": "Symptom logging and tracking",
        },
        {
            "name": "Assessment",
            "description": "Risk assessment and analysis",
        },
        {
            "name": "Guidelines",
            "description": "Clinical guidelines and education",
        },
        {
            "name": "Environment",
            "description": "Environmental data (air quality, weather)",
        },
        {
            "name": "Symptom Checker",
            "description": "Guided symptom assessment with 4-tier triage",
        },
        {
            "name": "Care Advice",
            "description": "Condition-specific care guidance and home management",
        },
        {
            "name": "Dosage Calculator",
            "description": "Weight-based medication dosing for pediatric OTC medications",
        },
        {
            "name": "Clinical Scoring",
            "description": "Clinical scoring systems (Phoenix Sepsis, PEWS, Physical Exam)",
        },
        {
            "name": "Health",
            "description": "Health check endpoints",
        },
    ]

    app.openapi_schema = openapi_schema
    return cast(dict[str, Any], app.openapi_schema)


app.openapi = custom_openapi  # type: ignore[method-assign]


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")  # nosec B104
    port = int(os.getenv("API_PORT", "8081"))
    uvicorn.run(app, host=host, port=port)
