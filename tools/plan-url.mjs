#!/usr/bin/env node
/**
 * plan-url.mjs — turn an acceptance guide into a share link, or a share link back into a guide.
 *
 * Part of the Acceptance Review Toolkit. Node standard library only; no dependencies, no network.
 * The link grammar this implements is the contract in FORMAT.md §8 — the web viewer decodes the
 * exact same payload, so a link produced here opens the guide anywhere the viewer is hosted.
 *
 *   encode:  node tools/plan-url.mjs docs/acceptance/042-foo-acceptance.md
 *   decode:  node tools/plan-url.mjs --decode "https://…/acceptance#plan=…"
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const DEFAULT_BASE = process.env.ACCEPTANCE_VIEWER_URL || "https://prototype.bejasc.dev/acceptance";
const WARN_LEN = 8000; // links longer than this get chewed up by some chat clients / proxies

const USAGE = `plan-url.mjs — acceptance guide ⇄ share link (FORMAT.md §8)

  Encode:  node tools/plan-url.mjs <guide.md|-> [options]
  Decode:  node tools/plan-url.mjs --decode <url|payload> [--out <file.md>]

Options
  --base <url>     Viewer base URL          (default: ${DEFAULT_BASE})
                   or set ACCEPTANCE_VIEWER_URL
  --name <file>    Filename to carry in the link (default: the input's basename)
  --no-name        Omit the name parameter
  --query          Use "?plan=" instead of the default "#plan="
  --raw            Skip DEFLATE; encode the markdown as plain base64url
  --markdown       Print a ready-to-paste markdown link instead of a bare URL
  --json           Print { url, payload, title, items, bytes } as JSON
  --force          Encode even if the file doesn't look like a valid guide
  --quiet          Suppress the size summary on stderr
  --out <file>     (decode) Write the markdown to a file instead of stdout
  -h, --help       This message

The fragment form (#plan=) is the default on purpose: a fragment is never sent to the server, so
the guide never leaves the reader's browser and never lands in a web-server log.
`;

/* ---------- base64url ---------- */
const toB64Url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s) =>
  Buffer.from(String(s).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64");

/* ---------- guide validation (FORMAT.md §2) ---------- */
function inspect(md) {
  const lines = md.split(/\r?\n/);
  const titleLine = lines.find((l) => /^#\s+\S/.test(l));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : null;

  const cells = (line) => {
    const t = line.trim();
    if (!(t.startsWith("|") && t.endsWith("|") && t.length > 2)) return null;
    return t.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
  };
  const isSep = (c) => c && c.every((x) => /^:?-{2,}:?$/.test(x));

  let items = 0, found = false;
  for (let i = 0; i < lines.length; i++) {
    const c = cells(lines[i]);
    if (!(c && c.length >= 2 && /^id$/i.test(c[0]) && /verdict/i.test(c[c.length - 1]))) continue;
    if (!isSep(cells(lines[i + 1]))) continue;
    found = true;
    for (let j = i + 2; j < lines.length; j++) {
      const r = cells(lines[j]);
      if (!r || isSep(r)) break;
      items++;
    }
    break;
  }
  const reason = !title ? 'no "# " title heading'
    : !found ? "no verdict table (a header row starting with ID and ending with Verdict)"
    : items === 0 ? "the verdict table has no item rows"
    : null;
  return { ok: !reason, reason, title, items };
}

/* ---------- payload ---------- */
function encodePayload(md, { raw = false } = {}) {
  const plain = Buffer.from(md, "utf8");
  if (raw) return toB64Url(plain);
  const packed = deflateRawSync(plain, { level: 9 });
  // A pathological guide could deflate larger than it started; keep whichever is shorter.
  return toB64Url(packed.length < plain.length ? packed : plain);
}

function decodePayload(payload) {
  const bytes = fromB64Url(payload);
  const tries = [];
  try { tries.push(inflateRawSync(bytes).toString("utf8")); } catch { /* not deflated */ }
  try { tries.push(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { /* not utf-8 */ }
  for (const md of tries) if (inspect(md).ok) return md;
  return tries[0] ?? null;
}

function extractPayload(input) {
  const s = String(input).trim();
  const m = s.match(/[#?&]plan=([A-Za-z0-9\-_+/=%]+)/);
  if (m) return decodeURIComponent(m[1]);
  return s; // assume a bare payload
}

/* ---------- args ---------- */
function parseArgs(argv) {
  const o = { base: DEFAULT_BASE, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) { console.error(`plan-url: ${a} needs a value`); process.exit(2); }
      return v;
    };
    switch (a) {
      case "-h": case "--help": o.help = true; break;
      case "-d": case "--decode": o.decode = true; break;
      case "--base": o.base = val(); break;
      case "--name": o.name = val(); break;
      case "--no-name": o.noName = true; break;
      case "--out": o.out = val(); break;
      case "--query": o.query = true; break;
      case "--raw": o.raw = true; break;
      case "--markdown": o.markdown = true; break;
      case "--json": o.json = true; break;
      case "--force": o.force = true; break;
      case "--quiet": o.quiet = true; break;
      default:
        if (a.startsWith("-") && a !== "-") { console.error(`plan-url: unknown option ${a}`); process.exit(2); }
        o.positional.push(a);
    }
  }
  return o;
}

const readInput = (p) => readFileSync(p === "-" ? 0 : p, "utf8");

/* ---------- main ---------- */
const opts = parseArgs(process.argv.slice(2));

if (opts.help || (!opts.positional.length && process.stdin.isTTY)) {
  process.stdout.write(USAGE);
  process.exit(opts.help ? 0 : 2);
}

const input = opts.positional[0] ?? "-";

if (opts.decode) {
  const source = input === "-" ? readInput("-") : input;
  const md = decodePayload(extractPayload(source));
  if (md == null) { console.error("plan-url: could not decode that link — the payload isn't valid base64url."); process.exit(1); }
  const info = inspect(md);
  if (!info.ok && !opts.quiet) console.error(`plan-url: warning — decoded text isn't a valid guide (${info.reason}).`);
  if (opts.out) { writeFileSync(opts.out, md, "utf8"); if (!opts.quiet) console.error(`plan-url: wrote ${opts.out} (${info.items} items)`); }
  else process.stdout.write(md.endsWith("\n") ? md : md + "\n");
  process.exit(0);
}

const md = readInput(input);
const info = inspect(md);
if (!info.ok && !opts.force) {
  console.error(`plan-url: ${input} doesn't look like an acceptance guide — ${info.reason}.`);
  console.error("plan-url: fix it against FORMAT.md, or pass --force to encode anyway.");
  process.exit(2);
}

const payload = encodePayload(md, { raw: opts.raw });
const name = opts.noName ? null : (opts.name ?? (input === "-" ? null : basename(input)));
const base = opts.base.replace(/[#?].*$/, "");
const sep = opts.query ? "?" : "#";
const url = `${base}${sep}plan=${payload}` + (name ? `&name=${encodeURIComponent(name)}` : "");

if (opts.json) {
  process.stdout.write(JSON.stringify(
    { url, payload, title: info.title, items: info.items, bytes: Buffer.byteLength(md, "utf8"), length: url.length },
    null, 2) + "\n");
} else if (opts.markdown) {
  process.stdout.write(`[${(info.title || "Acceptance guide").replace(/[[\]]/g, "")} — open in the viewer](${url})\n`);
} else {
  process.stdout.write(url + "\n");
}

if (!opts.quiet) {
  const src = Buffer.byteLength(md, "utf8");
  const pct = Math.round((1 - url.length / src) * 100);
  console.error(`plan-url: ${info.items} items, ${src} B markdown → ${url.length} char link${pct > 0 ? ` (${pct}% shorter)` : ""}`);
  if (url.length > WARN_LEN)
    console.error(`plan-url: warning — ${url.length} chars is long for a link; some chat clients truncate past ~${WARN_LEN}. Send the file instead, or trim the guide.`);
}
