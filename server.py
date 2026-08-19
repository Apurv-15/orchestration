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

def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """Extract text from PDF file bytes using pypdf."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        extracted_text = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                extracted_text.append(f"--- Page {i+1} ---\n" + text.strip())
        return "\n\n".join(extracted_text).strip()
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

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
    document_text: Optional[str] = None
    document_name: Optional[str] = None

# Module-level RAG orchestrator cache keyed by model_name.
# Reuses document embeddings across requests for the same model/PDF.
_rag_orchestrator_cache: dict = {}

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Orchnex API Service is running"}

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Endpoint to upload a PDF guidelines document, extract text via pypdf, and store in sample_docs."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    try:
        contents = await file.read()
        text = extract_text_from_pdf_bytes(contents)
        
        if not text:
            raise HTTPException(status_code=400, detail="No readable text found in PDF. Make sure it is not an image-only scanned document.")

        # Save to data/sample_docs for RAG indexing
        docs_dir = os.path.join(os.path.dirname(__file__), "data", "sample_docs")
        os.makedirs(docs_dir, exist_ok=True)
        
        save_path = os.path.join(docs_dir, file.filename)
        with open(save_path, "wb") as f:
            f.write(contents)
            
        return {
            "status": "success",
            "filename": file.filename,
            "char_count": len(text),
            "extracted_text": text
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")

        # Include company guidelines document text if attached.
        # Truncate to max 6000 chars to avoid flooding Ollama's context window.
        full_user_prompt = req.prompt
        if req.document_text and req.document_text.strip():
            doc_text_truncated = req.document_text[:6000]
            if len(req.document_text) > 6000:
                doc_text_truncated += "\n...[Document truncated for context limit]"
            doc_context = f"### ATTACHED COMPANY GUIDELINES / DOCUMENT CONTEXT ({req.document_name or 'Document'}):\n{doc_text_truncated}\n\n"
            full_user_prompt = doc_context + "### USER REQUEST:\n" + req.prompt
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
            # Reuse cached orchestrator instance to avoid re-embedding entire PDF on every request
            cache_key = req.model_name
            if cache_key not in _rag_orchestrator_cache:
                _rag_orchestrator_cache[cache_key] = RAGOrchestrator(config)
            orchestrator = _rag_orchestrator_cache[cache_key]

            docs_dir = os.path.join(os.path.dirname(__file__), "data", "sample_docs")

            # If document text passed directly, write it as a .txt file for indexing
            if req.document_text and req.document_text.strip() and req.document_name:
                os.makedirs(docs_dir, exist_ok=True)
                txt_name = req.document_name.replace(".pdf", ".txt")
                with open(os.path.join(docs_dir, txt_name), "w", encoding="utf-8") as f:
                    f.write(req.document_text)
                # Invalidate cache so new document is indexed freshly
                if cache_key in _rag_orchestrator_cache:
                    del _rag_orchestrator_cache[cache_key]
                orchestrator = RAGOrchestrator(config)
                _rag_orchestrator_cache[cache_key] = orchestrator

            if os.path.exists(docs_dir):
                orchestrator.load_documents(docs_dir)

            result = orchestrator.process_query(full_user_prompt)
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
            enhanced_prompt = orchestrator.enhance_prompt_with_promptmaster(full_user_prompt)
            
            # 1. Normal/Baseline generation from raw prompt (without PromptMaster enhancement)
            raw_result = orchestrator.providers['gemini'].generate_response(full_user_prompt)
            
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
