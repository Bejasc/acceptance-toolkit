---
name: acceptance-review
description: Parse a human's filled-in acceptance guide and act on each item's stoplight verdict — 🟡/🔴 become tracked work items you fix, verify, and report per ID; 🟢 passes; ⚪/⚫ are left. Use when the user says they've filled in an acceptance guide (or re-exported it from the Acceptance Review web viewer) and asks you to review their feedback. Authoring a guide is the companion `acceptance-guide` skill.
---

# Acceptance Review (parse feedback)

The **review** half of the loop; `acceptance-guide` is the **generate** half. That skill authors the
guide; this one reads the human's filled-in verdicts back and turns them into work:

```
acceptance-guide → human clicks through it in viewer/index.html → re-export → acceptance-review
```

Because every guide obeys one grammar, this procedure is identical no matter the subject matter.

## Bundled files

The authoritative format lives at **`${CLAUDE_PLUGIN_ROOT}/FORMAT.md`** (or the toolkit root, one level
up from this skill folder, on a standalone install). **Read it first** — it defines the verdict-cell
grammar, the escaping rules, and the stoplight vocabulary you parse here. Do not diverge from it.

## Usage

```
/acceptance-review <guide.md>
```

The input is a guide whose verdict table has been filled in — edited by hand or re-exported from the web
viewer (its Verdict cells now hold `🟢` / `🟡 — note` / `🔴 — note` / `⚪` / `⚫`).

## The stoplight legend

| Dot | Means | Your action |
|-----|-------|-------------|
| 🟢 | **Good** — works as described | Pass; leave it. |
| 🟡 | **Change** — works, but change it | Tracked work item: make the change. |
| 🔴 | **Bad** — didn't do what *Expected* says | Tracked work item: fix it. |
| ⚪ | **Skipped** — didn't check it | Leave; note it's unreviewed. |
| ⚫ | **Not done** — not reviewed yet | Untested — **silence ≠ pass**. Leave. |

## Procedure

1. **Read the guide** and parse the verdict table (FORMAT.md §3). For each row capture the **ID**, the
   **dot**, and any **note** after ` — ` (unescape `\|` → `|`).
2. **Act per dot**, in table order:
   - 🟢 → pass; no change.
   - 🟡 / 🔴 → a tracked work item. Do the change, **verify it** using whatever check the host project
     provides (compile / tests / run the app this session), then **report back per ID** what you did.
   - ⚪ → leave; note it's unreviewed.
   - ⚫ → leave; untested. Do **not** treat as a pass.
3. **Update the table in place** — the guide is the **living record**. When you resolve a 🟡/🔴, set that
   row's dot (to 🟢 when fully resolved) and append a short note of what changed. Keep every other row as
   the human set it; never silently overwrite their verdicts.
4. **Report per ID**, not as a wall of prose: one line per actioned item — `ID — what you did → new dot`.
5. If a 🟡/🔴 note is **ambiguous** (readable multiple ways, or the change touches something
   architecturally significant), **ask the user before acting** rather than guessing.

## Verify before handing back

- Every 🟡/🔴 row was either actioned-and-verified (dot updated with a note) or explicitly flagged back
  to the user as ambiguous/blocked.
- The verdict table reflects the new state; nothing the user set was silently overwritten. Re-parsing
  the updated file still satisfies FORMAT.md (so it can go back through the viewer for another pass).
- You reported per ID and re-surfaced the updated guide.
