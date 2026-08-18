# src/orchnex/validator.py
import re
from dataclasses import dataclass, field
from typing import List

@dataclass
class ValidationResult:
    passed: bool
    failures: List[str] = field(default_factory=list)

def validate_enhanced_prompt(raw_output: str) -> ValidationResult:
    """Validates that PromptMaster produced valid <analysis> and <enhanced_prompt> tags with concrete specifications."""
    failures = []

    # 1. Structural check — must contain both required tags
    analysis_matches = re.findall(r"<analysis>(.*?)</analysis>", raw_output, re.S)
    enhanced_matches = re.findall(r"<enhanced_prompt>(.*?)</enhanced_prompt>", raw_output, re.S)

    if len(analysis_matches) != 1:
        failures.append(f"Expected exactly 1 <analysis> block, found {len(analysis_matches)}")
    if len(enhanced_matches) != 1:
        failures.append(f"Expected exactly 1 <enhanced_prompt> block, found {len(enhanced_matches)}")

    if failures:
        return ValidationResult(False, failures)

    enhanced = enhanced_matches[0]

    # 2. Required fields present in enhanced_prompt
    required_fields = ["role:", "context:", "task:", "constraints:", "output_format:", "deliverables:"]
    for field_name in required_fields:
        if field_name not in enhanced:
            failures.append(f"Missing required field: '{field_name}'")

    # 3. Unfilled template placeholders
    placeholder_patterns = [
        r"\[[A-Za-z_ ]+\]",
        r"\{[A-Za-z_]+\}",
        r"#CampaignName\b",
        r"\bTODO\b|\bTBD\b|\bXXX\b",
        r"\byour (brand|product|company) name\b",
    ]
    for pattern in placeholder_patterns:
        hits = re.findall(pattern, enhanced, re.I)
        if hits:
            failures.append(f"Unfilled placeholder-like content found: {set(hits)}")

    # 4. Persona specificity
    role_match = re.search(r"role:\s*[\"']?(.+?)(?:[\"']|\n\w+:|$)", enhanced, re.S)
    if role_match:
        role_text = role_match.group(1).strip().lower()
        generic_roles = {"a writer", "an assistant", "an expert", "a professional", "an ai"}
        if any(role_text == g or role_text.startswith(g) for g in generic_roles):
            failures.append(f"Persona is too generic: '{role_text}'")
    else:
        failures.append("Could not extract role: field content")

    # 5. Minimum substance check
    if len(enhanced.strip()) < 100:
        failures.append(f"enhanced_prompt suspiciously short ({len(enhanced.strip())} chars)")

    return ValidationResult(passed=len(failures) == 0, failures=failures)

def extract_enhanced_prompt(raw_output: str) -> str:
    """Extracts only the content of the <enhanced_prompt> tag for Phoenix."""
    match = re.search(r"<enhanced_prompt>(.*?)</enhanced_prompt>", raw_output, re.S)
    if match:
        return match.group(1).strip()
    return raw_output.strip()
