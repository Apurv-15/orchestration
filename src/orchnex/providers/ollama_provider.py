# src/orchnex/providers/ollama_provider.py
from typing import Optional
from openai import OpenAI
from .base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self):
        super().__init__()
        self.client = None
        self.model_name = "llama3"
        self.system_instruction = ""
        self.default_params = {
            "temperature": 0.7,
            "top_p": 0.95,
            "max_tokens": 1024
        }

    def initialize(self, api_key: Optional[str] = None, **kwargs):
        """Initialize the Ollama provider"""
        try:
            base_url = kwargs.get('base_url', 'http://localhost:11434/v1')
            self.client = OpenAI(
                base_url=base_url,
                api_key=api_key or "ollama"
            )
            self.model_name = kwargs.get('model_name', self.model_name)
            self.system_instruction = kwargs.get('system_instruction', '')
            self._is_initialized = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Ollama provider: {str(e)}")

    def generate_response(self, prompt: str, temperature: Optional[float] = None) -> str:
        """Generate response using Ollama"""
        if not self.client:
            raise RuntimeError("Provider not initialized")
            
        try:
            messages = []
            if self.system_instruction:
                messages.append({"role": "system", "content": self.system_instruction})
            messages.append({"role": "user", "content": prompt})

            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=temperature or self.default_params["temperature"],
                top_p=self.default_params["top_p"],
                max_tokens=self.default_params["max_tokens"]
            )
            return completion.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"Error generating response: {str(e)}")
