# src/orchnex/rag_templates.py

class RAGTemplates:
    """Templates for RAG generation, evaluation, and refinement"""

    @staticmethod
    def get_generation_template() -> str:
        return '''You are an expert AI Assistant answering questions based strictly on the provided retrieved document contexts.

Retrieved Contexts:
---
{contexts}
---

User Question: {query}

Instructions:
1. Answer the question comprehensively using ONLY the information from the retrieved contexts above.
2. If the context contains source filenames (e.g. [source: doc.txt]), cite them when referencing facts.
3. If the retrieved context does not contain enough information to answer the question, state: "Based on the provided context, I cannot answer this question." Do not attempt to use external knowledge or fabricate an answer.
4. Keep the response objective, clear, and direct.

Generate your answer below:'''

    @staticmethod
    def get_evaluation_template() -> str:
        return '''You are an automated Quality Control Evaluator. Your task is to perform a rigorous evaluation of the AI-generated answer against the User Question and the Retrieved Contexts.

You must evaluate two criteria:
1. **Faithfulness (No Hallucination)**: Is the generated answer completely supported by the retrieved contexts? Every fact in the answer must be trace-able to the contexts. If the answer contains details not mentioned in the context, it is NOT faithful.
2. **Relevance**: Does the answer directly address the user's question? If the answer is vague or misses the core question, it is NOT relevant.

Retrieved Contexts:
---
{contexts}
---

User Question: {query}

AI-Generated Answer:
---
{answer}
---

Your response must be in JSON format matching the schema below. Output ONLY valid JSON. Do not write any markdown codeblock backticks or conversational filler.

JSON Output Schema:
{{
  "faithfulness": "YES" or "NO",
  "relevance": "YES" or "NO",
  "critique": "Detail your analysis here. If either criterion is NO, provide specific guidance on what needs to be added, removed, or corrected."
}}

Evaluate and output ONLY the JSON:'''

    @staticmethod
    def get_refinement_template() -> str:
        return '''You are an expert AI Assistant. Your previous answer was evaluated and flagged for refinement by the Quality Control loop.

User Question: {query}

Retrieved Contexts:
---
{contexts}
---

Previous Answer:
---
{previous_answer}
---

Evaluator Feedback:
---
{feedback}
---

Instructions:
Refine your previous answer to address all the feedback points above.
1. Strictly adhere to the contexts. Do not introduce external information.
2. Remove any ungrounded assertions or assumptions flagged by the evaluator.
3. Ensure the final response directly and accurately answers the user's question.

Provide your refined answer below:'''
