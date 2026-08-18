# src/orchnex/hallucination_detector.py
import json
import re
from typing import Dict, Any, List, Optional
from .providers.ollama_provider import OllamaProvider
from .detector_templates import DetectorTemplates

class HallucinationDetector:
    def __init__(self, ollama_url: str = "http://localhost:11434/v1", model_name: str = "llama3"):
        self.provider = OllamaProvider()
        self.provider.initialize(api_key=None, base_url=ollama_url, model_name=model_name)
        self.templates = DetectorTemplates()

    def _clean_json(self, text: str) -> str:
        cleaned = text.strip()
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        return cleaned

    def extract_claims(self, text: str) -> List[str]:
        """Extract individual verifiable claims from text"""
        prompt = self.templates.get_claim_extraction_template().format(text=text)
        try:
            raw_response = self.provider.generate_response(prompt, temperature=0.1)
            cleaned = self._clean_json(raw_response)
            data = json.loads(cleaned)
            return data.get("claims", [])
        except Exception as e:
            # Fallback sentence splitter if JSON fails or model misbehaves
            sentences = re.split(r'(?<=[.!?])\s+', text)
            return [s.strip() for s in sentences if len(s.strip()) > 10]

    def verify_claims(self, context: str, claims: List[str]) -> List[Dict[str, Any]]:
        """Verify all claims in a single LLM call; falls back to per-claim calls if batch parsing fails"""
        prompt = self.templates.get_batch_nli_verification_template().format(
            context=context, claims=json.dumps(claims)
        )
        try:
            raw_response = self.provider.generate_response(prompt, temperature=0.1)
            cleaned = self._clean_json_array(raw_response)
            data = json.loads(cleaned)
            if not isinstance(data, list) or len(data) != len(claims):
                raise ValueError("Batch response shape mismatch")
            results = []
            for claim, item in zip(claims, data):
                results.append({
                    "claim": claim,
                    "verdict": str(item.get("verdict", "NEUTRAL")).upper(),
                    "explanation": item.get("explanation", "Could not parse explanation.")
                })
            return results
        except Exception:
            return [self.verify_claim(context, claim) for claim in claims]

    def _clean_json_array(self, text: str) -> str:
        cleaned = text.strip()
        match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        match = re.search(r'(\[.*\])', cleaned, re.DOTALL)
        if match:
            return match.group(1)
        return cleaned

    def verify_claim(self, context: str, claim: str) -> Dict[str, Any]:
        """Check if a single claim is supported, neutral, or contradicted by context"""
        prompt = self.templates.get_nli_verification_template().format(context=context, claim=claim)
        try:
            raw_response = self.provider.generate_response(prompt, temperature=0.1)
            cleaned = self._clean_json(raw_response)
            data = json.loads(cleaned)
            return {
                "claim": claim,
                "verdict": data.get("verdict", "NEUTRAL").upper(),
                "explanation": data.get("explanation", "Could not parse explanation.")
            }
        except Exception as e:
            return {
                "claim": claim,
                "verdict": "NEUTRAL",
                "explanation": f"Failed to evaluate claim: {str(e)}"
            }

    def detect_hallucinations(self, context: str, answer: str) -> Dict[str, Any]:
        """Runs the entire hallucination detection pipeline"""
        claims = self.extract_claims(answer)
        if not claims:
            return {
                "hallucination_detected": False,
                "score": 1.0,
                "claims": []
            }

        verified_claims = self.verify_claims(context, claims)
        supported_count = 0
        contradiction_count = 0
        neutral_count = 0

        for result in verified_claims:
            verdict = result["verdict"]
            if verdict == "SUPPORTED":
                supported_count += 1
            elif verdict == "CONTRADICTED":
                contradiction_count += 1
            else:
                neutral_count += 1

        # Simple scoring logic: supported is positive, contradiction is heavily penalized
        # Score = supported / total_claims
        score = supported_count / len(claims)
        hallucination_detected = contradiction_count > 0 or neutral_count > 0

        return {
            "hallucination_detected": hallucination_detected,
            "score": round(score, 2),
            "total_claims": len(claims),
            "supported": supported_count,
            "contradicted": contradiction_count,
            "neutral": neutral_count,
            "claims": verified_claims
        }
