# src/orchnex/context_scanner.py
import os
import json

class ProjectContextScanner:
    """Scans the current workspace to extract framework, dependencies, and project structure context."""
    
    def __init__(self, root_dir: str = None):
        self.root_dir = root_dir or os.getcwd()

    def scan(self) -> str:
        context_parts = []
        
        # 1. Scan package.json for frontend/node dependencies
        pkg_path = os.path.join(self.root_dir, "package.json")
        if not os.path.exists(pkg_path):
            # Check frontend directory
            pkg_path = os.path.join(self.root_dir, "frontend", "package.json")
            
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    deps = list(data.get("dependencies", {}).keys())[:10]
                    dev_deps = list(data.get("devDependencies", {}).keys())[:5]
                    context_parts.append(f"Dependencies: {', '.join(deps)}")
                    if dev_deps:
                        context_parts.append(f"DevDependencies: {', '.join(dev_deps)}")
            except Exception:
                pass

        # 2. Check key configuration files
        configs = []
        if os.path.exists(os.path.join(self.root_dir, "tsconfig.json")) or os.path.exists(os.path.join(self.root_dir, "frontend", "tsconfig.json")):
            configs.append("TypeScript")
        if os.path.exists(os.path.join(self.root_dir, "tailwind.config.js")) or os.path.exists(os.path.join(self.root_dir, "frontend", "tailwind.config.js")) or os.path.exists(os.path.join(self.root_dir, "frontend", "tailwind.config.ts")):
            configs.append("Tailwind CSS")
        if os.path.exists(os.path.join(self.root_dir, "requirements.txt")) or os.path.exists(os.path.join(self.root_dir, "pyproject.toml")):
            configs.append("Python Backend")

        if configs:
            context_parts.append(f"Tech Stack / Configs: {', '.join(configs)}")

        # 3. Directory layout snippet
        top_dirs = []
        try:
            for item in os.listdir(self.root_dir):
                if not item.startswith(".") and os.path.isdir(os.path.join(self.root_dir, item)):
                    top_dirs.append(item)
            if top_dirs:
                context_parts.append(f"Root Folders: {', '.join(top_dirs[:6])}")
        except Exception:
            pass

        if not context_parts:
            return "Generic Standalone Environment"

        return "\n".join(context_parts)
