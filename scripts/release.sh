#!/bin/bash
set -e

# Usage: ./scripts/release.sh [minor|patch|major]

VERSION_TYPE=$1
if [ -z "$VERSION_TYPE" ]; then
    echo "Usage: ./scripts/release.sh [minor|patch|major]"
    exit 1
fi

echo "🚀 Starting Release Process ($VERSION_TYPE)..."

# 1. Ensure we are on the release trunk and clean
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Releases must run from main (currently $CURRENT_BRANCH)."
    exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree must be clean before release."
    exit 1
fi
git pull --ff-only origin main

# 2. Run Quality Checks
echo "🧪 Running Tests & Lint..."
npm ci
npm run lint
npm test
npm run build
npm --prefix apps/pwa run cli:build
npm --prefix apps/pwa run mcp:build
npm --prefix apps/pwa run hosted-mcp:build


# 3. Bump Version
echo "📦 Bumping Version..."
# Bump root package (creates git tag)
npm version $VERSION_TYPE --no-git-tag-version

# Extract new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New Version: $NEW_VERSION"

# Bump App package (manual sync)
cd apps/pwa
npm version $NEW_VERSION --no-git-tag-version
cd ../..

# 4b. Sync Root Lockfile (Critical for npm ci)
echo "🔄 Syncing lockfile..."
npm install --package-lock-only --ignore-scripts

# 5. Commit and Tag
git add .
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# 6. Push
echo "⬆️ Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION completed successfully!"
