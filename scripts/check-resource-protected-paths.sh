#!/usr/bin/env bash
set -euo pipefail
BASE_REF="${1:-origin/main}"
CHANGED="$(git diff --name-only "$BASE_REF"...HEAD)"
PROTECTED_REGEX='^(src/components/halisia/spatial/|src/components/halisia/model-lab/|src/lib/spatial\.ts$|src/lib/spatial-three\.ts$|src/lib/spatial-platform\.ts$|public/_massing/)'
if echo "$CHANGED" | grep -E "$PROTECTED_REGEX" >/dev/null; then
  echo "ERROR: Resource Intelligence PR touches protected Spatial/AR/XR paths:" >&2
  echo "$CHANGED" | grep -E "$PROTECTED_REGEX" >&2
  exit 1
fi
echo "PASS: no protected Spatial/AR/XR paths changed."
