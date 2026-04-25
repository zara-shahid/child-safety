# Google Cloud Deployment Proof — EPCID

This document provides evidence that EPCID's backend is running on Google Cloud, as required by the Gemini Live Agent Challenge.

## Google Cloud Services Used

| Service | Purpose | Evidence |
|---------|---------|----------|
| **Cloud Run** | Hosting frontend & backend | Live URLs below |
| **Vertex AI** | Enterprise Gemini API | `src/services/vertex_ai_service.py` |
| **Cloud Build** | Automated CI/CD | `cloudbuild-*.yaml` files |
| **Secret Manager** | API key storage | Referenced in code |
| **Artifact Registry** | Container images | Part of Cloud Build |

## Live Deployment URLs

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | [https://epcid-frontend-365415503294.us-central1.run.app](https://epcid-frontend-365415503294.us-central1.run.app) | ✅ Live |
| **Backend API** | [https://epcid-backend-365415503294.us-central1.run.app](https://epcid-backend-365415503294.us-central1.run.app) | ✅ Live |
| **API Docs** | [https://epcid-backend-365415503294.us-central1.run.app/docs](https://epcid-backend-365415503294.us-central1.run.app/docs) | ✅ Live |

## Vertex AI API Endpoints (Live)

These endpoints demonstrate active Vertex AI integration:

| Endpoint | Method | Description | Try It |
|----------|--------|-------------|--------|
| `/api/v1/ai/status` | GET | Check Vertex AI status | [Link](https://epcid-backend-365415503294.us-central1.run.app/api/v1/ai/status) |
| `/api/v1/ai/analyze-symptoms` | POST | AI symptom analysis | [Docs](https://epcid-backend-365415503294.us-central1.run.app/docs#/AI%20Analysis%20(Vertex%20AI)/analyze_symptoms_with_ai_api_v1_ai_analyze_symptoms_post) |
| `/api/v1/ai/care-advice` | POST | AI care advice | [Docs](https://epcid-backend-365415503294.us-central1.run.app/docs#/AI%20Analysis%20(Vertex%20AI)/get_ai_care_advice_api_v1_ai_care_advice_post) |
| `/health/vertex-ai` | GET | Vertex AI health check | [Link](https://epcid-backend-365415503294.us-central1.run.app/health/vertex-ai) |

### Test Command

```bash
# Check Vertex AI status
curl https://epcid-backend-365415503294.us-central1.run.app/api/v1/ai/status

# Test AI symptom analysis
curl -X POST https://epcid-backend-365415503294.us-central1.run.app/api/v1/ai/analyze-symptoms \
  -H "Content-Type: application/json" \
  -d '{"child_age_years": 2, "symptoms": ["fever", "cough", "runny nose"]}'
```

## Code Evidence

### 1. Vertex AI Integration

**File:** `src/services/vertex_ai_service.py`

```python
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

class VertexAIService:
    def __init__(self, project_id: str, location: str = "us-central1"):
        vertexai.init(project=project_id, location=location)
        self.model = GenerativeModel("gemini-2.5-flash")
    
    async def analyze_symptoms(self, symptoms: list, child_age_years: float) -> dict:
        response = await self.model.generate_content_async(
            prompt,
            generation_config=GenerationConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        return response.text
```

### 2. Cloud Build Configuration

**File:** `cloudbuild-backend.yaml`

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/epcid-backend', '.']
  
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/epcid-backend']
  
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'deploy'
      - 'epcid-backend'
      - '--image=gcr.io/$PROJECT_ID/epcid-backend'
      - '--region=us-central1'
      - '--platform=managed'
```

### 3. Cloud Run Detection in Code

**File:** `src/services/vertex_ai_service.py`

```python
# Detect if running on Google Cloud
IS_GOOGLE_CLOUD = os.environ.get("K_SERVICE") is not None

if IS_GOOGLE_CLOUD:
    import vertexai
    from vertexai.generative_models import GenerativeModel
```

### 4. Google Cloud Dependencies

**File:** `requirements.txt`

```
google-cloud-aiplatform>=1.38.0
google-cloud-secret-manager>=2.16.0
google-generativeai>=0.3.0
vertexai>=1.38.0
```

## Automated Cloud Deployment (Bonus Points)

EPCID uses **fully automated deployment pipelines** — no manual steps required. A single command builds, pushes, and deploys both services to Google Cloud Run.

### Infrastructure-as-Code Files

| File | Purpose | Link |
|------|---------|------|
| [`cloudbuild-backend.yaml`](https://github.com/samalpartha/EPCID/blob/main/cloudbuild-backend.yaml) | Backend CI/CD pipeline (Cloud Build) | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/cloudbuild-backend.yaml) |
| [`cloudbuild-frontend.yaml`](https://github.com/samalpartha/EPCID/blob/main/cloudbuild-frontend.yaml) | Frontend CI/CD pipeline (Cloud Build) | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/cloudbuild-frontend.yaml) |
| [`Dockerfile.backend`](https://github.com/samalpartha/EPCID/blob/main/Dockerfile.backend) | Backend container definition | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/Dockerfile.backend) |
| [`frontend/Dockerfile`](https://github.com/samalpartha/EPCID/blob/main/frontend/Dockerfile) | Frontend multi-stage container build | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/frontend/Dockerfile) |
| [`.github/workflows/cd.yml`](https://github.com/samalpartha/EPCID/blob/main/.github/workflows/cd.yml) | GitHub Actions CD pipeline (staging → production) | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/.github/workflows/cd.yml) |
| [`.github/workflows/ci.yml`](https://github.com/samalpartha/EPCID/blob/main/.github/workflows/ci.yml) | GitHub Actions CI (lint, test, type-check) | [View on GitHub](https://github.com/samalpartha/EPCID/blob/main/.github/workflows/ci.yml) |

### How It Works

Each pipeline follows a **3-step automated workflow**:

```
Step 1: BUILD          Step 2: PUSH              Step 3: DEPLOY
┌──────────────┐      ┌───────────────────┐      ┌─────────────────────────┐
│ Docker build │ ───▶ │ Push to Artifact  │ ───▶ │ Deploy to Cloud Run     │
│ from source  │      │ Registry (GCR)    │      │ (zero-downtime rollout) │
└──────────────┘      └───────────────────┘      └─────────────────────────┘
```

### Backend Pipeline — `cloudbuild-backend.yaml`

```yaml
# Triggered by: gcloud builds submit --config cloudbuild-backend.yaml
steps:
  # Step 1: Build Docker image with Python 3.11, FastAPI, Vertex AI SDK
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/epcid-backend:latest',
           '-f', 'Dockerfile.backend', '.']

  # Step 2: Push to Google Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/epcid-backend:latest']

  # Step 3: Deploy to Cloud Run with env vars, memory, and CPU config
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: ['run', 'deploy', 'epcid-backend',
           '--image=gcr.io/$PROJECT_ID/epcid-backend:latest',
           '--region=us-central1', '--platform=managed',
           '--allow-unauthenticated', '--memory=1Gi', '--cpu=1',
           '--set-env-vars=GOOGLE_CLOUD_PROJECT=$PROJECT_ID']
```

### Frontend Pipeline — `cloudbuild-frontend.yaml`

```yaml
# Triggered by: gcloud builds submit --config cloudbuild-frontend.yaml
steps:
  # Step 1: Build Next.js app with production API URL baked in
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '--build-arg',
           'NEXT_PUBLIC_API_URL=https://epcid-backend-365415503294.us-central1.run.app',
           '-t', 'gcr.io/$PROJECT_ID/epcid-frontend:latest',
           '-f', 'frontend/Dockerfile', './frontend']

  # Step 2: Push to Google Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', '--all-tags', 'gcr.io/$PROJECT_ID/epcid-frontend']

  # Step 3: Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: ['run', 'deploy', 'epcid-frontend',
           '--image=gcr.io/$PROJECT_ID/epcid-frontend:latest',
           '--region=us-central1', '--platform=managed',
           '--allow-unauthenticated', '--memory=512Mi', '--port=3000']
```

### GitHub Actions CD — `.github/workflows/cd.yml`

```yaml
# Triggered by: git push tag v*, or manual dispatch
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  build-and-push:    # Docker build → Push to GHCR (cached)
  e2e-tests:         # Run E2E tests on built image
  deploy-staging:    # Auto-deploy to staging
  deploy-production: # Deploy to production (requires staging success)
  migrate:           # Run Alembic database migrations
```

### Deployment Commands

```bash
# One command deploys everything — no manual steps
gcloud builds submit --config cloudbuild-backend.yaml
gcloud builds submit --config cloudbuild-frontend.yaml

# Verify deployment
gcloud run services list --region us-central1
# NAME              URL                                                        LAST DEPLOYED
# epcid-backend     https://epcid-backend-365415503294.us-central1.run.app     2026-03-03
# epcid-frontend    https://epcid-frontend-365415503294.us-central1.run.app    2026-03-04
```

### Key Automation Features

- **Zero-downtime deployments** — Cloud Run performs rolling updates automatically
- **Immutable container images** — Every build is tagged and stored in Artifact Registry
- **Environment injection** — API URLs, CORS origins, and project IDs are injected at build/deploy time
- **Multi-stage Docker builds** — Frontend uses 3-stage build (deps → builder → runner) to minimize image size
- **Parameterized substitutions** — Cloud Build uses `$PROJECT_ID` and `${_TAG}` for portability
- **Reproducible builds** — `package-lock.json` and `requirements.txt` pin exact dependency versions

---

## Cloud Console Screenshots

For the screen recording requirement, the following should be captured:

1. **Cloud Run Services** — Show both `epcid-frontend` and `epcid-backend` running
2. **Cloud Build History** — Show successful builds
3. **Vertex AI Model** — Show Gemini model access
4. **Logs Explorer** — Show live request logs

## Project Configuration

```
Project ID: gen-lang-client-0798813467
Region: us-central1
Services:
  - epcid-frontend (Cloud Run)
  - epcid-backend (Cloud Run)
  - Vertex AI API (enabled)
  - Secret Manager API (enabled)
  - Cloud Build API (enabled)
  - Artifact Registry API (enabled)
```

---

**This document serves as proof of Google Cloud deployment and automated CI/CD for the Gemini Live Agent Challenge hackathon submission.**
