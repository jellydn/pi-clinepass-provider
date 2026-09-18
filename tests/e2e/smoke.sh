#!/usr/bin/env bash
# E2E smoke tests for pi-clinepass-provider
# Tests real API calls against Cline's /api/v1/chat/completions endpoint.
#
# Usage:
#   CLINE_API_KEY=your_key bash tests/e2e/smoke.sh
#
# Requires: pi (coding agent) installed and this provider accessible.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# ─── Config ──────────────────────────────────────────────────────────────────

PROVIDER_PATH="$(cd "$(dirname "$0")/../.." && pwd)"
TIMEOUT="${TIMEOUT:-45}"
API_BASE="${CLINE_API_BASE:-https://api.cline.bot}"

if [ -z "${CLINE_API_KEY:-}" ]; then
  echo -e "${RED}ERROR: CLINE_API_KEY not set${NC}"
  echo "Usage: CLINE_API_KEY=your_key bash tests/e2e/smoke.sh"
  exit 1
fi

if ! command -v pi &>/dev/null; then
  echo -e "${RED}ERROR: pi not found on PATH${NC}"
  echo "Install: npm install -g @earendil-works/pi-coding-agent"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ClinePass Provider — E2E Smoke Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Helpers ─────────────────────────────────────────────────────────────────

run_test() {
  local name="$1"
  local model="$2"
  local prompt="$3"
  local expected="$4"

  echo -n "  $name ... "

  # Run pi with the model and capture output
  output=$(timeout "$TIMEOUT" pi --no-extensions \
    -e "$PROVIDER_PATH" \
    --model "clinepass/$model" \
    --no-tools \
    -p "$prompt" 2>&1) || true

  # Check if output contains expected string (case-insensitive)
  if echo "$output" | grep -qi "$expected"; then
    echo -e "${GREEN}PASS${NC}"
    ((PASS++)) || true
  else
    echo -e "${RED}FAIL${NC}"
    echo "    Expected output to contain: $expected"
    echo "    Got: $(echo "$output" | head -3)"
    ((FAIL++)) || true
  fi
}

# ─── API Auth Check ──────────────────────────────────────────────────────────

echo -e "${YELLOW}1. API Authentication${NC}"
echo -n "  Auth check ... "
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_BASE/api/v1/chat/completions" \
  -H "Authorization: Bearer $CLINE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"cline-pass/deepseek-v4.1-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' 2>&1) || true

if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
  echo -e "${GREEN}PASS${NC}"
  ((PASS++)) || true
else
  echo -e "${RED}FAIL${NC}"
  echo "    API key is invalid or API is unreachable (HTTP $status)"
  ((FAIL++)) || true
fi

echo ""

# ─── Model Smoke Tests ──────────────────────────────────────────────────────

echo -e "${YELLOW}2. Model Smoke Tests${NC}"

# Test with the cheapest/fastest model first
run_test "DeepSeek V4.1 Flash (simple math)" \
  "cline-pass/deepseek-v4.1-flash" \
  "What is 2+3? Answer with just the number." \
  "5"

run_test "DeepSeek V4.1 Flash (knowledge)" \
  "cline-pass/deepseek-v4.1-flash" \
  "What is the capital of Japan? One word." \
  "tokyo"

run_test "MiMo V2.5 (simple math)" \
  "cline-pass/mimo-v2.5" \
  "What is 6+2? Answer with just the number." \
  "8"

run_test "GLM-5.3-Flash (simple math)" \
  "cline-pass/glm-5.3-flash" \
  "What is 4+5? Answer with just the number." \
  "9"

run_test "Muse Spark 1.3 Contributor (simple math)" \
  "cline-pass/muse-spark-1.3-contributor" \
  "What is 7+6? Answer with just the number." \
  "13"

echo ""

# ─── Error Handling ──────────────────────────────────────────────────────────

echo -e "${YELLOW}3. Error Handling${NC}"

echo -n "  Invalid API key ... "
output=$(CLINE_API_KEY="invalid_key_12345" \
  timeout "$TIMEOUT" pi --no-extensions \
  -e "$PROVIDER_PATH" \
  --model "clinepass/cline-pass/deepseek-v4.1-flash" \
  --no-tools \
  -p "test" 2>&1) || true

if echo "$output" | grep -qi "401\|403\|unauthorized\|invalid.*key\|authentication"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASS++)) || true
else
  echo -e "${RED}FAIL${NC}"
  echo "    Expected error for invalid key"
  echo "    Got: $(echo "$output" | head -3)"
  ((FAIL++)) || true
fi

echo -n "  Invalid model ID ... "
output=$(timeout "$TIMEOUT" pi --no-extensions \
  -e "$PROVIDER_PATH" \
  --model "clinepass/cline-pass/nonexistent-model-xyz" \
  --no-tools \
  -p "test" 2>&1) || true

if echo "$output" | grep -qi "error\|not found\|invalid.*model\|does not exist"; then
  echo -e "${GREEN}PASS${NC}"
  ((PASS++)) || true
else
  echo -e "${RED}FAIL${NC}"
  echo "    Expected error for invalid model"
  echo "    Got: $(echo "$output" | head -3)"
  ((FAIL++)) || true
fi

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}PASS${NC}: $PASS  ${RED}FAIL${NC}: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
