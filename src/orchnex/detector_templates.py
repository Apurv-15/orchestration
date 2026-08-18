# src/orchnex/detector_templates.py

class DetectorTemplates:
    """Templates specifically optimized for local Ollama models to perform claim extraction and verification"""

    @staticmethod
    def get_claim_extraction_template() -> str:
        return '''You are a precise facts extractor. Your job is to break down the text below into individual, distinct, verifiable claims/facts.
Exclude conversational filler, pleasantries, or code blocks. Each claim must be a single, short sentence.

Input Text:
---
{text}
---

Your response must be in JSON format matching the schema below. Output ONLY valid JSON. Do not write any markdown codeblock backticks or conversational filler.

JSON Output Schema:
{{
  "claims": [
    "First distinct claim",
    "Second distinct claim"
  ]
}}

Extract and output ONLY the JSON:'''

    @staticmethod
    def get_nli_verification_template() -> str:
        return '''You are a rigorous Natural Language Inference (NLI) system. Compare the given Claim against the Reference Context.
Determine if the Claim is:
1. **SUPPORTED**: The context directly supports or confirms the claim.
2. **CONTRADICTED**: The context directly contradicts or denies the claim.
3. **NEUTRAL**: The context does not mention or contain enough information to verify the claim.

Reference Context:
---
{context}
---

Claim to Verify:
---
{claim}
---

Your response must be in JSON format matching the schema below. Output ONLY valid JSON. Do not write any markdown codeblock backticks or conversational filler.

JSON Output Schema:
{{
  "verdict": "SUPPORTED" or "CONTRADICTED" or "NEUTRAL",
  "explanation": "Brief explanation of why this verdict was chosen."
}}

Analyze and output ONLY the JSON:'''

    @staticmethod
    def get_batch_nli_verification_template() -> str:
        return '''You are a rigorous Natural Language Inference (NLI) system. For EACH claim below, compare it against the Reference Context.
Determine if the claim is:
1. **SUPPORTED**: The context directly supports or confirms the claim.
2. **CONTRADICTED**: The context directly contradicts or denies the claim.
3. **NEUTRAL**: The context does not mention or contain enough information to verify the claim.

Reference Context:
---
{context}
---

Claims to Verify (JSON array):
---
{claims}
---

Your response must be a JSON array with one object per claim, in the same order as the input. Output ONLY valid JSON. Do not write any markdown codeblock backticks or conversational filler.

JSON Output Schema:
[
  {{
    "claim": "the exact claim text",
    "verdict": "SUPPORTED" or "CONTRADICTED" or "NEUTRAL",
    "explanation": "Brief explanation of why this verdict was chosen."
  }}
]

Analyze and output ONLY the JSON array:'''
