#!/usr/bin/env node
/**
 * Viewer self-containment check. Dependency-free.
 *
 * The viewer's single load-bearing property is that it needs nothing but itself:
 * it has to work opened off a disk with no network, and served from behind the
 * auth-gateway where a third-party request may simply not resolve. Nothing else
 * in the repo guards that, and a CDN script added in a hurry would break it in a
 * way that only shows up on someone else's machine.
 *
 * A guide's whole contents also travel in a URL fragment, so a page that can make
 * outbound requests is a page that could exfiltrate one. "No network" is a
 * privacy claim in FORMAT.md §8, not just a packaging preference.
 *
 * Hyperlinks are fine — <a href="https://…"> navigates on a click, it doesn't
 * load anything into the page. Resource loads and network APIs are not.
 *
 *   node scripts/check-viewer.mjs [path]
 */
import { readFileSync, existsSync, statSync } from 'node:fs';

const VIEWER = process.argv[2] || 'viewer/index.html';

// A remote @import matches both the @import rule and the url() rule; report the
// finding once rather than making the reader work out they're the same line.
const errors = new Set();
const fail = (msg) => errors.add(msg);

if (!existsSync(VIEWER)) {
  console.error(`Viewer check failed:\n\n  ✖ ${VIEWER} is missing`);
  process.exit(1);
}

const html = readFileSync(VIEWER, 'utf8');

/** Schemes that don't leave the page. */
const isLocal = (url) =>
  !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url.trim()) || /^(?:data|blob):/i.test(url.trim());

// Split the document so HTML attributes and embedded code are checked by their
// own rules — JS full of `<` and `>` would otherwise be mistaken for markup.
// The opening tag's attributes are kept — a <script src="…"> must still be
// visible to the markup scan below after its body is lifted out.
const blocks = [];
const stripped = html.replace(
  /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
  (_m, tag, attrs, body) => {
    blocks.push({ tag: tag.toLowerCase(), body });
    return `<${tag}${attrs}></${tag}>`;
  },
);

// --- markup: resource-loading attributes -------------------------------------
// <a href> is deliberately absent: it navigates, it doesn't load.
const LOADERS = {
  script: ['src'],
  link: ['href'],
  img: ['src', 'srcset'],
  image: ['href', 'xlink:href'],
  iframe: ['src'],
  frame: ['src'],
  embed: ['src'],
  object: ['data'],
  source: ['src', 'srcset'],
  track: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  input: ['src'],
  use: ['href', 'xlink:href'],
};

for (const tagMatch of stripped.matchAll(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi)) {
  const tag = tagMatch[1].toLowerCase();
  const attrs = tagMatch[2];
  const watched = LOADERS[tag];
  if (!watched) continue;
  for (const name of watched) {
    const re = new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*["']([^"']*)["']`, 'i');
    const hit = attrs.match(re);
    if (hit && !isLocal(hit[1])) fail(`<${tag} ${name}="${hit[1]}"> loads a remote resource`);
  }
}

// --- CSS: @import and url() --------------------------------------------------
const css = blocks.filter((b) => b.tag === 'style').map((b) => b.body).join('\n');
for (const m of css.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s]+)/gi)) {
  if (!isLocal(m[1])) fail(`CSS @import pulls in ${m[1]}`);
}
for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
  if (!isLocal(m[1])) fail(`CSS url(${m[1]}) is remote`);
}

// --- JS: outbound network APIs ----------------------------------------------
// Name-based, not call-graph analysis: any appearance of these is a change worth
// a human deciding on, and the viewer legitimately uses none of them today.
const BANNED = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bEventSource\b/, 'EventSource'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/\bnavigator\s*\.\s*sendBeacon\b/, 'navigator.sendBeacon'],
  [/\bimport\s*\(\s*["'](?:[a-z][a-z0-9+.-]*:)?\/\//i, 'dynamic import() of a remote module'],
];

const js = blocks.filter((b) => b.tag === 'script').map((b) => b.body).join('\n');
for (const [re, label] of BANNED) {
  if (re.test(js)) fail(`viewer script uses ${label} — the viewer must make no outbound requests`);
}

// External <script src> would already be caught above, but say so specifically:
// a module script is the likeliest way a dependency sneaks in.
for (const m of stripped.matchAll(/<script\b([^>]*)>/gi)) {
  if (/\bsrc\s*=/.test(m[1]) && !/\bsrc\s*=\s*["'](?:[./]|data:)/i.test(m[1])) {
    fail('a <script> tag has a non-relative src — the viewer ships as one file');
  }
}

const kb = (statSync(VIEWER).size / 1024).toFixed(1);
console.log(`Checked ${VIEWER} — ${kb} KB\n`);

if (errors.size) {
  console.error('Viewer check failed:\n');
  for (const e of errors) console.error(`  ✖ ${e}`);
  console.error(
    '\nThe viewer must open from disk with no network. Inline the asset as a data: URI instead.',
  );
  process.exit(1);
}
console.log('Viewer check passed — self-contained.');
