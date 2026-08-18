# 🌌 Orchnex — Dual-LLM Orchestration & Grounded Intelligence Engine

Orchnex is a full-stack dual-LLM orchestration platform designed to eliminate hallucinations, enforce prompt precision, and provide real-time side-by-side prompt output comparisons.

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph UI ["Modern Next.js Frontend (Port 3000)"]
        User["User Query Input"] --> Progress["Real-Time Step Progress Bar (0-100%)"]
        User --> SideBySide["Side-by-Side Comparison UI"]
    end

    subgraph Backend ["FastAPI Backend Engine (Port 8000)"]
        User --> API["/api/generate Endpoint"]
        
        subgraph Stage1 ["Stage 1: Prompt Enhancement & Validation"]
            Scanner["ProjectContextScanner"] --> PromptMaster["PromptMaster 4.0 (<analysis> scratchpad)"]
            API --> Scanner
            PromptMaster --> Validator["validator.py (Quality Gate Regex & Schema)"]
            Validator -- "Fail / Retries" --> PromptMaster
        end

        subgraph Stage2 ["Stage 2: Dual Generation Engine"]
            API --> BaselineGen["Baseline LLM (Raw Query)"]
            Validator -- "Pass (enhanced_prompt)" --> PhoenixGen["Phoenix LLM (Enhanced Spec)"]
        end

        subgraph Stage3 ["Stage 3: Grounding & Hallucination Prevention"]
            PhoenixGen --> Detector["HallucinationDetector (NLI)"]
            Detector --> ClaimExtract["1. Extract Atomic Claims"]
            ClaimExtract --> NLI["2. Batch NLI Verification (SUPPORTED / CONTRADICTED / NEUTRAL)"]
        end
    end

    BaselineGen --> SideBySide
    PhoenixGen --> SideBySide
    NLI --> SideBySide
```

---

## ✨ Key Features

1. **PromptMaster 4.0 Reasoning Engine**:
   - Executes a two-phase XML reasoning process: `<analysis>` scratchpad followed by `<enhanced_prompt>` execution spec.
   - Dynamically assigns authoritative personas (e.g. *"Staff Backend Engineer specializing in distributed systems"*).

2. **Automated Quality Gating (`validator.py`)**:
   - Rejects unfilled template placeholders (`[Platform]`, `TODO`), generic personas, or unparsed XML tags with an automated retry loop.

3. **Project Context Scanner (`context_scanner.py`)**:
   - Automatically scans workspace `package.json`, TypeScript configs, and project structure to inject context into the prompt enhancer.

4. **Hallucination Detection & Claim NLI (`hallucination_detector.py`)**:
   - Deconstructs generated answers into atomic claims and verifies them against retrieved document context using Natural Language Inference (NLI):
     - `SUPPORTED`: Empirical match with document context.
     - `CONTRADICTED`: Conflicts with document context.
     - `NEUTRAL`: Unsubstantiated claim.

5. **Side-by-Side Prompt Comparison**:
   - Renders raw prompt generation vs. PromptMaster enhanced generation side-by-side with 1-click **Copy Buttons** for comparison.

6. **Monochrome Apple Siri Visual Design**:
   - Dark aesthetic with real-time percentage progress bar, step indicators, and animated WebGL background.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Ollama** running locally (`ollama serve` with `qwen3:1.7b` or `llama3`)

### 2. Run Application
Launch both backend FastAPI server and Next.js frontend with a single command:
```bash
./start.sh
```

- **Frontend UI**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, React Markdown, WebGL OGL.
- **Backend**: FastAPI, PyDantic, Rich Console Logger.
- **AI Orchestration**: Llama 3 / Qwen 3 (via Ollama local provider), Gemini / Phoenix API.
