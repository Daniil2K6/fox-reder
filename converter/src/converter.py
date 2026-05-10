#!/usr/bin/env python3
import argparse
import json
import logging
import sys
from pathlib import Path

from llm_client import is_server_running, generate_json

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("converter")


def read_prompt(name: str) -> str:
    prompts_dir = Path(__file__).resolve().parent.parent / "prompts"
    path = prompts_dir / name
    if not path.exists():
        logger.warning(f"Prompt not found: {path}")
        return ""
    return path.read_text(encoding="utf-8")


def load_fb2(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def convert_book(fb2_path: Path, output_path: Path):
    if not is_server_running():
        logger.error(
            "LLM server is not running.\n"
            f"Start it with:\n"
            f"  ./converter/llama.cpp/build/bin/llama-server "
            f"-m converter/models/model.q4_K_M.gguf --port 8080"
        )
        sys.exit(1)

    logger.info(f"Reading: {fb2_path}")
    fb2_content = load_fb2(fb2_path)

    system_prompt = read_prompt("fb2_to_vblite.md")
    logger.info("Sending to LLM...")

    result = generate_json(
        prompt=f"Проанализируй эту FB2 книгу:\n\n{fb2_content[:50000]}",
        system_prompt=system_prompt,
    )

    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Saved: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Convert FB2 to VoxBook VBLite")
    parser.add_argument("--input", "-i", required=True, help="Input .fb2 file")
    parser.add_argument("--output", "-o", required=True, help="Output .vb file")
    args = parser.parse_args()

    convert_book(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()
