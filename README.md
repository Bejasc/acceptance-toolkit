# Acceptance Review Toolkit

A **portable, subject-agnostic** review loop, packaged as a **self-contained [Claude Code](https://code.claude.com) plugin**. Author a checklist as markdown, click through it in a self-contained web viewer (stoplight verdicts + notes), re-export the filled-in markdown, and feed it back to a skill that turns your feedback into work.

**No dependencies** — no framework, no user-level skills, no network, no build step. Works for any project, any subject matter.

> **A note on the name.** This is *manual acceptance review* — a human-judged, acceptance-criteria-based sign-off (UAT-style), not automated/executable acceptance tests. The "**& Review**" framing is deliberate.

---

## The loop

```
   ┌─ /acceptance-guide ──────┐  link  ┌─ the web viewer ────┐  link  ┌─ /acceptance-review ───────┐
   │  author  <name>-         │   or   │  click stoplight    │   or   │  parse each verdict + note  │
   │  acceptance.md           ┼──.md──▶│  dots, add notes,   ┼──.md──▶│  🟡/🔴 → fix+verify+report  │
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
| The reviewer UI + format | `viewer/`, `tools/`, `FORMAT.md`, `TEMPLATE.md` | anywhere you keep the toolkit (keep them together) |

With a plain copy the skills invoke as `/acceptance-guide` and `/acceptance-review` (no `acceptance-toolkit:` prefix) and fall back to finding the bundled files next to `skills/`.

> **Minimum to run the whole loop anywhere:** the two `skills/` folders + `viewer/index.html` + `FORMAT.md` + `TEMPLATE.md`, plus `tools/` for share links.

---

## Share links — open a whole guide from a URL

The guide can travel **inside a link**. No upload, no file, no server storage: the markdown is
compressed into the URL's fragment, which browsers never send to the server. Click it and the viewer
opens with every item, step, and verdict already there.

```
https://prototype.bejasc.dev/acceptance#plan=<compressed guide>&name=042-checkout-acceptance.md
```

**Getting one.** The `acceptance-guide` skill now hands you a link every time it writes a guide, so
in any chat you get a one-click route into review. By hand:

```
node tools/plan-url.mjs docs/acceptance/042-checkout-acceptance.md --markdown
python tools/plan_url.py docs/acceptance/042-checkout-acceptance.md --markdown   # no Node? same thing
```

Both are stdlib-only — no install, no network. `--base <url>` (or `ACCEPTANCE_VIEWER_URL`) points at
your own viewer instead of the default host; `--decode` turns a link back into markdown.

**Sending one back.** The viewer's **Copy link** button encodes the *current* state — your dots and
notes included. Paste that into a chat and say *"review my feedback"*; `acceptance-review` decodes it
and gets to work. Files still work exactly as before; the link is just the zero-friction path.

A typical guide lands around 1–2 KB of URL. Past ~8000 characters the tools warn you, because some
chat clients truncate long links — send the `.md` then. Full spec: [`FORMAT.md`](FORMAT.md) §8.

## Using the web viewer

1. Open it — click a **share link**, visit your hosted copy, or open `viewer/index.html` from disk.
2. **Drop** an acceptance `.md` onto the page (or *Load .md* / *Paste markdown* / *Load example*).
   A link skips this step entirely.
3. Click a **stoplight dot** per item and add a note. 🟡 (change) and 🔴 (bad) prompt for a note.
4. Watch the **progress bar** and filter chips (e.g. show only unreviewed, or only 🟡/🔴).
5. Hand it back: **Copy link** (a URL carrying your verdicts), **Export .md** (downloads
   `<name>-reviewed.md`), **Copy markdown**, or **Copy review prompt** (a ready-to-send prompt + your
   filled-in guide).

Progress auto-saves per document in the browser (localStorage). Everything is local — no file leaves your machine. Light/dark aware.

> Opening a link whose guide already has verdicts, when you *also* have different progress saved on
> that device, asks which one to keep — neither is thrown away silently.

### Hosting your own viewer

`viewer/index.html` is a single self-contained file: serve it at any path (the author's copy lives at
`prototype.bejasc.dev/acceptance`) and links to it work. Point the tools at it with `--base` or
`ACCEPTANCE_VIEWER_URL`, and edit the one-line `SHARE_BASE` constant in the file so *Copy link* still
produces working URLs when the viewer is opened straight off disk.

## Using the skills

- **Generate** — *"write an acceptance guide for &lt;the thing you built&gt;"* → `acceptance-guide` produces a `<name>-acceptance.md` from `TEMPLATE.md` per `FORMAT.md`, and hands you a share link to it.
- **Review** — after you click through it in the viewer, paste back the **link** (viewer's *Copy link*), the exported file, or the *Copy review prompt* text and say *"review my feedback"* → `acceptance-review`: 🟡/🔴 become work items it fixes, verifies, and reports **per item ID**; it updates the table as the living record and returns a fresh link.

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
├── tools/
│   ├── plan-url.mjs              guide ⇄ share link (Node, stdlib only)
│   └── plan_url.py               the same, for environments without Node
├── scripts/
│   ├── check-guides.mjs          share-link round-trip + manifest checks
│   └── check-viewer.mjs          viewer makes no outbound requests
├── .github/
│   ├── workflows/                CI, viewer deploy, plugin release
│   └── DEPLOY.md                 what to configure before deploy works
├── FORMAT.md                     the canonical format contract (both ends obey it)
├── TEMPLATE.md                   the fill-in template
├── examples/                     a worked, non-Unity example guide
├── LICENSE                       MIT
└── README.md                     this file
```

Both checks run on bare Node with no install — `node scripts/check-guides.mjs`
and `node scripts/check-viewer.mjs`. CI runs the same two. See
[`.github/DEPLOY.md`](.github/DEPLOY.md) for how the hosted viewer is published
and how a release is cut.

## The format contract

[`FORMAT.md`](FORMAT.md) is the authoritative spec both the viewer and the skills obey — a `# ` title, one `ID … | Verdict` table (3- or 4-column, verdict always last), `### <ID> — <name>` detail cards, optional `## Setup` / `## Deferred`, a verdict-cell grammar of `<dot>` or `<dot> — note` (notes with `|` escaped `\|`), and (§8) the `#plan=` share-link encoding. Keep to it and any guide is clickable in the viewer, linkable in a URL, parseable by the skill, and round-trips losslessly.

## License

[MIT](LICENSE).
