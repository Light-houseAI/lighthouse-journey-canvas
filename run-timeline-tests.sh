#!/bin/bash

# Timeline Tests Runner Script
# This script runs the consolidated timeline test suite against the existing server

echo "🧪 Hierarchical Timeline Test Suite Runner"
echo "=========================================="
echo ""

# Check if server is running on port 5004
if ! curl -s http://localhost:5004 > /dev/null; then
    echo "❌ Server not running on localhost:5004"
    echo "Please start the server first with: npm run dev:mock"
    exit 1
fi

echo "✅ Server detected on localhost:5004"
echo ""

# Run timeline tests with custom config
echo "🚀 Running consolidated timeline tests..."
echo ""

# Option 1: Run all consolidated timeline tests
npx playwright test tests/e2e/consolidated-timeline-tests.spec.ts \
    --config=playwright-timeline.config.ts \
    --reporter=list

echo ""
echo "📊 Test Results:"
echo "- Check the console output above for detailed results"
echo "- HTML report available at: test-results/timeline-report/index.html" 
echo "- Screenshots and videos saved in: test-results/"
echo ""

# Optional: Open HTML report
read -p "🔍 Open HTML test report? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open test-results/timeline-report/index.html || xdg-open test-results/timeline-report/index.html
fi

echo ""
echo "✅ Timeline test execution complete!"