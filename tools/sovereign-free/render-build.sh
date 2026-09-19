#!/usr/bin/env bash
set -euo pipefail
export SKIP_CUDA=1
export SKIP_ROCM=1
export SKIP_VULKAN=1
curl -LsSf https://llama.app/install.sh | sh
mkdir -p .atlas-sovereign/bin
cp "$HOME/.llama-app/llama" .atlas-sovereign/bin/llama
chmod 0755 .atlas-sovereign/bin/llama
.atlas-sovereign/bin/llama version
