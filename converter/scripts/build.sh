#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONVERTER_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building llama.cpp ==="

if [ ! -d "$CONVERTER_DIR/llama.cpp" ]; then
    echo "Cloning llama.cpp..."
    git clone --depth 1 https://github.com/ggerganov/llama.cpp "$CONVERTER_DIR/llama.cpp"
fi

cd "$CONVERTER_DIR/llama.cpp"
mkdir -p build
cd build

cmake .. -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 4)

echo ""
echo "=== Build complete ==="
echo "Server: $CONVERTER_DIR/llama.cpp/build/bin/llama-server"
echo "CLI:    $CONVERTER_DIR/llama.cpp/build/bin/llama-cli"
