# Acceptance Guide Format — the contract

This is the **single source of truth** for the acceptance-guide markdown format. The generator skill
(`acceptance-guide`) writes to this spec; the web viewer (`viewer/index.html`) and the review skill
(`acceptance-review`) read to it. Because both ends obey one grammar, the review loop is a **lossless,
bidirectional round-trip**:

```
generate (this spec) ──▶ viewer import ──▶ click + note ──▶ viewer export (this spec) ──▶ review parse
        ▲                                                                                      │
        └──────────────────────────── same grammar, every hop ─────────────────────────────────┘
```

Keep to this spec and any guide — for any project, any subject — works identically in every tool.

---

## 1. File

- Encoding **UTF-8**; the stoplight dots are literal emoji.
- Naming: `<NNN>-<slug>-acceptance.md` (single plan) or `<YYYY-MM-DD>-<slug>-acceptance.md`
  (milestone / multi-plan). The viewer's re-export appends `-reviewed` before `.md`.

## 2. Required structure (what makes a file a valid guide)

A file is a valid, round-trippable guide when it contains **both** of:

1. **A title** — the first `# ` heading. Becomes the document name.
2. **One verdict table** — the single fill-in surface **and** the parse target.

Everything else (intro, Setup, item cards, Deferred) is optional context and never required for the
round-trip, though a useful guide has them.

## 3. The verdict table (the heart of the format)

Exactly one table whose **header's first column is `ID`** (case-insensitive) and whose **last column
matches `Verdict`**, immediately followed by the usual `|---|` separator row. Two shapes are accepted:

```
| ID | Item | Scene / Source | Verdict |   ← 4-column (recommended)
|----|------|----------------|---------|
| I1 | Tap-to-move feel | Sandbox | ⚫ |

| ID | Item | Verdict |                     ← 3-column (Source omitted)
|----|------|---------|
| I1 | Tap-to-move feel | ⚫ |
```

Rules:
- **The Verdict is always the last column.** The middle Source column is optional.
- One row per item. The **ID** is stable and unique within the guide.
- Parsing stops at the first non-table line after the rows.

### 3.1 Verdict cell grammar

```
<cell> := <dot> [ " — " <note> ]
<dot>  := 🟢 | 🟡 | 🔴 | ⚪ | ⚫
```

- The cell **starts** with exactly one dot. `⚫` is the default (not reviewed).
- An optional note follows after ` — ` (em dash; ` – ` / ` - ` are tolerated on read).
- **Escaping:** because the cell lives in a table, a literal `|` in a note is written `\|`, and
  newlines are collapsed to single spaces. Readers unescape `\|` → `|`. This is the only transform the
  round-trip applies to your text.

### 3.2 The stoplight vocabulary

| Dot | Means | What the reviewer signals | What `acceptance-review` does |
|-----|-------|---------------------------|-------------------------------|
| 🟢 | **Good** | Works as described | Pass; leave it |
| 🟡 | **Change** | Works, but change it (note what) | Tracked work item: change + verify + report |
| 🔴 | **Bad** | Didn't do what *Expected* says (note what) | Tracked work item: fix + verify + report |
| ⚪ | **Skipped** | Didn't check it | Leave; note unreviewed |
| ⚫ | **Not done** | Default; not reviewed yet | Leave; **silence ≠ pass** |

## 4. Item detail cards (optional but recommended)

Detail for an item lives in a heading whose text begins with the item's **ID**:

```
### <ID> — <short name>
```

- The heading level may be `##`–`####`; the ID matches `[A-Za-z]+\d+` (e.g. `I1`, `T4`, `P2`).
- Cards may appear anywhere below the table; they're matched to rows by ID.
- Body runs until the next heading.

Recognised body fields:

- **Interactive item:**
  ```
  **Steps:** <exact clicks/taps/keys>
  **Expected:** <the observable outcome that means pass>
  ```
- **Feel flag:** a line beginning `**This is a feel item**` (or `**This includes a feel item**`) marks
  a subjective judgement the human owns. The viewer shows a `feel` badge.
- **Test-verified item:** a description paragraph plus a source citation, written either as
  `(Source: \`TestClass\`)` or as a trailing parenthetical `(\`TestClass\`, \`doc.md\`)`.

## 5. Optional sections

- `## Setup` — how to reach a testable state (screens/scenes to open, controls, placeholder-art
  caveats). Shown by the viewer in a collapsible panel.
- `## Deferred …` — what's intentionally not built yet. Listed for awareness; **no verdicts**.
- An intro **blockquote** directly under the title (`> **What this is.** …`) is shown as a summary.

## 6. ID conventions

Short, stable, unique-per-guide. Prefix by kind so a mixed guide stays readable:

- `I#` — interactive checks
- `T#` — verified by automated tests (sign off on the design)
- add a system letter when one guide spans several areas (e.g. `P#` persistence)

Never renumber an ID across revisions — the verdict history and review reports key on it.

## 7. Round-trip guarantee

When the viewer exports, it rewrites **only the Verdict cells** of the table; every other byte of the
source markdown is preserved exactly. A generated guide → imported → exported → re-parsed yields the
same items, verdicts, and notes. This is what makes the input and output of the review loop consistent
across environments and projects.
