#!/usr/bin/env node
/**
 * Guide + encoder checks. Dependency-free; runs on a bare Node.
 *
 * The share link is the toolkit's most breakable surface: every skill tells the
 * user to hand one over, and a link that decodes to the wrong bytes fails
 * silently — the viewer opens, the guide looks fine, and a verdict lands on the
 * wrong item. So the check that matters is a real round-trip through the real
 * CLI, byte-for-byte, not a unit test of the codec.
 *
 * Checks:
 *   1. every shipped guide is valid per FORMAT.md §2 (the encoder refuses otherwise)
 *   2. encode → decode returns the original bytes
 *   3. the Node and Python encoders interoperate — a link from one decodes in the
 *      other. Deflate output is implementation-defined, so payloads are allowed
 *      to differ; the recovered markdown is not.
 *   4. both plugin manifests are valid JSON and carry a semver version
 *
 *   node scripts/check-guides.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const MJS = 'tools/plan-url.mjs';
const PY = 'tools/plan_url.py';
// TEMPLATE.md ships as a fill-in-the-blanks guide and must stay parseable — if a
// placeholder edit breaks the verdict table, every guide copied from it inherits
// the break.
const GUIDES = ['TEMPLATE.md', 'examples/example-checkout-acceptance.md'];

const errors = [];
const fail = (what, msg) => errors.push(`${what}: ${msg}`);

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

/** Trailing-newline differences are the CLI's, not the guide's. */
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\n+$/, '');

/** python3 on CI, python on most Windows installs. Absent is not a failure. */
function findPython() {
  for (const exe of ['python3', 'python']) {
    try {
      run(exe, ['--version']);
      return exe;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const python = findPython();
if (!python) console.log('note: no python found — skipping cross-encoder checks\n');

for (const guide of GUIDES) {
  if (!existsSync(guide)) {
    fail(guide, 'listed as a shipped guide but the file is missing');
    continue;
  }
  const original = readFileSync(guide, 'utf8');

  // 1 + 2 — the encoder validates before encoding, so a bad guide exits non-zero here.
  let meta;
  try {
    meta = JSON.parse(run('node', [MJS, guide, '--json', '--quiet']));
  } catch (e) {
    fail(guide, `node encode failed — ${String(e.stderr || e.message).trim()}`);
    continue;
  }
  if (!meta.items) fail(guide, 'encoded with zero item rows — the verdict table is empty or unparseable');

  try {
    const back = run('node', [MJS, '--decode', meta.url, '--quiet']);
    if (norm(back) !== norm(original)) fail(guide, 'node round-trip changed the bytes');
  } catch (e) {
    fail(guide, `node decode failed — ${String(e.stderr || e.message).trim()}`);
  }

  if (!python) continue;

  // 3 — cross-encoder. Each direction is a separate claim; test both.
  let pyUrl;
  try {
    pyUrl = JSON.parse(run(python, [PY, guide, '--json', '--quiet'])).url;
  } catch (e) {
    fail(guide, `python encode failed — ${String(e.stderr || e.message).trim()}`);
    continue;
  }

  try {
    const nodeReadsPy = run('node', [MJS, '--decode', pyUrl, '--quiet']);
    if (norm(nodeReadsPy) !== norm(original)) fail(guide, 'node could not recover a python-encoded link');
  } catch (e) {
    fail(guide, `node decode of python link failed — ${String(e.stderr || e.message).trim()}`);
  }

  try {
    const pyReadsNode = run(python, [PY, '--decode', meta.url, '--quiet']);
    if (norm(pyReadsNode) !== norm(original)) fail(guide, 'python could not recover a node-encoded link');
  } catch (e) {
    fail(guide, `python decode of node link failed — ${String(e.stderr || e.message).trim()}`);
  }
}

// 4 — the manifests are what `/plugin marketplace add` reads. Invalid JSON here
// breaks installation for everyone, and nothing else in the repo parses them.
for (const manifest of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  if (!existsSync(manifest)) {
    fail(manifest, 'missing');
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch (e) {
    fail(manifest, `invalid JSON — ${e.message}`);
    continue;
  }
  if (!parsed.name) fail(manifest, 'has no `name`');
}

try {
  const { version } = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'));
  // The release workflow tags off this field, so a malformed version silently
  // means no release rather than a loud failure.
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
    fail('.claude-plugin/plugin.json', `version "${version}" is not semver — the release workflow tags off this field`);
  }
} catch {
  /* already reported above */
}

const checked = GUIDES.length;
console.log(
  `Checked ${checked} guide${checked === 1 ? '' : 's'} (round-trip${python ? ' + cross-encoder' : ''}) and 2 manifests\n`,
);

if (errors.length) {
  console.error('Guide checks failed:\n');
  for (const e of errors) console.error(`  ✖ ${e}`);
  console.error('\nSee FORMAT.md for the guide grammar (§2 structure, §8 share links).');
  process.exit(1);
}
console.log('Guide checks passed.');
