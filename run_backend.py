"""
Convenience launcher: run from the TerraLearn project root with:
    python run_backend.py
"""
import subprocess
import sys
from pathlib import Path

backend_dir = Path(__file__).parent / "backend"
sys.exit(
    subprocess.call(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
        cwd=str(backend_dir),
    )
)
