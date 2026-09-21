---
target: pagina admin
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-09-21T02-35-24Z
slug: admin-index-html
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading indicator on initial data fetch; stat cards hardcode `<strong>0</strong>`, indistinguishable from a real zero until data lands |
| 2 | Match System / Real World | 4 | Precise genealogical vocabulary throughout (event/story roles, tree convention) |
| 3 | User Control and Freedom | 3 | Modals have working Esc/focus-trap/restore; deletes have no undo (mitigated by strong confirmations) |
| 4 | Consistency and Standards | 3 | 13 panels share one rigorous CRUD pattern — except the highest-stakes action (privacy toggle), which breaks it |
| 5 | Error Prevention | 3 | Cascade-aware delete confirmations; but "required" signaling is inconsistent across forms |
| 6 | Recognition Rather Than Recall | 3 | Consistent color-coded icon taxonomy aids scanning |
| 7 | Flexibility and Efficiency | 2 | No bulk actions anywhere; every one of 13 tables defaults to 5 rows/page |
| 8 | Aesthetic and Minimalist Design | 2 | All 13 panels are literally one concatenated DOM scroll under `#dashboard`, not isolated views |
| 9 | Error Recovery | 2 | Raw Postgres/Supabase error strings surfaced verbatim to a non-technical audience |
| 10 | Help and Documentation | 2 | Only a WhatsApp link and scattered `.hint` text; no formal help layer (heuristic genuinely applies here — Operate mode) |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment (A):** Split verdict. The domain modeling is genuinely bespoke — a live biography narrator turns structured dates/relationships into warm contextual Portuguese prose, the genealogy tree uses real domain interactions, and role vocabulary is precise. But the visual chrome — navy sidebar, blue stat-card grid, the identical toolbar+table+modal pattern repeated 13 times — is an interchangeable generic admin template. Nothing in color, type, or layout evokes "family archive/heirloom" the way the gold tree-of-life login logo does.

**Deterministic scan (B):** `detect.mjs --json admin/index.html` exits 0 (no blocking findings) but flags one advisory: **em-dash-overuse** — 45 em-dashes counted in the file's body text. Assessment A did not surface this independently. Worth a manual pass to separate real prose copy from code/comment noise.

**Visual overlays:** Not available this run. Injection was attempted on the one reachable screen (login) and was correctly blocked by the admin panel's own CSP (`script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'`) — a real working security control, not a tool failure.

## Overall Impression

The bones are unusually solid for a backoffice built this fast: entity-specific delete confirmations, a working focus-trap/Esc modal system, and a genuinely delightful biography narrator feature. But the app never graduated from "one long HTML file with sections" to "an app with views" — all 13 panels are permanently mounted and concatenated in the DOM, navigated by anchor-scroll instead of real show/hide. That single architectural shortcut is the root cause of most of what's actually wrong here, and it's a smaller fix than it sounds — the operador's reduced view already proves the show/hide mechanism exists; it's just never been applied to the full admin/editor view.

## What's Working

1. **The automatic biography narrator.** Converts structured person data into live contextual Portuguese prose as you edit — the single most product-specific, emotionally resonant feature here.
2. **Cascade-aware delete confirmations.** Every delete names the exact record and explains exactly what else breaks. For an archive of irreplaceable family material, this is precisely the trust-building an "are you sure?" should do.
3. **The quick-add-and-relink chip workflow.** Story/Photo/Event/Document/Source modals let a user jump out to create a missing related record and return auto-linked, without losing their place — a real accommodation for how genealogical research actually happens.

## Priority Issues

**[P0] Single-page "fake navigation" architecture**
- Why it matters: All 13 panels are one continuously concatenated DOM/scroll under `#dashboard` (`admin/index.html` lines 37–288); the sidebar does anchor-scroll via `IntersectionObserver`, not real view switching. Every login fetches every panel's data regardless of which one the user opened.
- Fix: Hide every `.panel` except the active one — the exact mechanism already used for the operador's reduced view — and lazy-load each panel's data on first activation.
- Suggested command: $impeccable layout

**[P1] Collapsed-sidebar icon state is defined in CSS but never implemented in markup**
- Why it matters: `admin.css` has a full icon-swap system for `.sidebar.collapsed` but nav items are plain text with no icon element. Using the collapse button currently degrades to unlabeled, clipped text nubs.
- Fix: Reuse the existing per-entity SVG icon paths inside a `.nav-icon` wrapper per nav item, wrap label text in `.nav-label`.
- Suggested command: $impeccable harden

**[P1] Native confirm() on the privacy toggle breaks the app's own confirmation pattern**
- Why it matters: Every delete routes through the app's styled, accessible confirmDeleteModal — except the privacy toggle, which drops to a bare window.confirm(). This is the single most consequential toggle in the product, and it abandons the on-brand accessible pattern right when reassurance matters most.
- Fix: Generalize confirmDelete(title, message) into a reusable confirmAction() and route the privacy toggle through it.
- Suggested command: $impeccable harden

**[P2] Raw backend errors reach non-technical users**
- Why it matters: showError(el, error.message) surfaces untranslated Postgres/Supabase text verbatim on login failure, privacy save, branding save, and plan save, reaching an audience the product defines as non-technical.
- Fix: A small error-code to plain-Portuguese translation map, with the raw message behind a collapsed "detalhes técnicos" toggle.
- Suggested command: $impeccable clarify

**[P2] Every one of 13 tables defaults to 5 rows per page**
- Why it matters: All entity panels hardcode 5 rows/page, punishing the single most frequent action (scanning/finding a record) for both the family admin and an operador managing several client sites.
- Fix: Default to 15–30 and persist the user's last-chosen size.
- Suggested command: $impeccable optimize

## Persona Red Flags

**Alex (Power User):** No bulk select/delete/publish anywhere. The 5-row default page size punishes scanning speed. No keyboard accelerators beyond the modal's Tab-trap/Esc.

**Sam (Accessibility-Dependent User):** Plan/DB usage meters are plain divs with no role="progressbar"/aria-valuenow. The action-menu trigger has no aria-haspopup/aria-expanded. The native confirm() on the privacy toggle drops out of the otherwise-solid custom-modal accessibility pattern.

**The non-technical family admin:** Raw Postgres error strings hit this persona hardest. Required-field signaling is inconsistent — only 2 fields get a visible "(obrigatório)" suffix, most others rely on bare HTML5 validation with no visible convention.

## Minor Observations

- Cache-busting versions are internally consistent, no stale-cache risk found despite being a known historical pattern in this codebase.
- CSP is a real, tightly-scoped allowlist — good hygiene, and it's what blocked this critique's own overlay tool.
- The [hidden] CSS-specificity bug that has recurred in this project's history appears correctly mitigated on `.nav-item[hidden]` and `.stat-limit[hidden]`.
- Password-visibility toggles use emoji with correct aria-label swap but inconsistent rendering across OS/browser.
- "Vivo(a) ou falecido(a)" forces a binary required select with no "Desconhecido" option — a real gap for genealogical research.
- Detector's em-dash-overuse advisory (45 instances) deserves a manual pass to separate real prose copy from code/comment noise.

## Questions to Consider

- What if each panel became a real isolated, lazy-loaded view instead of one giant concatenated scroll?
- What if every "are you sure" moment shared one consistent branded confirmation pattern, retiring window.confirm() entirely?
- What if the biography narrator surfaced at the dashboard level instead of staying tucked inside the person-edit modal?
