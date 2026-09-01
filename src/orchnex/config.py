# src/orchnex/config.py
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class LLMConfig:
    """Configuration class for LLM settings"""
    gemini_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    gemini_model: str = "gemini-1.5-pro-exp-0827"
    llama_model: str = "meta/llama-3.1-8b-instruct"
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    use_ollama: bool = False
    ollama_base_url: str = "http://localhost:11434/v1"
    max_iterations: int = 1  # QC refinement iteration limit
    temperature: float = 0.7
    top_p: float = 0.95
    max_tokens: int = 1024

    def __post_init__(self):
        if not self.openrouter_api_key:
            self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        if not self.gemini_api_key:
            self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not self.nvidia_api_key:
            self.nvidia_api_key = os.getenv("NVIDIA_API_KEY")
