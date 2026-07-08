# Checkout Flow — Acceptance & Review

> **What this is.** A guided review of the new guest-checkout flow (plan 042). Each item has steps,
> what "pass" looks like, and a row in the verdict table. Work top to bottom.
>
> **Scope note.** The web flow is hands-on testable now. Tax rules are covered by automated tests.
> Saved-card checkout is deferred.

---

## How to give feedback (the stoplight)

Set each item's **Verdict** cell to a dot, and append a short note after it (e.g. `🟡 — too slow`).

| Dot | Means |
|-----|-------|
| 🟢 | **Good** — works as described |
| 🟡 | **Change** — works, but change it (note what) |
| 🔴 | **Bad** — didn't do what *Expected* says (note what) |
| ⚪ | **Skipped** — didn't check it |
| ⚫ | **Not done** — default; not reviewed yet |

**Copy-paste palette:**  🟢  🟡  🔴  ⚪  ⚫

## Verdict table

| ID | Item | Scene / Source | Verdict |
|----|------|----------------|---------|
| I1 | Add to cart updates the badge | /shop | ⚫ |
| I2 | Guest checkout without an account | /checkout | ⚫ |
| I3 | Invalid card shows a clear error | /checkout | ⚫ |
| I4 | Order confirmation email arrives | /checkout | ⚫ |
| T1 | Tax calculation by region (design) | Automated tests | ⚫ |

---

## Setup

1. Open the staging site and sign out so you're a guest.
2. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.

> Staging uses placeholder product images — ignore the art.

---

## Interactive checks — web

### I1 — Add to cart updates the badge
**Steps:** From `/shop`, click **Add to cart** on any product.
**Expected:** The cart badge count increments immediately without a full page reload.
**This is a feel item** — note if the update feels instant.

### I2 — Guest checkout without an account
**Steps:** With one item in the cart, go to `/checkout` and complete it as a guest (no login).
**Expected:** You can pay and place the order without being forced to create an account.

### I3 — Invalid card shows a clear error
**Steps:** At payment, enter card `4000 0000 0000 0002` (declined) and submit.
**Expected:** An inline, human-readable error appears near the card field; no order is created.

### I4 — Order confirmation email arrives
**Steps:** Complete a successful order with a real inbox.
**Expected:** A confirmation email with the order number arrives within a minute.

---

## Verified by automated tests — review the design, not the pixels

### T1 — Tax calculation by region
Tax is computed from the shipping region via a rules table, not hardcoded per product.
(Source: `TaxRulesTests`)

---

## Deferred — not testable yet (for awareness, no verdict needed)

- **Saved-card checkout** — one-tap reorder for logged-in users (plan 043).
