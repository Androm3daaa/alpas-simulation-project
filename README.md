# ALPAS — School Fire & Evacuation Simulation

**ALPAS** (Advanced Learning Platform for Assessing Safety) is a professional-grade fire and evacuation simulation platform for academic institutions. It combines agent-based evacuation modeling, fire dynamics principles, and interactive 2D/3D visualization to help evaluate school building safety before emergencies occur.

> [!TIP]
> **Quick Access for Evaluation**
> - **Final Documentation:** [docs/Project-Documentation.ALPAS.pdf](docs/Project-Documentation.ALPAS.pdf)
> - **Default Credentials:** Username: `admin` | Password: `admin`

---

## 📋 Evaluation Guide

This guide is intended for instructors and evaluators to set up and run the ALPAS simulation environment locally.

### 1. Prerequisites

Ensure the following are installed on your system:
- **Node.js (v18 or higher):** Required for the React frontend and project orchestration.
- **Python (v3.10 or higher):** Required for the FastAPI backend and simulation processing.
- **Modern Web Browser:** Chrome or Edge is recommended for optimal WebGL/3D performance.
- *(Optional)* **Ollama:** If you wish to run the AI Analyst using local LLMs for free (unlimited tokens).

### 2. Installation & Setup

To keep the submission package lightweight, dependencies must be installed manually:

#### A. Install Node.js Dependencies
Open your terminal in the project root directory and run:
```bash
# Install root orchestration tools (concurrently)
npm install

# Install frontend application packages
cd frontend && npm install && cd ..
```

#### B. Install Python Dependencies
The backend requires several data processing and web framework libraries:
```bash
pip install fastapi uvicorn pydantic pandas httpx
```

### 3. Running the Simulation

The easiest way to start the entire platform (Frontend + Backend) is using the root-level development command:

```bash
# From the project root directory
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:8000](http://localhost:8000)

**Note:** If you are running the backend separately, ensure it is on port `8000` as the frontend is configured to communicate with this specific endpoint.

---

## 🚀 Getting Started with the App

1. **Launch:** Click "Launch ALPAS Simulator" or "Get Started" on the landing page.
2. **Login:** Use the **"Login as Admin"** button for instant access.
3. **Configure:** Use the **Scenario Sidebar** on the dashboard.
   - *Default state:* Slow fire growth, 60 occupants, **No Mitigations** (baseline).
4. **Execute:** 
   - Click **"Run Quick Analysis"** for an instant deterministic result.
   - Explore the **3D View** and **Run History** to see detailed metrics.
5. **Analyze:** Use the **AI Analyst** (bottom right) to ask questions about the simulation results.

---

## 📂 Project Documentation

Detailed project information, including model design, mathematical foundations, and experimental results, can be found in the `docs/` folder:

- **📄 [Final Project Proposal (PDF)](docs/Project-Documentation.ALPAS.pdf):** The primary project documentation including objectives, methodology, and experimental results.
- **📝 [ALPAS Project Documentation (DOCX)](docs/ALPAS_Project_Documentation.docx):** An editable version of the technical documentation generated from the project's internal scripts.
- **📄 [Original Project Documentation (DOCX)](docs/ALPAS_Project_Documentation.docx):** Technical specifications and requirements.

---

## 🛠️ Tech Stack

- **Frontend:** React 19 (Vite), Three.js (React Three Fiber), Tailwind CSS, Chart.js.
- **Backend:** Python (FastAPI), Pandas (Data Analysis).
- **Simulators:** `alpasEngine.js` (Analytical), NIST FDS & JuPedSim (Computational).
- **AI Integration:** OpenAI, DeepSeek, and local Ollama support.

---

*Developed for the Polytechnic University of the Philippines — Parañaque City Campus as a DRRM Evacuation Planning System.*
