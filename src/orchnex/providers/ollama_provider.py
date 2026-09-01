# src/orchnex/providers/ollama_provider.py
import os
from typing import Optional
from openai import OpenAI
from loguru import logger
from .base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self):
        super().__init__()
        self.client = None
        self.fallback_client = None
        self.model_name = "llama3"
        self.fallback_model = "meta-llama/llama-3.3-70b-instruct:free"
        self.system_instruction = ""
        self.default_params = {
            "temperature": 0.7,
            "top_p": 0.95,
            "max_tokens": 1024
        }

    def initialize(self, api_key: Optional[str] = None, **kwargs):
        """Initialize the Ollama provider with optional OpenRouter fallback"""
        try:
            base_url = kwargs.get('base_url', 'http://localhost:11434/v1')
            self.client = OpenAI(
                base_url=base_url,
                api_key=api_key or "ollama",
                timeout=12.0
            )
            self.model_name = kwargs.get('model_name', self.model_name)
            self.system_instruction = kwargs.get('system_instruction', '')
            
            # Setup OpenRouter fallback client if key is available
            openrouter_key = kwargs.get('openrouter_api_key') or os.getenv("OPENROUTER_API_KEY")
            self.fallback_model = kwargs.get('openrouter_model') or os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
            if openrouter_key:
                self.fallback_client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=openrouter_key,
                    timeout=30.0
                )
                logger.info(f"OpenRouter fallback initialized with model: {self.fallback_model}")
            
            self._is_initialized = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Ollama provider: {str(e)}")

    def generate_response(self, prompt: str, temperature: Optional[float] = None) -> str:
        """Generate response using Ollama, falling back to OpenRouter if Ollama is unreachable"""
        if not self.client:
            raise RuntimeError("Provider not initialized")
            
        messages = []
        if self.system_instruction:
            messages.append({"role": "system", "content": self.system_instruction})
        messages.append({"role": "user", "content": prompt})

        # 1. Try local Ollama first
        try:
            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=temperature or self.default_params["temperature"],
                top_p=self.default_params["top_p"],
                max_tokens=self.default_params["max_tokens"]
            )
            return completion.choices[0].message.content
        except Exception as ollama_err:
            # 2. Check if OpenRouter fallback is available
            openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if not self.fallback_client and openrouter_key:
                self.fallback_client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=openrouter_key,
                    timeout=30.0
                )

            if self.fallback_client:
                logger.warning(
                    f"Local Ollama unreachable ({str(ollama_err)}). Seamlessly falling back to OpenRouter free model: {self.fallback_model}"
                )
                try:
                    completion = self.fallback_client.chat.completions.create(
                        model=self.fallback_model,
                        messages=messages,
                        temperature=temperature or self.default_params["temperature"],
                        top_p=self.default_params["top_p"],
                        max_tokens=self.default_params["max_tokens"]
                    )
                    return completion.choices[0].message.content
                except Exception as fb_err:
                    raise RuntimeError(f"Both Ollama and OpenRouter fallback failed: {str(fb_err)}")
            
            raise RuntimeError(
                f"Ollama is not running locally on http://localhost:11434 ({str(ollama_err)}). "
                f"Please start Ollama locally or set OPENROUTER_API_KEY in your .env for automatic cloud fallback."
            )
