# Roadmap

## Product phases (feature track)

- Phase 01 — Core Stabilization & Bug Fixes
- Phase 02 — Proverbs Migration
- Phase 03 — Reading Experience & Wisdom Journey UX
- Phase AI-01 — Provider-Agnostic AI Foundation
- Phase AI-01B — Bible Knowledge Base (RAG Preparation)
- Phase AI-03 — Semantic Search Engine
- Phase AI-07 — AI Reflection & Journal
- Phase CI-01 — Canonical Intelligence Layer

## Production readiness track (PR series)

| PR | Fokus | Status |
| --- | --- | --- |
| PR-001 | Storage Robustness | ✅ Selesai |
| PR-002 | Service Worker Reliability | ✅ Selesai |
| PR-004 | Router & Navigation (History API) | ✅ Selesai |
| PR-005 | Data Validation & Import Safety | ✅ Selesai |
| PR-006 | Security & DOM Hardening | ✅ Selesai |
| PR-007 | Accessibility Enhancement | ✅ Selesai |
| PR-010 | Production Verification & Release Candidate | ✅ Selesai (RC) |

## Setelah Release Candidate

- Verifikasi manual lintas-browser (Chrome, Edge, Firefox, Safari, Android/iOS).
- Audit Lighthouse/axe otomatis di CI (opsional) untuk regresi a11y/performa.
- Cloudflare Pages Function/Worker untuk proxy `/bible/*` bila deploy ke Cloudflare.
- Promosi RC → rilis stabil (`v2.0.0`) setelah smoke test produksi lolos.
