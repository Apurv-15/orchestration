import sys
import os

# Ensure src package is discoverable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
import io
from pypdf import PdfReader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from orchnex import MultiLLMOrchestrator, RAGOrchestrator, LLMConfig

app = FastAPI(title="Orchnex API Server", description="FastAPI backend for Orchnex Orchestrator")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrchestrationRequest(BaseModel):
    prompt: str
    use_ollama: Optional[bool] = True
    model_name: Optional[str] = "qwen3:1.7b"
    is_rag: Optional[bool] = False

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Orchnex API Service is running"}

@app.post("/api/generate")
async def generate_response(req: OrchestrationRequest):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
    try:
        config = LLMConfig(
            use_ollama=req.use_ollama,
            ollama_base_url="http://localhost:11434/v1",
            gemini_model=req.model_name,
            llama_model=req.model_name
        )

        if req.is_rag:
            orchestrator = RAGOrchestrator(config)
            docs_dir = os.path.join(os.path.dirname(__file__), "data", "sample_docs")
            if os.path.exists(docs_dir):
                orchestrator.load_documents(docs_dir)
            result = orchestrator.process_query(req.prompt)
            return {
                "status": "success",
                "original_prompt": req.prompt,
                "final_answer": result.get("final_answer", ""),
                "qc_passed": result.get("qc_passed", False),
                "retrieved_contexts": result.get("contexts", []),
                "hallucination_check": result.get("hallucination_check", None),
                "evaluation_history": result.get("evaluation_history", [])
            }
        else:
            orchestrator = MultiLLMOrchestrator(config)
            enhanced_prompt = orchestrator.enhance_prompt_with_promptmaster(req.prompt)
            
            # 1. Normal/Baseline generation from raw prompt (without PromptMaster enhancement)
            raw_result = orchestrator.providers['gemini'].generate_response(req.prompt)
            
            # 2. Enhanced generation from PromptMaster 4.0 specification
            phoenix_prompt = (
                "Execute the following specification precisely to produce the final deliverable. "
                "Follow all role, context, task instructions, and constraints explicitly:\n\n"
                f"{enhanced_prompt}"
            )
            final_result = orchestrator.providers['gemini'].generate_response(phoenix_prompt)
            
            return {
                "status": "success",
                "original_prompt": req.prompt,
                "enhanced_prompt": enhanced_prompt,
                "raw_result": raw_result,
                "final_result": final_result
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
