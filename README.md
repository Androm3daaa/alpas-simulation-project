# ALPAS — School Fire & Evacuation Simulation

> [!IMPORTANT]
> **Grading / Quick Start Guide for Evaluation**
>
> To keep the submission package lightweight for email, the `node_modules` folders containing dependencies have been excluded from the zip file. Please follow these quick steps to install them and run the simulation:
>
> 1. **Install Node.js & Python dependencies**:
>    Open your terminal in the extracted folder and run:
>    ```bash
>    # Install root & launcher runner
>    npm install
>
>    # Install frontend packages
>    cd frontend && npm install && cd ..
>    ```
> 2. **Install Python backend packages**:
>    Ensure you have Python installed, then run:
>    ```bash
>    pip install fastapi uvicorn pydantic pandas httpx
>    ```
> 3. **Run the application**:
>    Start both the frontend and backend concurrently from the root directory:
>    ```bash
>    npm run dev
>    ```
>    * Frontend: `http://localhost:5173`
>    * Backend: `http://localhost:8000`


**ALPAS** (Advanced Learning Platform for Assessing Safety) is a professional-grade fire and evacuation simulation platform for school buildings.

> "To set free beyond fear and calamity"

It combines a fast in-browser analytical engine with high-fidelity NIST FDS + JuPedSim backend simulations, rich 2D/3D visualization, and an AI Analyst that can reason over run logs and metrics.

## Features

- **Dual-fidelity simulation**
  - **Quick Analysis** (client-side): Deterministic t² fire growth + agent-based evacuation with full multi-floor school layout, mitigations (sprinklers, fire doors, vents, AI signage, pressurized stairs), ASET/RSET, safety margin, and casualty estimates. Runs instantly.
  - **FDS + JuPedSim** (backend): Real CFD fire simulation (external `fds` binary) + microscopic pedestrian evacuation using JuPedSim.

- **Interactive 3D Reference Model**
  - High-quality school building GLB (imported from SketchUp) with floor filtering, X-ray mode, and synchronized replay from simulation runs.

- **Rich Visualization & Analysis**
  - Charts (HRR, visibility, temperature, CO, evacuation progress, congestion, mitigation comparison)
  - 2D floor plan live stepping
  - Run History with source badges (Quick vs FDS)

- **AI Analyst**
  - Chat with grounded answers using your simulation data + execution logs.
  - Supports: DeepSeek (recommended), local Ollama (free & unlimited), Gemini, Groq, xAI/Grok.

- **Mitigation Comparison**
  - One-click before/after analysis of safety improvements (the app now starts with mitigations **off** by default for a clean baseline).

## Project Structure

```
school-fire-sim/
├── assets/                  # Source GLB
├── backend/                 # FastAPI + FDS/JuPedSim orchestration + analysis
│   ├── main.py
│   ├── analysis.py
│   └── .env.example
├── frontend/                # React 19 + Vite + Three.js SPA
│   ├── src/
│   │   ├── lib/alpasEngine.js   # Core Quick simulation engine
│   │   ├── components/
│   │   └── ...
│   └── package.json
├── scripts/                 # Asset import pipeline (DAE → optimized GLB)
├── simulations/             # Runtime artifacts (gitignored)
└── docs/                    # Generated project documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- [NIST FDS](https://pages.nist.gov/fds-smv/) (for full backend runs)
- JuPedSim (pip)
- (Recommended) Ollama running locally for free AI Analyst

### One-command development (recommended)

From the project root, start **both** backend and frontend together:

```bash
npm run dev
```

- Backend logs appear prefixed in **blue**
- Frontend (Vite) logs appear prefixed in **green**
- Frontend will be available at **http://localhost:5173**
- Press `Ctrl+C` to stop both servers at once

This uses `concurrently` under the hood (installed at the root).

### Manual start (if you prefer separate terminals)

**Backend** (in one terminal):
```bash
cd backend
python3 -m uvicorn main:app --reload --port 8000
```

**Frontend** (in another terminal):
```bash
cd frontend
npm run dev
```

> The root `npm run dev` command is the easiest way during active development.

### Environment

Make sure you have a `backend/.env` file (copy from `backend/.env.example` and fill in your API keys, especially DeepSeek or run Ollama locally for the AI Analyst).

### First Simulation

1. Start the app with `npm run dev` (from project root).
2. On the landing page, use the top navigation **"Get Started"** or **"Login"** buttons (or the big orange "Launch ALPAS Simulator" button) to reach the authentication screen.
3. On the auth screen you can:
   - Click the prominent **"Login as Admin (admin / admin)"** button for instant access, or
   - Create a new account.
4. Configure your scenario on the Dashboard (defaults: **slow** growth rate + **no mitigations** enabled).
5. Run **Quick** analysis (instant) or trigger a full FDS + JuPedSim run.
6. Explore results in charts, 3D, Run History, and talk to the AI Analyst.

## Important Notes

- The app now starts with **slow** fire growth and **no mitigations** enabled by default. This provides a clean baseline for comparing mitigation strategies.
- Fire location now supports proper per-floor distinction (e.g. "Corridor · 3rd Floor" vs "Corridor · 2nd Floor").
- The FDS backend currently uses simplified geometry (documented in every analysis). Full school walls/rooms/stairs are future work.
- The 3D model is a reference/visual aid. Agent positions in 3D are mapped from the 2D analytical engine or JuPedSim results.

## Asset Pipeline

The school building model was imported from SketchUp (DAE) and optimized:

```bash
cd frontend
npm run import-building          # or import-building-blend
npm run prune-building
```

Requires `assimp` and `@gltf-transform/cli`.

## Documentation

See `docs/ALPAS_Project_Documentation.docx` (generated from the structured template in `scripts/generate-alpas-doc.js`).

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind, React Three Fiber + Drei, Three.js, Chart.js, Framer Motion, Lucide icons
- **Backend**: FastAPI, Pandas, JuPedSim + Shapely, subprocess FDS
- **AI**: DeepSeek / Ollama / Gemini / Groq / xAI (pluggable, context-grounded)

## Contributing

This project was developed as part of academic/research work on fire safety simulation and AI-assisted analysis. Issues and PRs are welcome.

## License

Internal / academic use. Contact the authors for other licensing.

---

Built with care for better preparedness.
