#!/bin/bash
# CLI QA harness for the rules write-through loop (ship-rehearsal Phase 3).
# Usage: scripts/rehearse-rules.sh   (run from the repo root)
# Exercises: live GET -> POST a probe change -> verify the repo commit ->
# revert -> verify. Safe: the probe value returns to its original state.

set -euo pipefail
SITE="https://try-ballast.netlify.app"
REPO="A-Raphie/ballast"
PROBE=617   # staleMaxSeconds 600 -> 617 -> 600 (harmless, clearly a probe)

fail() { echo "FAIL: $1"; exit 1; }

echo "[1/5] GET live policy"
LIVE=$(curl -sf "$SITE/api/policy") || fail "live /api/policy unreachable"
echo "$LIVE" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['version'], 'no version'" || fail "policy malformed"

echo "[2/5] POST probe change (staleMaxSeconds -> $PROBE)"
RES=$(curl -sf -X POST "$SITE/api/policy" -H "content-type: application/json" \
  -d "{\"knobs\":{\"staleMaxSeconds\":$PROBE}}") || fail "POST failed"
echo "$RES" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['ok'], d" || fail "POST rejected"
VERSION=$(echo "$RES" | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])")
echo "    committed as policy v$VERSION"

echo "[3/5] verify the repo carries the probe"
sleep 3
REPO_V=$(gh api "repos/$REPO/contents/policy/policy.json" --jq .content | base64 -d | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])")
[ "$REPO_V" = "$VERSION" ] || fail "repo at v$REPO_V, expected v$VERSION"
echo "    repo at v$REPO_V"

echo "[4/5] revert the probe"
curl -sf -X POST "$SITE/api/policy" -H "content-type: application/json" \
  -d '{"knobs":{"staleMaxSeconds":600}}' > /dev/null || fail "revert POST failed"
sleep 3
REPO_V2=$(gh api "repos/$REPO/contents/policy/policy.json" --jq .content | base64 -d | python3 -c "import json,sys; print(json.load(sys.stdin)['knobs']['staleMaxSeconds'])")
[ "$REPO_V2" = "600" ] || fail "revert did not land (got $REPO_V2)"
echo "    reverted to 600"

echo "[5/5] PASS: rules write-through round-trips on $SITE"
