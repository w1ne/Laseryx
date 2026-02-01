#!/bin/bash
# Pre-release verification script
# Run this before creating any release to ensure code quality

set -e  # Exit on any error

echo "🔍 Pre-Release Verification Starting..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

echo "📦 Step 1/5: Installing dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo "🧪 Step 2/5: Running tests..."
if npm --prefix apps/pwa run test; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    FAILED=1
fi
echo ""

echo "🔨 Step 3/5: Building production bundle..."
if npm --prefix apps/pwa run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    FAILED=1
fi
echo ""

echo "🔍 Step 4/5: Running linter..."
if npm --prefix apps/pwa run lint; then
    echo -e "${GREEN}✓ Linter passed (0 errors)${NC}"
else
    # Check if it's only warnings
    if npm --prefix apps/pwa run lint 2>&1 | grep -q "0 errors"; then
        echo -e "${YELLOW}⚠ Linter passed with warnings (acceptable)${NC}"
    else
        echo -e "${RED}✗ Linter failed with errors${NC}"
        FAILED=1
    fi
fi
echo ""

echo "📝 Step 5/5: Checking version consistency..."
PWA_VERSION=$(node -p "require('./apps/pwa/package.json').version")
ROOT_VERSION=$(node -p "require('./package.json').version")

if [ "$PWA_VERSION" = "$ROOT_VERSION" ]; then
    echo -e "${GREEN}✓ Version consistent: $PWA_VERSION${NC}"
else
    echo -e "${RED}✗ Version mismatch: apps/pwa=$PWA_VERSION, root=$ROOT_VERSION${NC}"
    FAILED=1
fi
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for release.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update CHANGELOG.md"
    echo "  2. git commit -m \"Release vX.Y.Z\""
    echo "  3. git tag -a vX.Y.Z -m \"Release X.Y.Z\""
    echo "  4. git push origin develop && git push origin vX.Y.Z"
    exit 0
else
    echo -e "${RED}❌ Pre-release checks failed. Please fix the issues above.${NC}"
    exit 1
fi
