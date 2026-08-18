# src/orchnex/rag_main.py
import os
import time
from datetime import datetime
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from dotenv import load_dotenv

# Load env variables (if any)
load_dotenv()

from orchnex import LLMConfig, RAGOrchestrator

class RAGDemo:
    def __init__(self):
        self.console = Console()
        self.orchestrator = None
        self.doc_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "sample_docs")

    def display_header(self):
        header = """
╔══════════════════════════════════════════════════════╗
║                🔍 ORCHNEX RAG DEMO 🔍                ║
║      Retrieval-Augmented Generation & Evaluator     ║
╚══════════════════════════════════════════════════════╝
        """
        self.console.print(Panel(header, style="bold magenta"))

    def display_capabilities(self):
        capabilities_table = Table(show_header=True, header_style="bold cyan")
        capabilities_table.add_column("Pipeline Stage", style="yellow")
        capabilities_table.add_column("Components & Methods", style="green")

        capabilities_table.add_row(
            "1. Local Semantic Search",
            "• Dense vector embeddings (MiniLM-L6-v2)\n• Cosine similarity via PyTorch\n• Sliding-window text chunking"
        )
        capabilities_table.add_row(
            "2. Grounded Generation",
            "• Gemini-1.5-Pro (Phoenix)\n• Strict context-adherence system prompt\n• Automated source citation"
        )
        capabilities_table.add_row(
            "3. Automated Evaluation",
            "• Llama-3.1-8b-Instruct (QC Agent)\n• Dual check: Faithfulness & Relevance\n• Structured JSON reasoning feedback"
        )
        capabilities_table.add_row(
            "4. Dynamic Refinement",
            "• Iterative feedback-driven correction\n• Loop terminates early if QA criteria met"
        )

        self.console.print("\n🚀 RAG Pipeline Capabilities:", style="bold white")
        self.console.print(capabilities_table)

    def initialize_system(self):
        # Display Header
        self.display_header()

        # Check if they want to run on Ollama
        use_ollama = os.getenv("USE_OLLAMA", "").lower() in ("true", "1")
        if os.getenv("USE_OLLAMA") is None:
            use_ollama = Confirm.ask("Do you want to run locally with Ollama?")

        gemini_key = None
        nvidia_key = None
        gemini_model = "gemini-1.5-pro-exp-0827"
        llama_model = "meta/llama-3.1-8b-instruct"
        ollama_url = "http://localhost:11434/v1"

        if use_ollama:
            gemini_model = Prompt.ask("Enter local model to use for Generation (Phoenix)", default="llama3")
            llama_model = Prompt.ask("Enter local model to use for Evaluation (QC)", default="llama3")
            ollama_url = Prompt.ask("Enter Ollama API Base URL", default="http://localhost:11434/v1")
        else:
            # Get API keys
            gemini_key = os.getenv("GEMINI_API_KEY")
            nvidia_key = os.getenv("NVIDIA_API_KEY")

            if not gemini_key or gemini_key.startswith("your_"):
                gemini_key = Prompt.ask("Enter GEMINI_API_KEY")
            if not nvidia_key or nvidia_key.startswith("your_"):
                nvidia_key = Prompt.ask("Enter NVIDIA_API_KEY")

        self.initialize_system_args(
            use_ollama=use_ollama,
            gemini_model=gemini_model,
            llama_model=llama_model,
            ollama_url=ollama_url,
            gemini_key=gemini_key,
            nvidia_key=nvidia_key
        )

    def initialize_system_args(self, use_ollama: bool, gemini_model: str, llama_model: str, ollama_url: str, gemini_key: str = None, nvidia_key: str = None):
        if not use_ollama:
            gemini_key = gemini_key or os.getenv("GEMINI_API_KEY")
            nvidia_key = nvidia_key or os.getenv("NVIDIA_API_KEY")
            if not gemini_key or not nvidia_key:
                raise ValueError("Both GEMINI_API_KEY and NVIDIA_API_KEY must be provided or set in environment variables when not using Ollama.")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            transient=True,
        ) as progress:
            task = progress.add_task("⚙️ Initializing models and embedding retriever...", total=None)
            
            config = LLMConfig(
                gemini_api_key=gemini_key,
                nvidia_api_key=nvidia_key,
                gemini_model=gemini_model,
                llama_model=llama_model,
                use_ollama=use_ollama,
                ollama_base_url=ollama_url,
                max_iterations=2
            )
            
            self.orchestrator = RAGOrchestrator(config)
            time.sleep(1)
            
            # Load documents
            os.makedirs(self.doc_dir, exist_ok=True)
            progress.update(task, description="📚 Indexing local documents in 'data/sample_docs'...")
            num_chunks = self.orchestrator.load_documents(self.doc_dir)
            time.sleep(1)

        self.console.print(f"\n✅ System initialized successfully!", style="bold green")
        self.console.print(f"📚 Loaded and indexed [bold green]{num_chunks}[/bold green] chunks from '{self.doc_dir}'\n")

    def process_query(self, query: str):
        try:
            self.console.print("\n" + "═"*80)
            self.console.print(f"❓ [bold yellow]Query:[/bold yellow] {query}\n")

            # 1. Retrieval
            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
                progress.add_task("🔍 Retrieving context chunks from local store...", total=None)
                retrieved = self.orchestrator.retriever.retrieve(query, top_k=3)
            
            if not retrieved:
                self.console.print("[bold red]Warning: No context chunks retrieved. Ensure documents are present in 'data/sample_docs'.[/bold red]")
                return

            # Display retrieved chunks
            self.console.print("[bold cyan]📄 Retrieved Documents:[/bold cyan]")
            for idx, (chunk, score) in enumerate(retrieved):
                self.console.print(f"  [{idx+1}] [bold green]{chunk.source}[/bold green] (similarity: [bold white]{score:.3f}[/bold white])")
                snippet = chunk.text[:150].replace('\n', ' ') + "..."
                self.console.print(f"      \"{snippet}\"")
            self.console.print()

            # 2. Generation & QC Loop
            summary = None
            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
                task = progress.add_task("🤖 Running RAG Generator & Quality Evaluator...", total=None)
                summary = self.orchestrator.process_query(query, top_k=3)

            if "error" in summary:
                self.console.print(f"[bold red]Pipeline Error:[/bold red] {summary['error']}")
                return

            # Display QC results
            self.console.print("[bold cyan]📊 Quality Control Audit Trail:[/bold cyan]")
            for idx, eval_data in enumerate(summary["evaluation_history"]):
                faith = eval_data.get("faithfulness", "NO")
                relevance = eval_data.get("relevance", "NO")
                critique = eval_data.get("critique", "No critique provided.")
                ans = eval_data.get("answer", "")
                
                faith_style = "green" if faith == "YES" else "red"
                rel_style = "green" if relevance == "YES" else "red"
                
                self.console.print(f"  [bold]Iteration {idx+1}:[/bold]")
                self.console.print(f"    • Candidate Answer Evaluated:")
                self.console.print(Panel(ans, title=f"Candidate Answer {idx+1}", border_style="blue", expand=False))
                self.console.print(f"    • Faithfulness (No Hallucination): [{faith_style}]{faith}[/{faith_style}]")
                self.console.print(f"    • Query Relevance:               [{rel_style}]{relevance}[/{rel_style}]")
                self.console.print(f"    • Critique/Feedback:              [italic white]{critique}[/italic white]")
                self.console.print("-" * 50)

            # Display Final Answer Panel
            qc_status = "✅ QC PASSED" if summary["qc_passed"] else "⚠️ QC FAILED (Max iterations reached)"
            status_style = "bold green" if summary["qc_passed"] else "bold yellow"
            
            final_panel = Panel(
                summary["final_answer"],
                title=f"🌟 Final Answer ({qc_status})",
                title_align="left",
                border_style="green" if summary["qc_passed"] else "yellow"
            )
            self.console.print(final_panel)

            # If there was a refinement (more than 1 iteration), display the before/after comparison
            if len(summary["evaluation_history"]) > 1:
                self.console.print("\n[bold orange3]🔄 Hallucination Correction Comparison:[/bold orange3]")
                initial_ans = summary["evaluation_history"][0].get("answer", "")
                final_ans = summary["final_answer"]
                
                self.console.print(Panel(initial_ans, title="❌ Previous Output (Before Correction / Hallucinated)", border_style="red", expand=False))
                self.console.print(Panel(final_ans, title="✅ Current Output (After Correction / Grounded)", border_style="green", expand=False))

        except Exception as e:
            self.console.print(Panel(f"❌ Error during RAG execution: {str(e)}", title="Error", style="bold red"))

    def run(self):
        try:
            self.initialize_system()
            self.display_capabilities()
            while True:
                self.console.print("\n" + "─" * 80)
                query = Prompt.ask("\n💭 Ask a question about Orchnex (or type 'quit' to exit)")

                if query.lower() == 'quit':
                    break

                if not query.strip():
                    continue

                self.process_query(query)

                continue_prompt = Prompt.ask("\n🤔 Ask another question? (y/n)", choices=["y", "n"], default="y")
                if continue_prompt.lower() != 'y':
                    break

            self.console.print("\n👋 Thank you for exploring Orchnex RAG!", style="bold magenta")

        except KeyboardInterrupt:
            self.console.print("\n\n❌ Interrupted by user", style="bold red")
        except Exception as e:
            self.console.print(f"\n❌ Fatal Error: {str(e)}", style="bold red")

def run_rag_demo():
    demo = RAGDemo()
    demo.run()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Orchnex: RAG Orchestrator Platform")
    parser.add_argument("--query", "-q", type=str, help="Query to process directly (non-interactive mode)")
    parser.add_argument("--ollama", "-o", action="store_true", help="Run locally using Ollama")
    parser.add_argument("--model-gen", type=str, default="llama3", help="Local generation model (default: llama3)")
    parser.add_argument("--model-eval", type=str, default="llama3", help="Local evaluation model (default: llama3)")
    parser.add_argument("--ollama-url", type=str, default="http://localhost:11434/v1", help="Ollama API URL")
    
    args = parser.parse_args()
    
    if args.query:
        demo = RAGDemo()
        demo.initialize_system_args(
            use_ollama=args.ollama,
            gemini_model=args.model_gen,
            llama_model=args.model_eval,
            ollama_url=args.ollama_url
        )
        demo.process_query(args.query)
    else:
        run_rag_demo()

if __name__ == "__main__":
    main()
