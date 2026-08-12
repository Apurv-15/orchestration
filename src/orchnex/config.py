# src/orchnex/config.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class LLMConfig:
    """Configuration class for LLM settings"""
    gemini_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    gemini_model: str = "gemini-1.5-pro-exp-0827"
    llama_model: str = "meta/llama-3.1-8b-instruct"
    use_ollama: bool = False
    ollama_base_url: str = "http://localhost:11434/v1"
    max_iterations: int = 2
    temperature: float = 0.7
    top_p: float = 0.95
    max_tokens: int = 1024