# Orchnex System Architecture

The core pipeline of Orchnex is composed of three distinct phases:

### Phase 1: Prompt Enhancement (PromptMaster)
When a user submits a prompt, it is not processed immediately by the main generator. Instead, the prompt is sent to Llama (acting as PromptMaster). PromptMaster applies seven prompt engineering strategies:
1. Deep Deconstruction (identifying audience and detail levels)
2. Contextualization (adding scope and background)
3. Specificity Refinement
4. Structure formatting (e.g., Markdown headers, list requirements)
5. Bias Mitigation
6. Constraint Definition
7. Target Model Optimization (formatting specifically for Gemini)

### Phase 2: Response Generation (Phoenix)
Gemini receives the enhanced prompt and generates the initial response. Gemini is configured with system instructions to classify requests (e.g., Depth Research vs. Concise Answer) and maintain an objective, helpful tone.

### Phase 3: The Quality Control (QC) Loop
The initial Gemini response is sent to Llama, which acts as a critique agent. Llama evaluates the answer across several categories:
- Alignment with the original and enhanced prompt
- Technical accuracy
- Comprehensiveness
- Structure and clarity

If Llama determines the response requires improvement, it outputs constructive suggestions. Gemini then receives these suggestions along with the previous draft and refines its response. If the response is satisfactory, the loop terminates early.
