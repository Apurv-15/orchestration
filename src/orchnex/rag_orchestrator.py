# src/orchnex/rag_orchestrator.py
import json
import re
from typing import Dict, Any, List, Tuple
from datetime import datetime

from .config import LLMConfig
from .providers.base import LLMProvider
from .providers.llama_provider import LlamaProvider
from .providers.gemini_provider import GeminiProvider
from .providers.ollama_provider import OllamaProvider
from .output_manager import OutputManager
from .retriever import DocumentRetriever, DocumentChunk
from .rag_templates import RAGTemplates

class RAGOrchestrator:
    def __init__(self, config: LLMConfig, embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.config = config
        self.templates = RAGTemplates()
        self.providers: Dict[str, LLMProvider] = {}
        self.output_manager = OutputManager()
        self.retriever = DocumentRetriever(model_name=embedding_model)
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize LLM providers"""
        try:
            if self.config.use_ollama:
                # Use local fallbacks if model names are set to cloud defaults
                gemini_model = self.config.gemini_model
                if gemini_model == "gemini-1.5-pro-exp-0827":
                    gemini_model = "llama3"
                
                llama_model = self.config.llama_model
                if llama_model == "meta/llama-3.1-8b-instruct":
                    llama_model = "llama3"

                # Initialize local Llama/QC provider
                llama_provider = OllamaProvider()
                llama_provider.initialize(
                    api_key=None,
                    base_url=self.config.ollama_base_url,
                    model_name=llama_model
                )
                self.providers['llama'] = llama_provider

                # Initialize local Gemini/Phoenix provider
                gemini_provider = OllamaProvider()
                gemini_provider.initialize(
                    api_key=None,
                    base_url=self.config.ollama_base_url,
                    model_name=gemini_model
                )
                self.providers['gemini'] = gemini_provider
            else:
                # Initialize Llama provider
                llama_provider = LlamaProvider()
                llama_provider.initialize(
                    api_key=self.config.nvidia_api_key,
                    model_name=self.config.llama_model
                )
                self.providers['llama'] = llama_provider

                # Initialize Gemini provider
                gemini_provider = GeminiProvider()
                gemini_provider.initialize(
                    api_key=self.config.gemini_api_key,
                    model_name=self.config.gemini_model,
                    generation_config={
                        "temperature": self.config.temperature,
                        "top_p": self.config.top_p,
                        "max_output_tokens": self.config.max_tokens
                    }
                )
                self.providers['gemini'] = gemini_provider
            
        except Exception as e:
            raise RuntimeError(f"Error initializing providers: {str(e)}")

    def load_documents(self, directory_path: str, chunk_size: int = 500, overlap: int = 100) -> int:
        """Incorporate document loading into retriever"""
        return self.retriever.load_documents(directory_path, chunk_size, overlap)

    def _clean_json_response(self, response_text: str) -> str:
        """Helper to extract pure JSON from LLM output, removing backticks or text wrapper"""
        cleaned = response_text.strip()
        # Find JSON block enclosed in ```json and ```
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        # If no markdown blocks, check if there's any JSON structure
        match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        return cleaned

    def process_query(self, query: str, top_k: int = 3, verbose: bool = False) -> Dict[str, Any]:
        """Execute RAG pipeline: retrieval -> generation -> automated evaluation -> refinement"""
        try:
            # Start new interaction in output manager
            self.output_manager.start_interaction(query)
            
            # 1. Retrieve chunks
            retrieved = self.retriever.retrieve(query, top_k=top_k)
            
            if not retrieved:
                no_doc_msg = "No documents ingested. Please load documents before querying."
                self.output_manager.save_output("error.md", no_doc_msg, "RAG Retrieval Warning")
                return {"error": no_doc_msg}

            # Format contexts for prompt and storage
            formatted_contexts = ""
            context_list = []
            for idx, (chunk, score) in enumerate(retrieved):
                formatted_contexts += f"Chunk {idx+1} [source: {chunk.source}] (similarity: {score:.3f}):\n{chunk.text}\n\n"
                context_list.append({
                    "source": chunk.source,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "similarity": score
                })

            self.output_manager.save_output(
                "retrieved_contexts.md", 
                formatted_contexts, 
                f"Retrieved {len(retrieved)} Contexts"
            )

            # 2. Generate initial response
            gen_prompt = self.templates.get_generation_template().format(
                contexts=formatted_contexts,
                query=query
            )
            
            initial_answer = self.providers['gemini'].generate_response(gen_prompt)
            self.output_manager.save_output(
                "initial_answer.md",
                initial_answer,
                "Initial Generated Answer"
            )

            current_answer = initial_answer
            evaluation_history = []
            refinement_history = []
            passed_checks = False
            iterations_run = 0

            # 3. Validation and refinement loop
            for iteration in range(self.config.max_iterations):
                iterations_run += 1
                
                # Run automated evaluator using Llama
                eval_prompt = self.templates.get_evaluation_template().format(
                    contexts=formatted_contexts,
                    query=query,
                    answer=current_answer
                )
                
                eval_raw = self.providers['llama'].generate_response(eval_prompt)
                eval_cleaned = self._clean_json_response(eval_raw)
                
                # Parse evaluation JSON
                try:
                    eval_data = json.loads(eval_cleaned)
                except Exception as parse_err:
                    # Fallback if evaluator failed to output standard JSON
                    eval_data = {
                        "faithfulness": "NO" if "FAIL" in eval_raw.upper() or "NO" in eval_raw.upper() else "YES",
                        "relevance": "NO" if "FAIL" in eval_raw.upper() or "NO" in eval_raw.upper() else "YES",
                        "critique": f"Raw output parser fallback. Raw: {eval_raw}"
                    }

                evaluation_history.append(eval_data)
                
                # Save evaluation step
                self.output_manager.save_output(
                    f"evaluation_{iteration+1}.md",
                    json.dumps(eval_data, indent=2),
                    f"QC Evaluation - Iteration {iteration+1}"
                )

                # Check if it passed all QC validations
                faithfulness = eval_data.get("faithfulness", "NO").upper() == "YES"
                relevance = eval_data.get("relevance", "NO").upper() == "YES"
                
                if faithfulness and relevance:
                    passed_checks = True
                    # Let output manager save early termination
                    self.output_manager.save_output(
                        f"qc_result.md",
                        f"PASSED QC on Iteration {iteration+1}!\n\nCritique: {eval_data.get('critique', '')}",
                        "QC Validation Success"
                    )
                    break

                # If failed, refine using Gemini
                refine_prompt = self.templates.get_refinement_template().format(
                    query=query,
                    contexts=formatted_contexts,
                    previous_answer=current_answer,
                    feedback=eval_data.get("critique", "Please improve the precision and alignment with context.")
                )
                
                refined_answer = self.providers['gemini'].generate_response(refine_prompt)
                refinement_history.append(refined_answer)
                
                # Save refined response
                self.output_manager.save_output(
                    f"refined_answer_{iteration+1}.md",
                    refined_answer,
                    f"Refined Answer - Iteration {iteration+1}"
                )
                
                current_answer = refined_answer

            # Save final summary JSON
            summary_data = {
                "timestamp": datetime.now().isoformat(),
                "query": query,
                "contexts": context_list,
                "final_answer": current_answer,
                "qc_passed": passed_checks,
                "iterations": iterations_run,
                "evaluation_history": evaluation_history
            }
            self.output_manager.save_summary(summary_data)

            return summary_data

        except Exception as e:
            error_msg = f"Error in processing RAG query: {str(e)}"
            self.output_manager.save_output(
                "error.md",
                error_msg,
                "RAG Processing Error"
            )
            raise RuntimeError(error_msg)
