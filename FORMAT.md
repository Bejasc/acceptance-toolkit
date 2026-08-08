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

## 8. Share links (the URL transport)

A guide can travel **inside a URL** instead of as a file, so a chat message can hand someone a link
that opens the whole thing in the viewer. The link carries the markdown; nothing is uploaded anywhere
and no server stores the guide.

```
<viewer-url>#plan=<payload>[&name=<filename>]      ← canonical
<viewer-url>?plan=<payload>[&name=<filename>]      ← also accepted
```

### 8.1 The payload

`<payload>` is **base64url** — the `A–Z a–z 0–9 - _` alphabet, padding stripped — of either:

1. the **raw-DEFLATE** (RFC 1951, no zlib/gzip wrapper) compression of the guide's UTF-8 bytes
   — the canonical form, roughly 3–4× shorter; or
2. the guide's **plain UTF-8 bytes**, for producers without a DEFLATE implementation.

Writers should emit form 1 and fall back to form 2 (also when compression would make it *longer*).
Readers **must accept both**: try raw-inflate first, then plain UTF-8, and keep whichever decoding
parses as a valid guide per §2. The two forms are self-distinguishing in practice — inflating plain
markdown fails, and DEFLATE output is almost never valid UTF-8 — so no version tag is needed.

Readers should also tolerate standard base64 (`+` `/` `=`) and stray whitespace.

### 8.2 The parameters

| Param | Required | Meaning |
|-------|----------|---------|
| `plan` | yes | the payload above |
| `name` | no | percent-encoded filename to show and to base the export name on; readers strip any path and default to `shared-acceptance.md` |

### 8.3 Fragment vs. query

**Prefer the fragment (`#plan=`).** A fragment is never sent to the server, so the guide stays in the
reader's browser and never reaches a web-server log or an analytics pipeline — the same privacy
property as dropping the file in. The `?plan=` query form exists for hosts that need the server to
see the parameter; it is read identically.

### 8.4 What the payload contains

Whatever markdown the producer had — **including verdicts already filled in**. A link is therefore
usable in both directions: hand out a fresh guide (every cell `⚫`), or send a reviewed one back with
dots and notes intact. Escaping inside verdict cells is unchanged (§3.1); the URL layer transports
bytes and interprets nothing.

When a link's guide arrives with verdicts and the reader also has different saved local progress for
the same document, the reader must ask which to keep rather than silently discarding either.

### 8.5 Size

Links grow with the guide. Past roughly **8000 characters**, some chat clients, proxies, and email
gateways truncate — producers should warn at that point and send the file instead. A typical
10–15 item guide compresses to well under half that.

### 8.6 Producing one

`tools/plan-url.mjs` (Node) and `tools/plan_url.py` (Python) implement this section in both
directions — stdlib only, no network:

```
node tools/plan-url.mjs docs/acceptance/042-foo-acceptance.md     # → link
node tools/plan-url.mjs --decode "<link>" --out guide.md          # → markdown
```

The viewer's **Copy link** button produces the same thing from the current on-screen state.
