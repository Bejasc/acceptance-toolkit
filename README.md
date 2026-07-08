# Acceptance Review Toolkit

A **portable, subject-agnostic** review loop, packaged as a **self-contained [Claude Code](https://code.claude.com) plugin**. Author a checklist as markdown, click through it in a self-contained web viewer (stoplight verdicts + notes), re-export the filled-in markdown, and feed it back to a skill that turns your feedback into work.

**No dependencies** — no framework, no user-level skills, no network, no build step. Works for any project, any subject matter.

> **A note on the name.** This is *manual acceptance review* — a human-judged, acceptance-criteria-based sign-off (UAT-style), not automated/executable acceptance tests. The "**& Review**" framing is deliberate.

---

## The loop

```
   ┌─ /acceptance-guide ──────┐        ┌─ viewer/index.html ─┐        ┌─ /acceptance-review ───────┐
   │  author  <name>-         │  .md   │  click stoplight    │  .md   │  parse each verdict + note  │
   │  acceptance.md           ┼───────▶│  dots, add notes,   ┼───────▶│  🟡/🔴 → fix+verify+report  │
   │  (per FORMAT.md)         │        │  re-export          │        │  🟢 pass; ⚪/⚫ hold         │
   └──────────────────────────┘        └─────────────────────┘        └─────────────────────────────┘
          ▲                                                                          │
          └───────────────── one grammar (FORMAT.md), identical every hop ───────────┘
```

Every guide obeys one format and one stoplight vocabulary, so **each document is reviewed the same way regardless of subject matter**, and the markdown round-trips losslessly. The contract is [`FORMAT.md`](FORMAT.md).

| Dot | Means |
|-----|-------|
| 🟢 | **Good** — works as described |
| 🟡 | **Change** — works, but change it (note what) |
| 🔴 | **Bad** — didn't do what *Expected* says (note what) |
| ⚪ | **Skipped** — didn't check it |
| ⚫ | **Not done** — default; not reviewed yet |

---

## Install across your whole stack (recommended)

Installing as a plugin puts it at the **user level**, so both skills are then available in **every project** on that machine. Do this once per machine/environment in an interactive Claude Code session:

```
/plugin marketplace add Bejasc/acceptance-toolkit
/plugin install acceptance-toolkit@acceptance-kit
```

That's it. The skills surface as:

- **`/acceptance-toolkit:acceptance-guide`** — author a guide from work you've built
- **`/acceptance-toolkit:acceptance-review`** — parse your filled-in feedback into tracked changes

To update later: `/plugin marketplace update acceptance-kit`.

> `Bejasc/acceptance-toolkit` is this GitHub repo — `/plugin marketplace add` clones it and reads `.claude-plugin/marketplace.json`. You can also pass a local path instead of the `owner/repo` shorthand.

### Try it for one session without installing

```
claude --plugin-dir /path/to/acceptance-toolkit
```

---

## Download the files

You don't have to install the plugin to use it — the viewer is just an HTML file and the skills are plain markdown.

- **Whole repo:** click the green **Code ▸ Download ZIP** on GitHub, or:
  ```
  git clone https://github.com/Bejasc/acceptance-toolkit.git
  ```
- **Just the viewer:** open `viewer/index.html` from the download in any browser — that alone is the full review UI.

### Where to put things (plain copy, no plugin machinery)

| You want… | Copy this | To here |
|-----------|-----------|---------|
| Skills available in **every** project (whole stack) | `skills/acceptance-guide/`, `skills/acceptance-review/` | `~/.claude/skills/` |
| Skills available in **one** project | the same two folders | `<project>/.claude/skills/` |
| The reviewer UI + format | `viewer/`, `FORMAT.md`, `TEMPLATE.md` | anywhere you keep the toolkit (keep them together) |

With a plain copy the skills invoke as `/acceptance-guide` and `/acceptance-review` (no `acceptance-toolkit:` prefix) and fall back to finding the bundled files next to `skills/`.

> **Minimum to run the whole loop anywhere:** the two `skills/` folders + `viewer/index.html` + `FORMAT.md` + `TEMPLATE.md`.

---

## Using the web viewer

1. Open `viewer/index.html` in a browser (double-click, or serve the folder).
2. **Drop** an acceptance `.md` onto the page (or *Load .md* / *Paste markdown* / *Load example*).
3. Click a **stoplight dot** per item and add a note. 🟡 (change) and 🔴 (bad) prompt for a note.
4. Watch the **progress bar** and filter chips (e.g. show only unreviewed, or only 🟡/🔴).
5. **Export .md** (downloads `<name>-reviewed.md`), **Copy markdown**, or **Copy review prompt** (a ready-to-send prompt + your filled-in guide).

Progress auto-saves per document in the browser (localStorage). Everything is local — no file leaves your machine. Light/dark aware.

## Using the skills

- **Generate** — *"write an acceptance guide for &lt;the thing you built&gt;"* → `acceptance-guide` produces a `<name>-acceptance.md` from `TEMPLATE.md` per `FORMAT.md`.
- **Review** — after you click through it in the viewer and export, paste it back (or use the viewer's *Copy review prompt*) and say *"review my feedback"* → `acceptance-review`: 🟡/🔴 become work items it fixes, verifies, and reports **per item ID**; it updates the table as the living record.

---

## What's in here

```
acceptance-toolkit/               ← repo root = the plugin
├── .claude-plugin/
│   ├── plugin.json               plugin manifest
│   └── marketplace.json          local marketplace (makes /plugin install work)
├── skills/
│   ├── acceptance-guide/SKILL.md   GENERATE
│   └── acceptance-review/SKILL.md  REVIEW
├── viewer/index.html             the web viewer (no build/server/network)
├── FORMAT.md                     the canonical format contract (both ends obey it)
├── TEMPLATE.md                   the fill-in template
├── examples/                     a worked, non-Unity example guide
├── LICENSE                       MIT
└── README.md                     this file
```

## The format contract

[`FORMAT.md`](FORMAT.md) is the authoritative spec both the viewer and the skills obey — a `# ` title, one `ID … | Verdict` table (3- or 4-column, verdict always last), `### <ID> — <name>` detail cards, optional `## Setup` / `## Deferred`, and a verdict-cell grammar of `<dot>` or `<dot> — note` (notes with `|` escaped `\|`). Keep to it and any guide is clickable in the viewer, parseable by the skill, and round-trips losslessly.

## License

[MIT](LICENSE).
