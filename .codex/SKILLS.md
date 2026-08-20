# AB3D repository skills

These project-local skills are intentionally limited to the workflows AB3D needs. They are loaded on demand; no script runs automatically.

## Installed and reviewed on 2026-08-01

| Source | Skills | Why AB3D needs them |
|---|---|---|
| [meshy-dev/meshy-3d-agent](https://github.com/meshy-dev/meshy-3d-agent) | `meshy-3d-generation`, `meshy-3d-printing` | Official Meshy generation, print analysis, repair, scaling, formats and slicer workflows |
| [anthropics/skills](https://github.com/anthropics/skills) | `frontend-design` | Intentional, non-generic interface and interaction design |
| [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `web-quality-audit`, `performance`, `core-web-vitals`, `accessibility`, `seo`, `best-practices` | Lighthouse-style release quality, WCAG, performance and discoverability |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | `product-marketing`, `customer-research`, `cro`, `pricing`, `analytics`, `copywriting` | Customer research, conversion, pricing, measurement and shop messaging |

## Local hardening

- Removed third-party `allowed-tools` declarations. Codex and repository approval rules remain authoritative.
- Meshy secrets stay server-side and must never be committed. The repository contains no `msy_` key.
- Meshy tasks that consume credits require explicit confirmation before a direct skill-driven run.
- The bundled OBJ fixer was changed to write a separate `.fixed.obj` file and refuse source overwrite.
- Meshy Python console output was made Windows-safe.
- Broken optional marketing-tool links were replaced with self-contained guidance.

## Validation performed

- Every installed `SKILL.md` was read and source-reviewed.
- All Python helper files pass AST parsing.
- Relative Markdown references resolve after local hardening.
- Meshy environment detection works with an isolated `requests` install; no local key is persisted.
- Slicer detection runs read-only and reports no supported slicer on this computer.
- The OBJ coordinate/scale fixture completed at 80 mm without changing the source file.
- The application remains subject to ESLint and the full production build before deployment.

Restart Codex, or begin a new task, after installation so the repo-local skill catalog is refreshed.
