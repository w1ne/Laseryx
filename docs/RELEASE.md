# Release Instructions

This document outlines the step-by-step process for releasing a new version of LaserFather.

## Prerequisites
- [ ] You are on the `develop` branch: `git checkout develop`
- [ ] Your local branch is up to date: `git pull origin develop`
- [ ] **Run pre-release verification**: `npm run pre-release`
  - This will run all tests, build, and lint checks
  - Must pass before proceeding with release

## Release Checklist

1.  **Update Documentation**
    - [ ] `docs/CHANGELOG.md`: Summarize changes for this version.


### Automated Release (Recommended)

Run the release script to automatically run tests, merge, bump version, tag, and push.

```bash
# For a patch release (0.1.0 -> 0.1.1)
npm run release patch

# For a minor release (0.1.0 -> 0.2.0)
npm run release minor
```

### GitHub Release (Final Step)
After the script finishes, creates the draft release on GitHub.

1.  Go to [Releases](https://github.com/w1ne/Laserfather/releases).
2.  Click **Draft a new release**.
3.  Choose the tag created by the script.
4.  Paste notes from `docs/CHANGELOG.md`.
5.  Publish.

---
## Best Practices
- **Semantic Versioning**: Follow [SemVer](https://semver.org/).
    - Major (1.0.0): Breaking changes
    - Minor (0.1.0): New features (backward compatible)
    - Patch (0.0.1): Bug fixes
- **Clean History**: Ensure `develop` is clean before starting.
- **Verification**: Always verify the live site (`https://laseryx.com/`) after deployment finishes.
