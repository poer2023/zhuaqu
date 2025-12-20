#!/bin/bash
# Run all tests
# Usage: ./tests/run-all.sh

set -e

echo "Running all tests..."
echo ""

npx tsx tests/orchestrator.test.ts
npx tsx tests/errors.test.ts
npx tsx tests/ai.test.ts
npx tsx tests/api.test.ts

echo ""
echo "✅ All test suites passed!"
