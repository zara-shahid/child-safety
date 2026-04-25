# EPCID — Early Pediatric Critical Illness Detection

<div align="center">
  <img src="frontend/public/icons/icon-512x512.svg" alt="EPCID Logo" width="120" />
  
  ### **Agentic AI Platform for Pediatric Health Monitoring**
  
  **Category: Live Agents** | Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/)
  
  [![Gemini 2.5](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
  [![Next.js 14](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
</div>

---

## 🚀 The Vision

Pediatric critical illness is a silent crisis. Every year, over 75,000 children are admitted to pediatric intensive care units (PICUs) in the US, and many of those cases were preventable. Parents often delay care due to uncertainty, and traditional adult-centric symptom checkers fail to identify critical pediatric conditions.

**EPCID** is an agentic AI platform that bridges the gap between a parent's first concern and a clinician's expert assessment. By leveraging advanced clinical models and a multi-agent backend architecture, EPCID turns every smartphone into an intelligent pediatric triage station.

---

## ✨ Key Features


### 🏥 NEW: Hospital Trust & Verification System
We integrated an expansive **Facilities Dataset** directly into our multi-agent architecture!
- **Agent #9 (Facility Verification):** Evaluates nearby hospitals in real-time.
- **Dynamic Trust Scores:** Automatically penalizes facilities with missing capabilities, absent doctors, or outdated data.
- **Contradiction Detection:** The AI spots dangerous inconsistencies (e.g., claiming to have an ICU but lacking Ventilators) and flags them in the UI.
- **Auto-Escalation:** Automatically searches and suggests highly verified, top-scoring facilities when a child's risk level reaches `High` or `Critical`.

### 🧠 9-Agent Clinical Architecture
- Extracts clinical phenotypes using Natural Language Processing.
- Computes **Phoenix Sepsis Scores** (2024 Criteria).
- Tracks vital trends and calculates pediatric drug dosages safely.

---

## 🏗️ Tech Stack

- **AI Model:** Gemini 2.5 Flash
- **Frontend:** Next.js 14, Tailwind CSS, Zustand, @google/genai SDK
- **Backend:** FastAPI, Python, Vertex AI
- **Data:** PostgreSQL, Redis, Pandas/Openpyxl (for dataset processing)

---

## 🛠️ Getting Started (How to Run)

Follow these simple steps to run the application on your local machine. You will need two terminal windows: one for the backend and one for the frontend.

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- A [Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Start the Backend (FastAPI)
Open your first terminal and navigate to the project root:

```bash
# Create and activate a virtual environment
python -m venv venv
# On Windows: .\venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate

# Install all necessary dependencies
pip install -r requirements.txt
pip install openpyxl  # Required for dataset parsing

# Start the Python server
uvicorn src.api.main:app --reload --port 8081
```

### 2. Start the Frontend (Next.js)
Open your second terminal and navigate to the `frontend` folder:

```bash
cd frontend

# Install necessary node packages
npm install

# Add your Gemini API Key
# Rename .env.example to .env.local and add your key:
# GEMINI_API_KEY=your_gemini_api_key_here

# Start the Next.js frontend
npm run dev
```

### 3. View the App
- Open **[http://localhost:3002](http://localhost:3002)** in your browser. (The port may default to 3000 if 3002 is not specified).
- Test the new features by navigating to the **Find Care** dashboard to see real-time hospital Trust Scores and warning flags!

---

## 🛡️ Safety Disclaimer
*EPCID is designed for informational and triage assistance purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a healthcare provider for medical emergencies.*

Built with ❤️ for the Gemini Live Agent Challenge!
