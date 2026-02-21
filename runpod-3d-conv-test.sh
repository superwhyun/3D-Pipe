#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-input.glb>"
  exit 1
fi

if [[ -z "${RUNPOD_API_KEY:-}" ]]; then
  echo "RUNPOD_API_KEY env is required"
  exit 1
fi

INPUT_GLB="$1"
ENDPOINT_ID="${RUNPOD_ENDPOINT_ID:-696mgv36xfw0jc}"
RUNPOD_URL="https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync"

if [[ ! -f "$INPUT_GLB" ]]; then
  echo "Input file not found: $INPUT_GLB"
  exit 1
fi

GLB_BASE64="$(base64 < "$INPUT_GLB" | tr -d '\n')"
FILENAME="$(basename "$INPUT_GLB")"

curl -i -X POST "$RUNPOD_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
  -d "{\"input\":{\"glb_base64\":\"${GLB_BASE64}\",\"filename\":\"${FILENAME}\"}}"
