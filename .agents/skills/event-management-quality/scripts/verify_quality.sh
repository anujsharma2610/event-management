#!/usr/bin/env bash
# Quality and regression verification runner for Event Management
# Runs backend tests, backend linting, frontend tests, typecheck, linting, and build.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../../" && pwd)"

echo "=== Event Management Quality Verification ==="
echo "Repository Root: ${REPO_ROOT}"

echo ""
echo "--- 1. Backend Pytest Suite ---"
cd "${REPO_ROOT}/backend"
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
pytest -q

echo ""
echo "--- 2. Backend Ruff Checks ---"
ruff check .
ruff format --check .

echo ""
echo "--- 3. Frontend Tests ---"
cd "${REPO_ROOT}/frontend"
npm test

echo ""
echo "--- 4. Frontend Typecheck ---"
npm run typecheck

echo ""
echo "--- 5. Frontend ESLint ---"
npm run lint

echo ""
echo "--- 6. Frontend Production Build ---"
npm run build

echo ""
echo "=== All Quality Checks Passed Successfully ==="
