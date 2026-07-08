<!--
  Acceptance & Review guide — TEMPLATE. Copy this to <NNN-or-slug>-acceptance.md and fill it in.
  Delete these comments. Keep the section order and the stoplight verdict format stable so review
  stays consistent across every guide (and so the web viewer can parse it). The authoritative grammar
  is FORMAT.md; this template is just FORMAT.md pre-laid-out. See README.md for the loop.
-->

# <Plan/Feature name> — Acceptance & Review

> **What this is.** A guided review of <what was built> (plan(s) <NNN…>). Each item has steps, what
> "pass" looks like, and a row in the verdict table. Work top to bottom; most items take under a minute.
>
> **Scope note.** <Which items are hands-on testable now vs. verified by automated tests vs. deferred.>

---

## How to give feedback (the stoplight)

Set each item's **Verdict** cell in the table below to a dot, and append a short note after it if
useful (e.g. `🟡 — too slow`). Copy the dot you want from here:

| Dot | Means |
|-----|-------|
| 🟢 | **Good** — works as described |
| 🟡 | **Change** — works, but change it (note what) |
| 🔴 | **Bad** — didn't do what *Expected* says (note what) |
| ⚪ | **Skipped** — didn't check it (note why, optional) |
| ⚫ | **Not done** — default; not reviewed yet |

**Copy-paste palette:**  🟢  🟡  🔴  ⚪  ⚫

> **Tip:** drop this file into the **Acceptance Review** web viewer (`viewer/index.html`) to click the
> dots and add notes visually, then re-export the filled-in markdown. When you've filled it in, tell the
> assistant to **review your feedback** — it parses each row's dot (+ note) and acts: 🟡/🔴 become work
> items it fixes and reports back **per ID**, 🟢 passes, ⚪/⚫ it leaves. Then it updates the table so it
> stays the living record.

## Verdict table

| ID | Item | Scene / Source | Verdict |
|----|------|----------------|---------|
| <ID> | <one-line item> | <scene or "Automated tests"> | ⚫ |
| … | … | … | ⚫ |

---

## Setup

<How to get to a testable state: which scene(s)/screen(s) to open, what the controls are,
 and any placeholder-art caveat.>

---

## Interactive checks — <scene / app>

<!-- One card per hands-on item. Stable ID, imperative steps, a crisp pass bar. Flag feel items.
     The verdict goes in the table above — the card is the how-to-test reference. -->

### <ID> — <short item name>
**Steps:** <exact clicks/taps/keys to perform.>
**Expected:** <the observable outcome that means pass.>
<!-- If subjective, add: **This is a feel item** — note if it feels right / off. -->

---

## Verified by automated tests — review the design, not the pixels

<!-- Proven by the suite; nothing to click. Reviewer signs off (a dot in the table) that the DESIGN is
     what they want. -->

### <ID> — <system name>
<One-paragraph description of what the system does and the design decisions to sign off on.>
(Source: `<TestClass>`, `<doc>`)

---

## Deferred — not testable yet (for awareness, no verdict needed)

<!-- What's intentionally not built yet, so the reviewer knows the boundary and isn't testing gaps. -->

- **<thing>** — <why deferred / what it needs> (<plan/phase>).
