---
name: acceptance-guide
description: Author an acceptance & review guide — a per-item verdict table (steps, a pass bar, and a red/yellow/green/white/black stoplight verdict) that hands built work back for human review. Use when a plan or milestone reaches a reviewable state (feel/look/UX judgements the tests can't give, or a handoff with deferred pieces), or when the user asks for an acceptance or review guide. To parse the filled-in feedback afterwards, use the companion `acceptance-review` skill.
---

# Acceptance Guide (author)

A **standard, repeatable** way to hand built work back for human review. Where a plan's *Acceptance
Criteria* say what "done" means, an acceptance guide is how a human **confirms** it — item by item, with
one consistent stoplight verdict — so iterating on any work feels the same, whatever the subject matter.

This skill is project-agnostic and self-contained. It is the **generate** half of the loop; the
**review** half is the `acceptance-review` skill. Together:

```
acceptance-guide → human clicks through it in viewer/index.html → re-export → acceptance-review
```

## Bundled files (find them, don't hardcode a path)

This skill ships alongside three files at the package root. When installed as a plugin they resolve via
`${CLAUDE_PLUGIN_ROOT}`; when the skills were copied in standalone, look one level up from this skill
folder (the toolkit root):

- **`${CLAUDE_PLUGIN_ROOT}/FORMAT.md`** — the authoritative format contract. **Read it first.** It
  defines the exact grammar every tool in the loop obeys; do not restate or diverge from it here.
- **`${CLAUDE_PLUGIN_ROOT}/TEMPLATE.md`** — the fill-in template to copy.
- **`${CLAUDE_PLUGIN_ROOT}/viewer/index.html`** — the web viewer the human uses to click through the guide.

If `${CLAUDE_PLUGIN_ROOT}` is unset (standalone install), the same files sit at the toolkit root next to
`skills/`.

## Usage

```
/acceptance-guide [<plan / feature / milestone>]
```

Output goes wherever the host project keeps acceptance guides — default `docs/acceptance/`. Ask if
unclear; never assume a project-specific tool or command.

## When to produce one

- A plan (or a cohesive milestone) is code-complete and heading for manual verification / merge, or
- a chunk lands that needs a human judgement (feel, look, UX) the tests can't give, or
- work is handed off with pieces deferred and the user needs to know exactly what to check now.

One guide can span several related plans.

## Author a new guide

1. **Read `FORMAT.md`.** It is the contract; steps below just apply it.
2. **Copy `TEMPLATE.md`** to `<name>-acceptance.md` (naming per FORMAT.md §1).
3. **Enumerate items**, each with a stable **ID** (FORMAT.md §6), grouped into three kinds:
   - **Interactive** — hands-on: a card with `Steps` → `Expected` (the observable pass bar). Flag
     *feel* items explicitly (movement, timing, layout) — those are the human's to judge.
   - **Verified by automated tests** — the reviewer signs off on the *design*, not the pixels; cite the
     test class / doc as the source.
   - **Deferred** — what's intentionally not built yet, so the boundary is clear. No verdict.
4. **Write Setup** — the exact path to a testable state (which screen/scene to open, the controls, any
   placeholder-art caveat), using only what the host project actually provides.
5. **Put every item in one verdict table** — `ID | Item | Scene / Source | Verdict`, each `Verdict` cell
   defaulting to `⚫`. This single table is the reviewer's fill-in surface **and** the parse target; the
   item cards below are the how-to-test reference — no verdict slot on the cards (avoid double-entry).
6. **Keep the stoplight legend** (FORMAT.md §3.2) near the top with a copy-paste palette.
7. **Save** the guide, then **surface it to the user**: send the file, restate the legend, and tell them
   they can review it visually by opening `${CLAUDE_PLUGIN_ROOT}/viewer/index.html` and dropping the
   file in (click the dots, add notes, **Export .md**).

## Verify before handing off

- The file satisfies `FORMAT.md` §2 (a `# ` title **and** one valid verdict table).
- Every item has a stable ID, a table row, and either `Steps` + `Expected` (interactive) or a source
  citation (test-verified).
- The verdict table lists every item once; each `Verdict` cell starts as `⚫`.
- The stoplight legend + copy-paste palette are present; section order follows the template.
- The guide is saved and surfaced to the user, with the viewer path.

Quick self-check: drop the finished guide into the viewer — if every item appears with its Steps/Expected
and a clickable stoplight, it conforms.

## Relationship to the plan

The plan file stays the source of truth for scope and Acceptance Criteria; the guide is the human-review
instrument for them — link the two. When every item is 🟢, the plan's manual verification is satisfied.
