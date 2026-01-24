# Release Instructions

This document outlines the process for releasing a new version of LaserFather.

## Prerequisites
- [ ] Ensure all tests pass: `npm run test`
- [ ] Verify production build: `npm run build`
- [ ] Check console for errors in a local preview: `npm run preview`

## Release Checklist

1.  **Update Version**
    - Bump version in `package.json` (and `apps/pwa/package.json`).
    - Update `docs/CHANGELOG.md` with the new version number and date.

2.  **Verify Documentation**
    - Ensure `README.md` features are up to date.
    - Check `docs/roadmap.md` reflects current progress.
    - Check `architecture.md` and `interfaces.md` for any missing details.

3.  **Commit and Tag**
    ```bash
    git add .
    git commit -m "chore: release v1.x.x"
    git tag v1.x.x
    git push origin main --tags
    ```

4.  **Deployment**
    - The CI/CD pipeline (GitHub Actions) will automatically deploy to GitHub Pages when a tag is pushed.
    - Verify the live site works after deployment.

## Best Practices
- **Semantic Versioning**: Follow [SemVer](https://semver.org/).
    - Major (1.0.0): Breaking changes
    - Minor (0.1.0): New features (backward compatible)
    - Patch (0.0.1): Bug fixes
- **Clean Commits**: Squash merge PRs to keep history clean.
- **Testing**: Always run the full test suite before tagging.
