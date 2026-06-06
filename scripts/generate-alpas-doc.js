/**
 * Generate ALPAS (school-fire-sim) project documentation per PUP template structure.
 * Run: node scripts/generate-alpas-doc.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  LevelFormat,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  PageBreak,
} = require("docx");

const OUT = path.join(__dirname, "..", "docs", "ALPAS_Project_Documentation.docx");
const CONTENT_W = 9360;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: opts.spacing || { after: 160 },
    alignment: opts.align,
    children: [new TextRun({ text, size: opts.size || 24, bold: opts.bold, italics: opts.italics })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}

function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}

function tocEntry(text, level = 0) {
  return new Paragraph({
    spacing: { after: level === 0 ? 80 : 36 },
    indent: { left: level * 360 },
    children: [new TextRun({ text, size: 22, bold: level === 0 })],
  });
}

function table(rows, colWidths) {
  const w = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: w, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((cells, ri) =>
      new TableRow({
        children: cells.map((text, ci) =>
          new TableCell({
            borders,
            width: { size: colWidths[ci], type: WidthType.DXA },
            shading: {
              fill: ri === 0 ? "D5E8F0" : "FFFFFF",
              type: ShadingType.CLEAR,
            },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text, size: 22, bold: ri === 0 })] })],
          })
        ),
      })
    ),
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "000000" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "POLYTECHNIC UNIVERSITY OF THE PHILIPPINES",
                  bold: true,
                  size: 20,
                }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8B0000", space: 4 } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "ALPAS — School Fire & Evacuation Simulation  |  Page ", size: 20 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 20 }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Title page
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 2400, after: 400 },
          children: [
            new TextRun({
              text: "POLYTECHNIC UNIVERSITY OF THE PHILIPPINES",
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: "ALPAS",
              bold: true,
              size: 56,
              color: "8B0000",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "School Fire and Evacuation Simulation Platform",
              size: 32,
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "To set free beyond fear and calamity",
              size: 24,
              color: "555555",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200, after: 200 },
          children: [new TextRun({ text: "Project Documentation", size: 36, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "school-fire-sim Application", size: 28 })],
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // TOC — static list to match PUP template (populated, visible in PDF/print)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: "TABLE OF CONTENTS:", bold: true, size: 32 })],
        }),
        tocEntry("1. Project Overview and Objectives"),
        tocEntry("1.1. Overview", 1),
        tocEntry("1.2. Objectives", 1),
        tocEntry("1.3. Scope and Limitations", 1),
        tocEntry("1.4. Target Audience and Stakeholders", 1),
        tocEntry("2. Model Design"),
        tocEntry("2.1. Simulation Type", 1),
        tocEntry("2.1.1. Conceptual Model (Overview Diagram)", 2),
        tocEntry("2.1.2. Process Flow", 2),
        tocEntry("2.1.3. Mathematical Models", 2),
        tocEntry("2.2. Variables and Parameters", 1),
        tocEntry("2.3. Assumptions", 1),
        tocEntry("2.4. Data Requirements", 1),
        tocEntry("3. Functional Specifications"),
        tocEntry("3.1. Functional Requirements", 1),
        tocEntry("3.2. User Interface (UI) Requirements", 1),
        tocEntry("3.2.1. Input Controls", 2),
        tocEntry("3.2.2. Runtime Controls", 2),
        tocEntry("3.2.3. Data Visualization", 2),
        tocEntry("3.3. Outputs", 1),
        tocEntry("4. Technical Specifications"),
        tocEntry("4.1. Technology Stack", 1),
        tocEntry("4.2. Data Structures", 1),
        tocEntry("4.3. Random Number Generation", 1),
        tocEntry("5. Verification and Validation"),
        tocEntry("5.1. Verification Plan", 1),
        tocEntry("5.2. Validation Plan", 1),
        tocEntry("5.3. Sensitivity Analysis", 1),
        tocEntry("6. Experimentation and Results"),
        tocEntry("6.1. Scenarios Tested", 1),
        tocEntry("6.2. Results and Analysis", 1),
        tocEntry("7. Conclusion and Recommendation"),
        tocEntry("APPENDICES"),
        new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
        new Paragraph({ children: [new PageBreak()] }),

        // --- Section 1 ---
        h1("1. Project Overview and Objectives"),
        h2("1.1. Overview"),
        p(
          "ALPAS (Advanced Learning Platform for Assessing Safety) is a professional-grade fire and evacuation simulation platform developed as the school-fire-sim web application. The system combines agent-based evacuation modeling, fire dynamics principles (heat release rate growth, visibility, temperature, and carbon monoxide), and interactive 2D/3D visualization to help researchers, engineers, and safety professionals evaluate school building scenarios before real emergencies occur."
        ),
        p(
          "The application targets a four-storey school building model with a waiting area on the ground floor, classrooms on floors 2–4, corridors, restrooms, stairwells, and multiple exits. Users configure fire origin, occupant load, walking speed, pre-movement delay, mitigation systems (sprinklers, fire doors, smoke vents, wider exits, AI signage, pressurized stairs), and run either a fast in-browser analytical model (Quick analysis) or a backend workflow coupling NIST Fire Dynamics Simulator (FDS) with JuPedSim pedestrian evacuation."
        ),
        h2("1.2. Objectives"),
        bullet("Provide clarity: replace panic with understanding through rigorous simulation of fire dynamics and human behavior."),
        bullet("Build courage: enable preparation through repeatable what-if scenarios and mitigation comparisons."),
        bullet("Restore control: support better design, training, and mitigation strategies via measurable ASET/RSET margins."),
        bullet("Deliver dual fidelity: Quick client-side analysis for teaching and demos; FDS+JuPedSim runs for research-grade artifacts."),
        bullet("Integrate AI-assisted interpretation of run logs and metrics through the AI Analyst module."),
        h2("1.3. Scope and Limitations"),
        p(
          "In scope: parameter-driven fire and evacuation analysis; 2D floor-plan and 3D GLB building visualization; run history and logs; mitigation comparison; chat-based results analysis. Known limitations (documented in backend analysis): FDS inputs currently use minimal geometry (single fire OBST in a large domain, not full school walls/rooms); JuPedSim uses a flat 2D rectangle without multi-floor vertical movement matching the floor plan; no per-agent FED/toxicity or visibility-based speed changes in the backend path yet. The Quick analysis model is deterministic and pedagogical rather than a certified life-safety engineering tool."
        ),
        h2("1.4. Target Audience and Stakeholders"),
        bullet("School administrators and safety officers planning drills and egress improvements."),
        bullet("Fire protection and civil engineering students (capstone/thesis simulation projects)."),
        bullet("Researchers comparing mitigation strategies (sprinklers, fire doors, ventilation)."),
        bullet("Developers extending the React frontend, FastAPI backend, or simulation engines."),

        // --- Section 2 ---
        h1("2. Model Design"),
        h2("2.1. Simulation Type"),
        p(
          "ALPAS implements a hybrid simulation architecture: (A) a discrete-time analytical coupled fire–evacuation model in the browser (alpasEngine.js), and (B) an asynchronous server workflow executing FDS for hazard fields followed by JuPedSim for pedestrian motion, with post-processing in analysis.py."
        ),
        h3("2.1.1. Conceptual Model (Overview Diagram)"),
        p(
          "Conceptual data flow: User configures scenario in Dashboard (ScenarioSidebar) → SimulationContext stores params → Quick path: computeSimulation() returns metrics, time series, floor breakdown, optional live agent trajectories (live 2D stepping) → Results pushed to 3D viewer and AI Analyst. FDS path: POST /simulation/run (API) → generate_fds_file + subprocess fds + run_jupedsim → evacuation_results.csv + analysis.json + run.log (loadable via /simulations + /simulation/results/{id})."
        ),
        table(
          [
            ["Layer", "Component", "Role"],
            ["Presentation", "React + Vite + Tailwind", "Dashboard, 3D viewer, logs, chat"],
            ["Client engine", "alpasEngine.js", "HRR, ASET/RSET, mitigation comparison"],
            ["API", "FastAPI (main.py)", "Run orchestration, persistence, AI chat"],
            ["Physics (server)", "FDS + JuPedSim", "CFD fire + microscopic evacuation"],
            ["Storage", "simulations/{uuid}/", "config, CSV, analysis, logs"],
          ],
          [2200, 2800, 4360]
        ),
        h3("2.1.2. Process Flow"),
        table(
          [
            ["Step", "Quick Analysis", "FDS + JuPedSim Run"],
            ["1", "User sets params & clicks Run (Quick path)", "POST /simulation/run (FDS path; API or external; UI loads prior runs via /simulations)"],
            ["2", "computeSimulation(params)", "Background: generate_fds_file()"],
            ["3", "Charts & metrics render", "subprocess: fds school_{id}.fds"],
            ["4", "Optional sync to server", "run_jupedsim() → evacuation_results.csv"],
            ["5", "Push to 3D / AI Analyst", "generate_analysis() → analysis.json"],
          ],
          [1200, 4080, 4080]
        ),
        h3("2.1.3. Mathematical Models"),
        p("Fire growth (t-squared, client engine): HRR(t) = α·t² until peak time t_peak = √(HRR_peak·10⁶/α), then exponential decay. Growth rates map to α: ultra 0.19, fast 0.047, medium 0.012, slow 0.003 kW/s²."),
        p("Sprinkler activation: RTI-based estimate spActTime from setpoint temperature, ambient temperature, and current HRR; after activation, HRR is reduced by a suppression factor."),
        p("Temperature: plume approximation using convective fraction of HRR, ceiling height H=3 m; scaled by fire-door (×0.75) and vent/window factors."),
        p("Visibility: Drysdale-style extinction K_ext = 7000·C_s with soot yield and compartment volume; mitigations adjust limits."),
        p("ASET: first time index where visibility < limit, temperature > limit, or CO > limit (limits depend on active mitigations)."),
        p("RSET: pre_movement_delay + travel_time, where travel_time scales with occupant count, walking speed × panic factor × population profile, stair factor by floors below origin, and egress aids (wider exits, AI signage, pressurized stairs)."),
        p("Safety margin = ASET − RSET; success rate and casualties derived from margin for teaching comparisons."),
        h2("2.2. Variables and Parameters"),
        table(
          [
            ["Parameter", "Symbol / Key", "Default", "Description"],
            ["Peak HRR", "hrr", "1.2 MW", "Fire size (client); hrr_peak in FDS (kW)"],
            ["Growth rate", "growth", "medium", "ultra / fast / medium / slow"],
            ["Occupants", "occ", "60", "Whole-building headcount"],
            ["Walking speed", "speed", "1.15 m/s", "Base pedestrian speed"],
            ["Pre-movement delay", "delay", "45 s", "Alarm recognition & reaction"],
            ["Fire location", "fireLocation", "corridor", "Room/waiting/stairwell ID"],
            ["Origin room", "occupantRoom", "r304", "Default occupant spawn (3rd floor)"],
            ["Soot / CO yield", "soot, co", "0.05, 0.03", "Combustion products"],
            ["Mitigations", "mit.*", "various", "sprinkler, fdr, vents, wider, aiSign, press"],
          ],
          [2200, 2200, 1600, 3360]
        ),
        h2("2.3. Assumptions"),
        bullet("Four-storey school floor plan with normalized 420×310 px geometry per floor."),
        bullet("Occupants distributed evenly across floors unless live evacuation assigns per-floor agents."),
        bullet("Homogeneous compartment volume (8×8×3 m) for soot/CO concentration in Quick model."),
        bullet("Collision-free speed model in JuPedSim; rectangular walkable domain from calibrated footprint."),
        bullet("FDS run duration T_END=60 s with simplified fuel surface and device probes at 1.8 m height."),
        h2("2.4. Data Requirements"),
        bullet("User inputs: scenario parameters via dashboard controls."),
        bullet("Building asset: school_building.glb (SketchUp DAE import) with buildingCalibration.json."),
        bullet("Server outputs: *_hrr.csv, *_devc.csv, evacuation_results.csv, analysis.json, run.log."),
        bullet("Optional API keys: DeepSeek, Gemini, Groq, OpenRouter, xAI, or local Ollama for AI Analyst."),

        // --- Section 3 ---
        h1("3. Functional Specifications"),
        h2("3.1. Functional Requirements"),
        bullet("Authenticate users (local auth context) and present landing, dashboard, 3D, runs/logs, AI views."),
        bullet("Run Quick analysis with deterministic results in under one second."),
        bullet("Load and poll prior FDS-backed runs via /simulations and /simulation/results/{id}; FDS runs started via POST /simulation/run (API)."),
        bullet("Compare mitigation scenarios (baseline vs current vs single-strategy toggles)."),
        bullet("Persist client quick runs via POST /simulation/client-run."),
        bullet("Chat with AI Analyst using run context (metrics, logs, limitations)."),
        h2("3.2. User Interface (UI) Requirements"),
        h3("3.2.1. Input Controls"),
        p(
          "ScenarioSidebar provides fire location dropdown (16 locations across floors), sliders for HRR, soot, CO, occupants, speed, delay, growth rate, panic level, population profile, sprinkler setpoint/RTI, and toggles for doors, windows, HVAC, vents, and mitigation checkboxes. AlpasDashboard hosts charts and run actions."
        ),
        h3("3.2.2. Runtime Controls"),
        p(
          "SimulationCommandCenter and FloorPlanViewer support live evacuation stepping (EVAC_WALL_MS_PER_SIM_SEC accelerated clock). 3D SimulationViewer offers floor filter, replay timeline, X-ray mode, and push-from-dashboard workflow. RunsAndLogs lists historical runs with labels and source badges (Quick vs FDS)."
        ),
        h3("3.2.3. Data Visualization"),
        p(
          "Chart.js / react-chartjs-2 plots for HRR, temperature, visibility, CO, evacuation progress, and congestion. SituationBoard2D and FloorPlanViewer render room states. MitigationComparisonPanel shows ASET/RSET margin gains. 3D scene uses React Three Fiber with school GLB, sprinklers, and alarm markers."
        ),
        h2("3.3. Outputs"),
        bullet("Metrics: ASET, RSET, safety margin, success rate %, casualties, FED estimate."),
        bullet("Time series: T, hrr, temp, vis, co, evacSeries, congSeries."),
        bullet("Per-floor status: occupancy, evacuees, casualties, temp/CO/vis, SAFE/WARNING/DANGER."),
        bullet("Artifacts: analysis.json, analysis_report.md, client_results.json, run.log."),

        // --- Section 4 ---
        h1("4. Technical Specifications"),
        h2("4.1. Technology Stack"),
        table(
          [
            ["Tier", "Technologies"],
            ["Frontend", "React 19, Vite 8, Tailwind CSS, Three.js, @react-three/fiber, Chart.js, Lucide icons"],
            ["Backend", "Python 3, FastAPI, Uvicorn, Pandas, JuPedSim, subprocess FDS"],
            ["Simulation", "NIST FDS, JuPedSim (CollisionFreeSpeedModel), client alpasEngine"],
            ["AI", "analysis.py — DeepSeek primary, Ollama (free local), Gemini, Groq, OpenRouter, xAI/Grok fallbacks"],
            ["Assets", "GLB building model, Firebase-ready auth scaffold"],
          ],
          [2800, 6560]
        ),
        h2("4.2. Data Structures"),
        bullet("SimulationConfig (Pydantic): hrr_peak, growth_rate, soot_yield, occupant_count, walking_speed, pre_movement_delay, mitigation dict."),
        bullet("DEFAULT_PARAMS / normalized params (JS): nested mit object synced with sprinkler, fdr, vents flags."),
        bullet("FLOORS array: rooms with x,y,w,h, type, id; exits and sprinkler coordinates per floor."),
        bullet("computeSimulation result: T[], series arrays, floorData[], trajectory-capable agent state."),
        bullet("analysis.json: metrics, hazard_series, evac_stats, narrative_summary, limitations[], data_quality."),
        h2("4.3. Random Number Generation"),
        p(
          "Quick live evacuation uses Math.random() for initial agent positions within spawn rooms (randomPointInRoom). The analytical computeSimulation path is deterministic for fixed parameters. JuPedSim agent placement uses a deterministic grid from occupant index. FDS and analytical HRR curves are deterministic given configuration; stochastic crowd behavior is approximated via panic and profile multipliers rather than RNG streams."
        ),

        // --- Section 5 ---
        h1("5. Verification and Validation"),
        h2("5.1. Verification Plan"),
        bullet("Unit-level checks: normalizeParamsFromServer maps API config to dashboard shape."),
        bullet("Engine sanity: mitigation comparison must show marginGain ≥ 0 when sprinklers+FDR+vents enabled in demo scenarios."),
        bullet("Backend: FDS return code logged; analysis parses *_hrr.csv and *_devc.csv columns."),
        bullet("Frontend: ErrorBoundary catches render failures; simulation context retries client-run sync."),
        h2("5.2. Validation Plan"),
        bullet("Compare Quick ASET/RSET trends against published t-squared fire curves for medium growth."),
        bullet("Cross-check FDS peak HRR from CSV against configured hrr_peak."),
        bullet("Review JuPedSim evacuation time vs occupant count and desired_speed sensitivity."),
        bullet("Document limitations in analysis.json until full school geometry is modeled in FDS/JuPedSim."),
        h2("5.3. Sensitivity Analysis"),
        p(
          "Built-in MitigationComparisonPanel re-runs computeSimulation for baseline (no mitigations), current configuration, and each single mitigation in isolation. Users vary HRR, growth rate, occupant count, delay, and fire location to observe margin and casualty changes. Recommended classroom scenarios: corridor fire with 60 students from Room 304; waiting-area fire with sprinklers off vs on."
        ),

        // --- Section 6 ---
        h1("6. Experimentation and Results"),
        h2("6.1. Scenarios Tested"),
        bullet("Default demo: 60 occupants, medium growth, 1.2 MW, fire in corridor, origin Room 304, mitigations on."),
        bullet("High-load stress: increased occ and fast growth with mitigations disabled (baseline)."),
        bullet("Location sweep: waiting area vs classroom vs stairwell fire origins."),
        bullet("FDS pipeline: backend-generated school_{uuid}.fds with 40 agents, 60 s horizon."),
        h2("6.2. Results and Analysis"),
        p(
          "Quick analysis typically shows improved safety margin when sprinklers, fire doors, and smoke vents are combined; the mitigation narrative in computeMitigationComparison quantifies margin gain in seconds and casualty reduction. FDS runs produce device CSV series for visibility and temperature; ASET is estimated when visibility < 10 m or temperature > 60°C at the probe. AI Analyst consumes analysis.json and run.log to summarize findings for non-technical stakeholders."
        ),

        // --- Section 7 ---
        h1("7. Conclusion and Recommendation"),
        p(
          "ALPAS successfully integrates educational clarity with extensible simulation infrastructure. The Quick engine enables immediate classroom demonstrations of ASET/RSET and mitigation value; the FDS+JuPedSim backend provides a path toward higher-fidelity validation as school geometry is imported into CFD and multi-floor evacuation models."
        ),
        p(
          "Recommendations: (1) import full floor plans into FDS OBST and VENT networks; (2) align JuPedSim geometry with per-floor graphs and stair delays; (3) calibrate analytical α and suppression factors against FDS outputs; (4) add export to PDF/DOCX for institutional reporting; (5) conduct live drill comparison studies with timed evacuation exercises."
        ),

        new Paragraph({
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: "APPENDICES", bold: true, size: 28 })],
        }),
        h2("Appendix A — API Endpoints"),
        bullet("GET / — backend health"),
        bullet("POST /simulation/run — start FDS + JuPedSim workflow (background task)"),
        bullet("POST /simulation/client-run — persist Quick (client-side) analysis result + metadata"),
        bullet("GET /simulation/client-run/{sim_id} — retrieve saved Quick run payload"),
        bullet("GET /simulation/results/{sim_id} — poll status/results for backend (FDS) run"),
        bullet("GET /simulations — list recent saved runs (run history; used by UI)"),
        bullet("GET /simulation/logs/{sim_id} — fetch per-run execution log (run.log)"),
        bullet("GET /simulation/analysis/{sim_id} — fetch structured analysis.json + metrics"),
        bullet("POST /simulation/analyze — AI Analyst chat (grounded multi-turn Q&A)"),
        bullet("DELETE /simulations — clear all saved simulation artifacts"),
        h2("Appendix B — Project Structure"),
        bullet("frontend/src — React components, alpasEngine, contexts"),
        bullet("backend/ — FastAPI main.py, analysis.py"),
        bullet("simulations/ — per-run UUID directories"),
        bullet("assets/ — school_building.glb"),
        h2("Appendix C — Default Mitigation Configuration"),
        p(
          "sprinkler: true, fdr: true, vents: true, wider: true, aiSign: true, press: true, pcm: false — as defined in DEFAULT_PARAMS in alpasEngine.js."
        ),
      ],
    },
  ],
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUT, buffer);
  console.log("Wrote", OUT);
});