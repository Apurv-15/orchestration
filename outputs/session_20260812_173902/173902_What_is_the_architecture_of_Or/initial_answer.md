The architecture of Orchnex consists of three distinct phases, designed to orchestrate the collaboration between two models: **PromptMaster (powered by Llama)** and **Phoenix (powered by Gemini)**.  

### **Phase 1: Prompt Enhancement (PromptMaster)**  
- **Role**: Analyzes raw user input, generates context-enhanced prompts, and critiques output from other models.  
- **Process**: Applies seven prompt engineering strategies, including:  
  1. Deep Deconstruction (identifying audience and detail levels),  
  2. Contextualization (adding scope and background),  
  3. Specificity Refinement,  
  4. and others (not fully detailed).  
- **Outcome**: Produces structured, context-rich prompts for subsequent model generation.  

### **Phase 2: Generation (Phoenix)**  
- **Role**: A creative and analytical generation engine that takes context-enriched prompts and produces high-quality, comprehensive responses.  
- **Process**: Utilizes Gemini models to generate outputs based on the enhanced prompts.  

### **Phase 3: Iterative Loop**  
- **Process**: The system runs PromptMaster and Phoenix in an iterative loop, enabling:  
  1. **Resolution of ambiguity** through feedback loops,  
  2. **Validation** of generated content against strict standards,  
  3. **Automatic refinement** of response quality without manual intervention.  

This architecture ensures seamless collaboration between the specialized reasoning of Llama (PromptMaster) and the generation capabilities of Gemini (Phoenix), optimizing user queries and response quality.  

**Citations**:  
- Chunk 2 [source: orchnex_architecture.md] (similarity: 0.536)  
- Chunk 3 [source: orchnex_overview.md] (similarity: 0.377)