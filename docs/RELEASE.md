# Release Instructions

This document outlines the step-by-step process for releasing a new version of LaserFather.

## Prerequisites
- [ ] You are on the `develop` branch: `git checkout develop`
- [ ] Your local branch is up to date: `git pull origin develop`
- [ ] All tests pass locally: `npm run test`
- [ ] Production build succeeds: `npm run build`

## Release Checklist

### 1. Merge Develop to Master
The `master` branch is for stable releases only.

```bash
# Swith to master and update
git checkout master
git pull origin master

# Merge develop into master
git merge develop
```

### 2. Update Version & Changelog
Bump the version number for the release.

1.  **package.json**: Update `version` to `x.x.x` in root.
2.  **apps/pwa/package.json**: Update `version` to `x.x.x` in app.
3.  **docs/CHANGELOG.md**: Add header `## X.X.X - YYYY-MM-DD` and move "Unreleased" changes under it.

### 3. Commit and Tag
Create the release commit and tag on `master`.

```bash
# Stage changes
git add .

# Commit with release message
git commit -m "chore: release v1.1.0"

# Create a signed tag (optional but recommended)
git tag v1.1.0
```

### 4. Push Release
Push the `master` branch and the new tag to GitHub. **This triggers the Deployment Pipeline.**

```bash
# Push commits
git push origin master

# Push tags (This triggers deployment!)
git push origin v1.1.0
```

### 5. Sync Develop
Merge the release commit (version bump) back into `develop` so development continues with the correct version history.

```bash
git checkout develop
git merge master
git push origin develop
```

### 6. GitHub Release
Create the official release on GitHub.

1.  Go to [Releases](https://github.com/w1ne/Laserfather/releases).
2.  Click **Draft a new release**.
3.  Choose the tag you just pushed (`v1.1.0`).
4.  Paste the release notes from `docs/CHANGELOG.md`.
5.  Click **Publish release**.

Alternatively, use the CLI:
```bash
gh release create v1.1.0 --title "v1.1.0" --notes-file release_notes.txt
```

## Best Practices
- **Semantic Versioning**: Follow [SemVer](https://semver.org/).
    - Major (1.0.0): Breaking changes
    - Minor (0.1.0): New features (backward compatible)
    - Patch (0.0.1): Bug fixes
- **Clean History**: Ensure `develop` is clean before starting.
- **Verification**: Always verify the live site (`https://w1ne.github.io/Laserfather/`) after deployment finishes.
