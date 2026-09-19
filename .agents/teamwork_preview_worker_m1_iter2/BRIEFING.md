# BRIEFING — 2026-09-18T17:06:02Z

## Mission
Remediate Milestone M1 defects identified by Challenger 1: fix corrupt cache handling in js/app.js, enforce schema validation rejection in js/api.js, and verify all tests pass with 0 errors.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2
- Original parent: 410c71bb-1246-46b3-881c-e71b08c2047a
- Milestone: M1 Iteration 2 (Data Engine & API Resilience Remediation)

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results or create dummy/facade implementations.
- Minimal changes only: do not perform unrelated refactoring.
- js/app.js: In bootstrap(), validate candidate data contains candidate.forecast && candidate.forecast.daily. If corrupt/missing, show #err-box ("SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ"), set data-state="ready", return cleanly.
- js/api.js: In fetchForecast, fetchAirQuality, and fetchMarine, remove '|| raw'. Throw Error or return null on schema validation failure.
- All 3 tests (test_m1_units.js, test_api_fallback.js, test_stress_m1.js) must pass with exit code 0 and 0 console errors.

## Current Parent
- Conversation ID: 410c71bb-1246-46b3-881c-e71b08c2047a
- Updated: not yet

## Task Summary
- **What to build**: Fix js/app.js bootstrap fallback logic to safely validate candidate.forecast && candidate.forecast.daily before calling buildDaily. Fix js/api.js fetchForecast, fetchAirQuality, and fetchMarine to not fall back to unvalidated raw objects.
- **Success criteria**: Zero unhandled exceptions on corrupt cache; schema defense strictly enforced; test_m1_units.js, test_api_fallback.js, and test_stress_m1.js all pass with exit code 0.
- **Interface contracts**: /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md § Interface Contracts
- **Code layout**: /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/orchestrator/PROJECT.md § Code Layout

## Key Decisions Made
- Will check schema validation return in js/api.js and throw/return null instead of using `|| raw`.
- In js/app.js, ensure candidate has both candidate.forecast and candidate.forecast.daily before using it.

## Artifact Index
- /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2/DISPATCH.md — Assignment instructions
- /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2/BRIEFING.md — Persistent context & memory
- /home/rafamass/Área de trabalho/COTADECLIMAO/.agents/teamwork_preview_worker_m1_iter2/progress.md — Liveness heartbeat

## Change Tracker
- **Files modified**: none yet
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending verification
- **Lint status**: 0 violations
- **Tests added/modified**: pending run

## Loaded Skills
- None
