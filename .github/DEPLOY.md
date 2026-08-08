# Deploy setup

Three workflows: `ci.yml` runs on every push, `deploy.yml` publishes the viewer,
`release.yml` cuts a tag when the plugin version changes. CI needs nothing. The
other two need the steps below, and until they're done both fail on the first run
rather than shipping anything wrong.

## What deploys where

| | |
|---|---|
| Artifact | `viewer/index.html` — one self-contained file, no build |
| Target | `/home/www/prototype/acceptance/` on the VPS |
| Served at | <https://prototype.bejasc.dev/acceptance/> via Apache → auth-gateway (`:3005`) |
| Trigger | CI passing on `main` |
| Health check | `GET /acceptance/VERSION` must equal the deployed SHA, and the served page must contain share-link handling |

That URL is not cosmetic. It's `DEFAULT_BASE` in `tools/plan-url.mjs` and
`tools/plan_url.py`, it's cited in `FORMAT.md` §8, and it's inside every share
link anyone has ever been handed. Changing it breaks links that already exist in
other people's chat history — treat it as an API, not a hostname.

## 1. Server-side, once

The `deploy` user needs write access to the directory. As root:

```bash
mkdir -p /home/www/prototype/acceptance
chown -R deploy:deploy /home/www/prototype/acceptance
```

Nothing else — the prototype sandbox auto-routes any subdirectory with an
`index.html`, so there's no vhost to add. Leave the path ungated: it currently
serves without auth, and a viewer behind a password can't be opened from a share
link handed to someone else.

## 2. Repository secrets

Settings → Secrets and variables → Actions.

| Secret | Value |
|---|---|
| `VPS_HOST` | server IP or hostname |
| `VPS_USERNAME` | `deploy` |
| `VPS_SSH_KEY` | private SSH key for the `deploy` user |
| `DEPLOY_PATH` | `/home/www/prototype/acceptance` |
| `DISCORD_WEBHOOK_DEPLOYS` | optional — deploy notifications |
| `DISCORD_USERNAME` / `DISCORD_AVATAR` | optional — branding for the webhook post |

`GITHUB_TOKEN` covers the release; no extra secret for tagging.

> [!IMPORTANT] This repository is public
> Deploy and release both trigger on `workflow_run` after CI on `main`, never on
> `pull_request`. That matters: a fork's PR must never reach a job holding the
> deploy key. Don't add a `pull_request` trigger to either workflow.

## 3. Branch protection

Make **Checks** a required status check on `main` (Settings → Branches). Until
then CI reports without blocking. The picker lists *job* names, not workflow
names.

## 4. Confirm end to end

- [ ] Push to `main` — CI green, Deploy green.
- [ ] `curl https://prototype.bejasc.dev/acceptance/VERSION` returns the commit SHA.
- [ ] Generate a link (`node tools/plan-url.mjs examples/example-checkout-acceptance.md`) and open it — the guide loads with clickable stoplights.
- [ ] Discord notification arrived, if the webhook is set.

## Releasing

Bump `version` in `.claude-plugin/plugin.json` in a normal commit. When it merges
to `main` and CI passes, `release.yml` tags `v<version>`, cuts a GitHub Release
with generated notes, and attaches `viewer/index.html`. A commit that doesn't
touch the version does nothing — the tag-exists check skips quietly.

## Running the checks locally

```bash
node scripts/check-guides.mjs     # round-trip, cross-encoder, manifests
node scripts/check-viewer.mjs     # no remote resources, no network APIs
```

Both are dependency-free. `check-guides.mjs` skips the Node↔Python cross-check if
no `python`/`python3` is on PATH.
