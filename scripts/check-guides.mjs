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
 *   5. the viewer's own decoder — lifted out of the HTML and run here — recovers
 *      what the CLI produced, in both wire forms, and returns nothing at all for
 *      a truncated payload
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

// 5 — the encoder ↔ viewer contract.
//
// Checks 1-3 prove the two encoders agree with each other, which says nothing
// about the end that actually matters to a reviewer: the viewer's decoder. That's
// a third implementation, living inside an HTML file nothing imports, and a change
// to it breaks every share link ever handed out with no other check noticing. The
// hosted viewer once sat months behind the repo with no share-link support at all
// and every check still passed.
//
// So: lift the decode path out of the HTML and run it here, against links the real
// CLI just produced.
function sliceFunction(src, name) {
  const sig = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = src.match(sig);
  if (!m) return null;
  let i = src.indexOf('{', m.index + m[0].length - 1);
  if (i < 0) return null;
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  return null;
}

const VIEWER_FNS = ['b64urlDecode', 'pump', 'canInflateRaw', 'decodePlan'];
let viewer = null;
try {
  const html = readFileSync('viewer/index.html', 'utf8');
  const js = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  const parts = [];
  for (const name of VIEWER_FNS) {
    const fn = sliceFunction(js, name);
    if (!fn) throw new Error(`no function ${name}() — the decode path moved; update VIEWER_FNS`);
    parts.push(fn);
  }
  viewer = new Function(`${parts.join('\n')}\nreturn { decodePlan, canInflateRaw };`)();
} catch (e) {
  fail('viewer/index.html', `couldn't lift the decode path out — ${e.message}`);
}

const payloadOf = (url) => decodeURIComponent(url.match(/[#?&]plan=([^&#\s]*)/)[1]);

if (viewer) {
  if (!viewer.canInflateRaw()) {
    fail('viewer/index.html', 'canInflateRaw() is false on this runtime — the deflate check cannot run');
  }
  for (const guide of GUIDES) {
    if (!existsSync(guide)) continue;
    const original = readFileSync(guide, 'utf8');

    // Both wire forms — FORMAT.md §8.1 requires a reader to accept either.
    for (const [label, args] of [
      ['compressed', [MJS, guide, '--quiet']],
      ['uncompressed', [MJS, guide, '--raw', '--quiet']],
    ]) {
      let url;
      try {
        url = run('node', args).trim();
      } catch (e) {
        fail(guide, `node encode (${label}) failed — ${String(e.stderr || e.message).trim()}`);
        continue;
      }
      const got = await viewer.decodePlan(payloadOf(url));
      if (!got.some((md) => norm(md) === norm(original))) {
        fail(guide, `the viewer's decoder could not recover the ${label} link`);
      }
    }

    // The bug this guards: a truncated payload used to be reported as "needs a
    // newer browser". Zero candidates while canInflateRaw() is true is exactly
    // the state that must produce the truncation message instead.
    //
    // Cut on a 4-char boundary so base64 stays well-formed and the failure lands
    // in the inflate, not in atob. A ragged cut throws out of b64urlDecode, which
    // the viewer catches separately — also correct, but a different branch.
    const full = payloadOf(run('node', [MJS, guide, '--quiet']).trim());
    const cut = full.slice(0, Math.floor(full.length / 2 / 4) * 4);
    let fromCut;
    try {
      fromCut = await viewer.decodePlan(cut);
    } catch {
      fromCut = null; // threw before producing candidates — still "unreadable", still not a false pass
    }
    if (fromCut && fromCut.some((md) => norm(md) === norm(original))) {
      fail(guide, 'a half-length payload still decoded — the truncation check is not testing anything');
    }
    if (fromCut && fromCut.length) {
      fail(guide, `a truncated payload produced ${fromCut.length} candidate(s) — the viewer would report the wrong reason`);
    }
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
  `Checked ${checked} guide${checked === 1 ? '' : 's'} (round-trip${python ? ' + cross-encoder' : ''}` +
    `${viewer ? ' + viewer decoder' : ''}) and 2 manifests\n`,
);

if (errors.length) {
  console.error('Guide checks failed:\n');
  for (const e of errors) console.error(`  ✖ ${e}`);
  console.error('\nSee FORMAT.md for the guide grammar (§2 structure, §8 share links).');
  process.exit(1);
}
console.log('Guide checks passed.');
