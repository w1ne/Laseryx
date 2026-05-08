#!/bin/bash
set -e

# Usage: ./scripts/release.sh [minor|patch|major]

VERSION_TYPE=$1
if [ -z "$VERSION_TYPE" ]; then
    echo "Usage: ./scripts/release.sh [minor|patch|major]"
    exit 1
fi

echo "🚀 Starting Release Process ($VERSION_TYPE)..."

# 1. Ensure we are on develop and clean
git checkout develop
git pull origin develop

# 2. Run Quality Checks
echo "🧪 Running Tests & Lint..."
npm ci
npm run lint
npm test
npm run build
npm --prefix apps/pwa run cli:build
npm --prefix apps/pwa run mcp:build
npm --prefix apps/pwa run hosted-mcp:build


# 3. Merge to Master
echo "🔀 Merging develop -> master..."
git checkout master
git pull origin master
git merge develop

# 4. Bump Version
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
git push origin master
git push origin "v$NEW_VERSION"

# 7. Sync Develop
echo "🔄 Syncing back to develop..."
git checkout develop
git merge master
git push origin develop

echo "✅ Release v$NEW_VERSION completed successfully!"
