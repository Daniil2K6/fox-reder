#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODELS_DIR="$(dirname "$SCRIPT_DIR")/models"
mkdir -p "$MODELS_DIR"

MODEL_URL="${1:-https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf}"
MODEL_NAME="$(basename "$MODEL_URL")"

echo "=== Downloading model ==="
echo "URL:  $MODEL_URL"
echo "Name: $MODEL_NAME"
echo "Dest: $MODELS_DIR/$MODEL_NAME"
echo ""

if [ -f "$MODELS_DIR/$MODEL_NAME" ]; then
    echo "Model already exists, skipping."
    exit 0
fi

cd "$MODELS_DIR"
curl -L -o "$MODEL_NAME" "$MODEL_URL"

echo ""
echo "=== Download complete ==="
echo "Model: $MODELS_DIR/$MODEL_NAME"
