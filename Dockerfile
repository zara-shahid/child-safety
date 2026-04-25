# EPCID - Early Pediatric Critical Illness Detection
# Multi-stage Docker build for production deployment

# ==============================================================================
# Stage 1: Base image with Python
# ==============================================================================
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# ==============================================================================
# Stage 2: Builder - Install dependencies
# ==============================================================================
FROM base as builder

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ==============================================================================
# Stage 3: Production image
# ==============================================================================
FROM python:3.11-slim as production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PATH="/root/.local/bin:$PATH" \
    EPCID_ENV=production

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY config/ ./config/
COPY src/ ./src/
COPY examples/ ./examples/

# Create data directories
RUN mkdir -p data/logs data/synthetic data/knowledge_base data/checkpoints

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash epcid \
    && chown -R epcid:epcid /app
USER epcid

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${API_PORT:-8090}/health || exit 1

# Expose port
EXPOSE 8090

# Default command - run the API server
CMD ["sh", "-c", "uvicorn src.api:app --host 0.0.0.0 --port ${API_PORT:-8090}"]

# ==============================================================================
# Stage 4: Development image
# ==============================================================================
FROM production as development

# Switch back to root for dev dependencies
USER root

# Install development dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir pytest pytest-asyncio pytest-cov black isort mypy ruff

# Install the package in editable mode
COPY pyproject.toml .
RUN pip install -e .

# Switch back to non-root user
USER epcid

# Override command for development
CMD ["sh", "-c", "uvicorn src.api:app --host 0.0.0.0 --port ${API_PORT:-8090} --reload"]

# ==============================================================================
# Stage 5: Test image
# ==============================================================================
FROM development as test

# Copy tests
COPY tests/ ./tests/

# Switch to root to run tests
USER root

# Run tests by default
CMD ["pytest", "tests/", "-v", "--cov=src", "--cov-report=term-missing"]
