<div align="center">
  <img src="frontend/public/icons/icon-512x512.svg" alt="VitalKids Logo" width="100" />

  <h1>VitalKids</h1>
  <p><strong>Agentic AI Platform for Pediatric Health Monitoring</strong></p>

  <p>
    <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini 2.5" /></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js 14" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <img src="https://img.shields.io/badge/Response_Time-<800ms-00C896?style=for-the-badge" alt="<800ms" />
    <img src="https://img.shields.io/badge/Availability-24%2F7-blueviolet?style=for-the-badge" alt="24/7" />
  </p>

  <p><em>Category: Live Agents — Built for the <a href="https://geminiliveagentchallenge.devpost.com/">Hack-Nation Hackathon</a></em></p>

  <br />

  <blockquote>
    <strong>"Every smartphone should be an intelligent pediatric triage station."</strong>
  </blockquote>
</div>

---

## 🩺 The Problem

Pediatric critical illness is a silent crisis.

- **75,000+** children admitted to PICUs in the US annually — many cases preventable
- Parents delay care because they can't distinguish a mild fever from early sepsis
- Mainstream symptom checkers are built for adults, missing critical pediatric signals
- Rural and underserved communities have limited access to pediatric specialists

**VitalKids** bridges the gap between a parent's first worry and a clinician's expert judgment — turning any device into an always-on pediatric health co-pilot.

---

## ⚡ Why VitalKids is Different

| Capability | Traditional Tools | **VitalKids** |
|---|---|---|
| **Age Awareness** | Generic advice | Age-specific risk thresholds (neonate → adolescent) |
| **Clinical Scoring** | Basic symptom matching | Phoenix Sepsis validated algorithms (2024 criteria) |
| **Intelligence** | Static decision trees | Multi-agent AI with 8 specialized agents |
| **Response Time** | Minutes | <800ms with streaming |
| **Availability** | Business hours | 24/7 always-on |
| **Safety** | Single provider | Multi-provider fallback (Gemini → Groq → rule-based) |

---

## ✨ Key Features

### 🧠 8-Agent Clinical Architecture

Each agent handles a dedicated clinical domain, running in parallel for fast, accurate results.

```
┌─────────────────────────────────────────────────────────────┐
│                     VitalKids AI Core                       │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Agent 1     │  Agent 2     │  Agent 3     │  Agent 4       │
│  Phenotype   │  Sepsis      │  Vital       │  Drug Dosage   │
│  Extraction  │  Scoring     │  Trend       │  Calculator    │
│  (NLP)       │  (Phoenix)   │  Analysis    │  (Weight-safe) │
├──────────────┼──────────────┼──────────────┼────────────────┤
│  Agent 5     │  Agent 6     │  Agent 7     │  Agent 8       │
│  Age-Risk    │  Differential│  Escalation  │  Care          │
│  Thresholds  │  Diagnosis   │  Routing     │  Navigation    │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

### 👶 Age-Aware Risk Intelligence

VitalKids applies the correct clinical standards at every life stage — not a one-size-fits-all model.

- **Neonate** (0–28 days) — Heightened sensitivity, strict fever thresholds
- **Infant** (1–12 months) — Respiratory rate & feeding pattern analysis
- **Toddler** (1–3 years) — Behavioral and activity deviation scoring
- **Child** (3–12 years) — Vital sign trending with percentile-based alerts
- **Adolescent** (12–18 years) — Adult-adjacent thresholds with pediatric context

### 🔬 Phoenix Sepsis Scoring (2024 Criteria)

VitalKids implements the **latest Phoenix Sepsis criteria** — the same standard used in top PICUs — to identify life-threatening conditions before they escalate. Scores are computed in real time with streaming output so parents and providers see results as they're generated.

### 🛡️ Multi-Provider Safety Fallback

No single point of failure. If the primary AI provider is unavailable, VitalKids automatically cascades:

```
Gemini 2.5 Flash  →  Groq (Llama 3)  →  Rule-Based Engine
```

Clinical guidance is always available — even offline or in low-connectivity environments.

### 🏥 Hospital Trust & Verification System

Integrated directly into the multi-agent architecture:

- **Real-time facility scoring** — Dynamic Trust Scores penalize hospitals with missing capabilities, absent specialists, or stale data
- **Contradiction detection** — Flags dangerous inconsistencies (e.g., ICU listed but no ventilators on record)
- **Auto-escalation** — At `High` or `Critical` risk, the system surfaces the nearest verified facility automatically
- **Rural-aware routing** — Tested against underserved regions (Bihar, rural India) with distance-weighted recommendations

### 📊 Continuous Vital Monitoring

- Temperature, heart rate, SpO₂, and respiratory rate tracked over time
- Trend-based alerts — catches gradual deterioration, not just threshold breaches
- Parental log with annotated symptom history for clinical handoff

---

## 🏗️ Tech Stack

```
Frontend          Backend             AI & Data
─────────────     ─────────────────   ──────────────────────
Next.js 14        FastAPI (Python)    Gemini 2.5 Flash
Tailwind CSS      Vertex AI           Groq (fallback)
Zustand           PostgreSQL          Phoenix Sepsis Model
@google/genai     Redis               Pandas / Openpyxl
Framer Motion     Uvicorn             Custom NLP Pipeline
```

---

## 🛠️ Getting Started

You'll need **two terminal windows** — one for the backend, one for the frontend.

### Prerequisites

- Node.js v18+
- Python v3.10+
- A [Gemini API Key](https://aistudio.google.com/app/apikey)

---

### Step 1 — Start the Backend

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
# .\venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt
pip install openpyxl            # Required for dataset parsing

# Launch the API server
uvicorn src.api.main:app --reload --port 8081
```

### Step 2 — Start the Frontend

```bash
cd frontend

# Install packages
npm install

# Configure your API key
# Rename .env.example → .env.local and set:
# GEMINI_API_KEY=your_gemini_api_key_here

# Start the dev server
npm run dev
```

### Step 3 — Open the App

Navigate to **[http://localhost:3002](http://localhost:3002)** (or `3000` if `3002` is unavailable).

> 💡 **Try it out:** Go to the **Find Care** dashboard to see live Hospital Trust Scores and contradiction flags in action. Use the **"Test Rural Bihar"** button to simulate a low-resource environment.

---

## 📁 Project Structure

```
vitalkids/
├── frontend/               # Next.js 14 app
│   ├── src/app/dashboard/  # Dashboard pages (monitoring, find-care, history)
│   ├── src/components/     # Reusable UI components
│   └── src/store/          # Zustand state management
├── src/
│   ├── api/                # FastAPI routes & middleware
│   ├── agents/             # 8 specialized clinical agents
│   └── data/               # Facilities dataset & processing scripts
├── requirements.txt
└── README.md
```

---

## 🛡️ Safety & Disclaimer

VitalKids is designed for **informational and triage assistance purposes only**. It is not a substitute for professional medical advice, diagnosis, or treatment. In a medical emergency, call your local emergency services immediately.

- All clinical scoring follows published 2024 pediatric guidelines
- No patient data is stored or transmitted beyond your local session
- Multi-provider fallback ensures guidance is never completely unavailable

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

<div align="center">
  <p>Built with ❤️ for the <strong>Hack-Nation Hackathon</strong></p>
  <p><sub>Keeping kids safer, one vital sign at a time.</sub></p>
</div>
