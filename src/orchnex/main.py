# src/orchnex/main.py
from rich.console import Console
from rich.prompt import Prompt, Confirm
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from orchnex import LLMConfig, MultiLLMOrchestrator
import os
from datetime import datetime
import time

class OrchnexDemo:
    def __init__(self):
        self.console = Console()
        self.orchestrator = None
    
    def display_header(self):
        header = """
╔══════════════════════════════════════════════════════╗
║                   🌟 ORCHNEX DEMO 🌟                 ║
║            Multi-LLM Orchestration Platform          ║
╚══════════════════════════════════════════════════════╝
        """
        self.console.print(Panel(header, style="bold blue"))

    def display_capabilities(self):
        capabilities_table = Table(show_header=True, header_style="bold magenta")
        capabilities_table.add_column("Category", style="cyan")
        capabilities_table.add_column("Capabilities", style="green")

        capabilities = {
            "Prompt Processing": [
                "✨ Advanced Prompt Enhancement",
                "🎯 Context-Aware Processing",
                "🔍 Intelligent Analysis",
            ],
            "LLM Integration": [
                "🤖 Multi-LLM Orchestration",
                "🔄 Dynamic Model Selection",
                "⚡ Parallel Processing",
            ],
            "Quality Control": [
                "📊 Automated Quality Analysis",
                "🔄 Iterative Refinement",
                "✅ Validation Checks",
            ]
        }

        for category, caps in capabilities.items():
            capabilities_table.add_row(category, "\n".join(caps))

        self.console.print("\n🔥 System Capabilities:", style="bold yellow")
        self.console.print(capabilities_table)

    def initialize_system(self):
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
            llama_model = Prompt.ask("Enter local model to use for Feedback (PromptMaster)", default="llama3")
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
            task = progress.add_task("🚀 Initializing Orchnex system...", total=None)
            
            config = LLMConfig(
                gemini_api_key=gemini_key,
                nvidia_api_key=nvidia_key,
                gemini_model=gemini_model,
                llama_model=llama_model,
                use_ollama=use_ollama,
                ollama_base_url=ollama_url
            )
            
            self.orchestrator = MultiLLMOrchestrator(config)
            time.sleep(1)  # Give a sense of initialization
            
            progress.update(task, completed=True)

        self.console.print("\n✅ System initialized successfully!", style="bold green")
        
    def process_prompt(self, prompt: str):
        try:
            self.console.print("\n🎯 Processing Prompt:", style="bold cyan")
            self.console.print(f"{prompt}\n")

            # Initialize interaction in output manager
            self.orchestrator.output_manager.start_interaction(prompt)

            # Step 1: Prompt Analysis and Enhancement
            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
                task = progress.add_task("🔍 Step 1: Analyzing prompt with PromptMaster 3.0...", total=1)
                enhanced_prompt = self.orchestrator.enhance_prompt_with_promptmaster(prompt)
                progress.update(task, completed=1)
            
            # Save and display enhanced prompt
            self.orchestrator.output_manager.save_output(
                "enhanced_prompt.md",
                enhanced_prompt,
                "Enhanced Prompt"
            )

            # Step 2: Initial Generation with Gemini
            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
                task = progress.add_task("🤖 Step 2: Generating initial response...", total=1)
                initial_result = self.orchestrator.providers['gemini'].generate_response(enhanced_prompt)
                progress.update(task, completed=1)

            # Save and display initial result
            self.orchestrator.output_manager.save_output(
                "initial_result.md",
                initial_result,
                "Initial Response"
            )

            current_result = initial_result

            # Step 3: Iterative Feedback Loop
            for iteration in range(self.orchestrator.config.max_iterations):
                # Meta Feedback
                with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
                    task = progress.add_task(f"🔄 Step {3+iteration*2}: Meta Feedback Loop - {iteration+1}...", total=1)
                    feedback = self.orchestrator.providers['llama'].generate_response(
                        f"Analyze this response for improvements:\n{current_result}"
                    )
                    progress.update(task, completed=1)

                # Save feedback
                self.orchestrator.output_manager.save_output(
                    f"feedback_{iteration+1}.md",
                    feedback,
                    f"Meta Feedback - Iteration {iteration+1}"
                )

                # Skip refinement if feedback suggests termination
                if "TERMINATE" in feedback.upper():
                    break

                # Gemini Refinement
                with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
                    task = progress.add_task(f"✨ Step {4+iteration*2}: Refining output...", total=1)
                    current_result = self.orchestrator.providers['gemini'].generate_response(
                        f"Refine based on feedback:\n{feedback}\n\nPrevious response:\n{current_result}"
                    )
                    progress.update(task, completed=1)

                # Save refined result
                self.orchestrator.output_manager.save_output(
                    f"refined_result_{iteration+1}.md",
                    current_result,
                    f"Refined Response - Iteration {iteration+1}"
                )

            # Save final summary
            summary_data = {
                "timestamp": datetime.now().isoformat(),
                "original_prompt": prompt,
                "enhanced_prompt": enhanced_prompt,
                "final_result": current_result,
                "iterations_completed": iteration + 1
            }
            self.orchestrator.output_manager.save_summary(summary_data)

            # Display final results panel
            final_panel = Panel(
                f"""🎯 Original Prompt:
{prompt}

📝 Enhanced Prompt:
{enhanced_prompt}

📊 Final Result:
{current_result}""",
                title="🌟 Final Processing Results",
                style="green"
            )
            self.console.print("\n")
            self.console.print(final_panel)

            return current_result

        except Exception as e:
            error_panel = Panel(
                f"❌ Error during processing: {str(e)}",
                title="Error",
                style="bold red"
            )
            self.console.print(error_panel)
            
            # Save error to output manager
            if self.orchestrator:
                self.orchestrator.output_manager.save_output(
                    "error.md",
                    str(e),
                    "Error"
                )
            return None
    
    def run(self):
        try:
            # Setup
            self.display_header()
            self.display_capabilities()
            self.initialize_system()

            # Main interaction loop
            while True:
                self.console.print("\n" + "─" * 80)
                prompt = Prompt.ask("\n💭 Enter your prompt (or 'quit' to exit)")

                if prompt.lower() == 'quit':
                    break

                self.process_prompt(prompt)

                continue_prompt = Prompt.ask("\n🤔 Would you like to try another prompt? (y/n)", choices=["y", "n"], default="y")

                if continue_prompt.lower() != 'y':
                    break

            # Closing message
            self.console.print("\n👋 Thank you for using Orchnex Demo!", style="bold blue")

        except KeyboardInterrupt:
            self.console.print("\n\n❌ Demo interrupted by user", style="bold red")
        except Exception as e:
            self.console.print(f"\n❌ Fatal Error: {str(e)}", style="bold red")

def run_interactive_demo():
    demo = OrchnexDemo()
    demo.run()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Orchnex: Multi-LLM Orchestration Platform")
    parser.add_argument("--prompt", "-p", type=str, help="Prompt to process directly (non-interactive mode)")
    parser.add_argument("--ollama", "-o", action="store_true", help="Run locally using Ollama")
    parser.add_argument("--model-gen", type=str, default="llama3", help="Local generation model (default: llama3)")
    parser.add_argument("--model-eval", type=str, default="llama3", help="Local evaluation model (default: llama3)")
    parser.add_argument("--ollama-url", type=str, default="http://localhost:11434/v1", help="Ollama API URL")
    
    args = parser.parse_args()
    
    if args.prompt:
        demo = OrchnexDemo()
        demo.initialize_system_args(
            use_ollama=args.ollama,
            gemini_model=args.model_gen,
            llama_model=args.model_eval,
            ollama_url=args.ollama_url
        )
        demo.process_prompt(args.prompt)
    else:
        run_interactive_demo()

if __name__ == "__main__":
    main()
