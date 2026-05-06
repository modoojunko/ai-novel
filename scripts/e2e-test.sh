#!/bin/bash
# End-to-end smoke test for the 6-phase novel workflow.
# Requires: docker compose up -d, ANTHROPIC_API_KEY set in .env
# Usage: ./scripts/e2e-test.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://localhost:8000}"
PASS=1

check() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  PASS $label"
  else
    echo "  FAIL $label — expected '$expected', got: $(echo "$actual" | head -c 200)"
    PASS=0
  fi
}

echo "=== E2E Smoke Test — Novel SaaS ==="
echo "Base URL: $BASE"
echo ""

# ── Health ──
echo "[1/11] Health check"
R=$(curl -s "$BASE/api/health")
check "health" '"status":"ok"' "$R"

# ── Auth ──
echo "[2/11] Register"
R=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@test.com","password":"testpass123","display_name":"E2E Tester"}')
check "register" '"access_token"' "$R"
TOKEN=$(echo "$R" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
echo "       token: ${TOKEN:0:20}..."

echo "[3/11] Login"
R=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@test.com","password":"testpass123"}')
check "login" '"access_token"' "$R"

echo "[4/11] Get me"
R=$(curl -s "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
check "me" '"email":"e2e@test.com"' "$R"

# ── Projects ──
echo "[5/11] Create project"
R=$(curl -s -X POST "$BASE/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test Novel"}')
check "create project" '"slug"' "$R"
PID=$(echo "$R" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
SLUG=$(echo "$R" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)
echo "       project: $SLUG ($PID)"

echo "[6/11] List projects"
R=$(curl -s "$BASE/api/projects" -H "Authorization: Bearer $TOKEN")
check "list projects" "E2E Test Novel" "$R"

# ── Settings ──
echo "[7/11] Write world setting"
R=$(curl -s -X PUT "$BASE/api/projects/$PID/settings/world" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"era":"2020s","location":"Shanghai","geography":"Urban","politics":"Corporate","culture":"Modern Chinese"}')
check "save world setting" '"ok":true' "$R"

echo "[8/11] Write style setting"
R=$(curl -s -X PUT "$BASE/api/projects/$PID/settings/style" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"当代都市小说家","genre":"urban-romance"}')
check "save style" '"ok":true' "$R"

echo "[9/11] Read settings back"
R=$(curl -s "$BASE/api/projects/$PID/settings/world" -H "Authorization: Bearer $TOKEN")
check "read world" '"era":"2020s"' "$R"

# ── Volumes ──
echo "[10/11] Create volume (triggers settings→outline gate)"
R=$(curl -s -X POST "$BASE/api/projects/$PID/volumes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vol_num":1,"title":"The Beginning"}')
check "create volume" '"vol_num":1' "$R"

# ── Billing ──
echo "[11/11] Check billing"
R=$(curl -s "$BASE/api/billing/usage" -H "Authorization: Bearer $TOKEN")
check "billing usage" '"total_tokens"' "$R"

echo ""
if [ "$PASS" -eq 1 ]; then
  echo "=== All smoke tests PASSED ==="
  exit 0
else
  echo "=== Some tests FAILED ==="
  exit 1
fi
