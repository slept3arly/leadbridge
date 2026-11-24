# LeadBridge Public Directory Cleanup Audit

Scope: the actual contents of `public/` and read-only repository searches for usage. All five files are SVG assets. Their XML/viewBox contents were inspected; no project files other than this requested report were changed.

## Asset inventory

| Asset | Purpose | References/usages | Current relevance | Recommendation | Risk |
|---|---|---|---|---|---|
| `public/file.svg` | Generic document/file glyph; SVG viewBox is 16×16. | No source, CSS, metadata, manifest, email, generated-content, or documentation reference found. No dynamic asset-path construction was found. | Appears to be an unused Next.js starter asset; no application relevance established. | REMOVE | Low for the checked-in app; removing the public URL could affect an unknown external consumer/bookmark. |
| `public/globe.svg` | Generic globe glyph; SVG viewBox is 16×16. | No project reference found. | Appears to be an unused Next.js starter asset; no application relevance established. | REMOVE | Low for the checked-in app; unknown external references cannot be ruled out. |
| `public/next.svg` | Next.js wordmark; SVG viewBox is 394×80. | No project reference found. The app is Next.js, but framework identity alone does not imply this public logo is used. | Default starter branding with no current application usage. | REMOVE | Low for checked-in functionality; no metadata or asset references found. |
| `public/vercel.svg` | Vercel triangle mark; SVG viewBox is 1155×1000. | No project reference found. No Vercel config or deployment use of this asset was identified in the inspected references. | Default starter branding with no current application usage. | REMOVE | Low for checked-in functionality; unknown external consumers cannot be ruled out. |
| `public/window.svg` | Generic browser-window glyph; SVG viewBox is 16×16. | No project reference found. | Appears to be an unused Next.js starter asset; no application relevance established. | REMOVE | Low for checked-in functionality; unknown external references cannot be ruled out. |

## Usage checks

- Filesystem verification found exactly the five listed files; no nested files or subdirectories were present in `public/`.
- Repository searches found no asset URL, CSS background, component/page reference, email/template reference, manifest reference, or dynamically assembled path naming these SVGs.
- `src/app/layout.tsx` defines application metadata; it does not refer to these SVGs. The application favicon is `src/app/favicon.ico`, separate from `public/`.
- `src/app/globals.css` and the inspected component background code do not refer to these SVGs. CSS uses application styles and generated backgrounds instead.
- No use of these files was found in root configuration, connector code, tests, scripts, or operational docs. The project inventory report lists them by filesystem presence, which is not an application dependency.
- The names and contents match generic Next.js starter assets. `next.svg` and `vercel.svg` are clear starter branding; the other three are generic UI glyphs. This classification follows their actual contents and absence of use rather than names alone.
- Static searches cannot establish whether an operator has copied one of the URLs into an external workflow or bookmarked it. No such use is represented in this repository.

## Recommendation

**Remove all five assets in a later approved cleanup change.** There is no in-repository consumer, metadata integration, CSS usage, or runtime path dependency. The application favicon is a separate file, and no application functionality or automated test should depend on these static URLs. The residual risk is limited to an untracked external consumer of a public URL; confirm that no such consumer exists if these URLs have previously been shared outside the repository.

## Summary

1. **Assets reviewed:** 5.
2. **Assets to keep:** None based on repository evidence.
3. **Assets confirmed unused in the repository:** `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg`.
4. **Assets requiring further investigation:** None in the repository; only possible external URL consumers remain unknowable from this checkout.
5. **Recommended cleanup actions:** After approval, remove the five unused starter assets; do not alter the separate `src/app/favicon.ico` as part of this directory cleanup.

This is an audit only. No assets were modified or removed.
