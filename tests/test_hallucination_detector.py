"""Self-check for HallucinationDetector. Run directly: python tests/test_hallucination_detector.py
Stubs OllamaProvider.generate_response so no live Ollama server is required.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from orchnex.hallucination_detector import HallucinationDetector


def make_detector(canned_responses):
    """canned_responses: list of strings returned by successive generate_response calls."""
    detector = HallucinationDetector()
    calls = iter(canned_responses)
    detector.provider.generate_response = lambda prompt, temperature=None: next(calls)
    return detector


def test_all_supported():
    claims_json = json.dumps({"claims": ["The sky is blue."]})
    batch_json = json.dumps([{"claim": "The sky is blue.", "verdict": "SUPPORTED", "explanation": "context says so"}])
    detector = make_detector([claims_json, batch_json])

    result = detector.detect_hallucinations("The sky is blue on a clear day.", "The sky is blue.")

    assert result["hallucination_detected"] is False
    assert result["score"] == 1.0


def test_contradiction_detected():
    claims_json = json.dumps({"claims": ["The sky is green."]})
    batch_json = json.dumps([{"claim": "The sky is green.", "verdict": "CONTRADICTED", "explanation": "context says blue"}])
    detector = make_detector([claims_json, batch_json])

    result = detector.detect_hallucinations("The sky is blue.", "The sky is green.")

    assert result["hallucination_detected"] is True
    assert result["contradicted"] == 1


def test_malformed_json_falls_back():
    detector = make_detector(["not json at all", "still not json"])

    result = detector.detect_hallucinations("Some context.", "A claim that cannot be parsed.")

    assert isinstance(result["hallucination_detected"], bool)
    assert result["claims"]
    assert all(c["verdict"] in {"SUPPORTED", "CONTRADICTED", "NEUTRAL"} for c in result["claims"])


if __name__ == "__main__":
    test_all_supported()
    test_contradiction_detected()
    test_malformed_json_falls_back()
    print("All hallucination_detector self-checks passed.")
