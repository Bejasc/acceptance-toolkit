#!/usr/bin/env python3
"""plan_url.py — turn an acceptance guide into a share link, or a share link back into a guide.

The Python twin of tools/plan-url.mjs, for environments without Node. Standard library only;
no dependencies, no network. Both implement the same contract — FORMAT.md §8 — so a link from
either one opens in the web viewer and decodes with either tool. (The two DEFLATE
implementations tune differently, so the payloads aren't byte-identical; the markdown is.)

  encode:  python tools/plan_url.py docs/acceptance/042-foo-acceptance.md
  decode:  python tools/plan_url.py --decode "https://.../acceptance#plan=..."
"""

import argparse
import base64
import json
import os
import re
import sys
import urllib.parse
import zlib

DEFAULT_BASE = os.environ.get("ACCEPTANCE_VIEWER_URL", "https://prototype.bejasc.dev/acceptance")
WARN_LEN = 8000  # links longer than this get chewed up by some chat clients / proxies


# ---------- base64url ----------
def to_b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def from_b64url(s: str) -> bytes:
    s = re.sub(r"\s+", "", s).replace("-", "+").replace("_", "/")
    return base64.b64decode(s + "=" * (-len(s) % 4))


# ---------- guide validation (FORMAT.md §2) ----------
CELL_SPLIT = re.compile(r"(?<!\\)\|")


def _cells(line: str):
    t = line.strip()
    if not (t.startswith("|") and t.endswith("|") and len(t) > 2):
        return None
    return [c.strip() for c in CELL_SPLIT.split(t[1:-1])]


def _is_sep(cells) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", c) for c in cells)


def inspect(md: str) -> dict:
    lines = md.splitlines()
    title = next((l[1:].strip() for l in lines if re.match(r"^#\s+\S", l)), None)

    found, items = False, 0
    for i, line in enumerate(lines):
        c = _cells(line)
        if not (c and len(c) >= 2 and re.fullmatch(r"id", c[0], re.I) and re.search(r"verdict", c[-1], re.I)):
            continue
        if i + 1 >= len(lines) or not _is_sep(_cells(lines[i + 1])):
            continue
        found = True
        for row in lines[i + 2:]:
            r = _cells(row)
            if not r or _is_sep(r):
                break
            items += 1
        break

    if not title:
        reason = 'no "# " title heading'
    elif not found:
        reason = "no verdict table (a header row starting with ID and ending with Verdict)"
    elif items == 0:
        reason = "the verdict table has no item rows"
    else:
        reason = None
    return {"ok": reason is None, "reason": reason, "title": title, "items": items}


# ---------- payload ----------
def encode_payload(md: str, raw: bool = False) -> str:
    plain = md.encode("utf-8")
    if raw:
        return to_b64url(plain)
    co = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)  # negative wbits → raw DEFLATE
    packed = co.compress(plain) + co.flush()
    # A pathological guide could deflate larger than it started; keep whichever is shorter.
    return to_b64url(packed if len(packed) < len(plain) else plain)


def decode_payload(payload: str):
    data = from_b64url(payload)
    tries = []
    try:
        tries.append(zlib.decompress(data, -zlib.MAX_WBITS).decode("utf-8"))
    except Exception:
        pass
    try:
        tries.append(data.decode("utf-8"))
    except Exception:
        pass
    for md in tries:
        if inspect(md)["ok"]:
            return md
    return tries[0] if tries else None


def extract_payload(text: str) -> str:
    s = text.strip()
    m = re.search(r"[#?&]plan=([A-Za-z0-9\-_+/=%]+)", s)
    return urllib.parse.unquote(m.group(1)) if m else s


# ---------- I/O (byte-faithful: never translate CRLF, in either direction) ----------
def read_text(path: str) -> str:
    if path == "-":
        return sys.stdin.buffer.read().decode("utf-8")
    with open(path, "rb") as fh:
        return fh.read().decode("utf-8")


def write_stdout(text: str) -> None:
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.flush()


# ---------- main ----------
def main() -> int:
    p = argparse.ArgumentParser(
        prog="plan_url.py",
        description="Acceptance guide <-> share link (FORMAT.md section 8).",
        epilog="The fragment form (#plan=) is the default on purpose: a fragment is never sent to "
               "the server, so the guide never leaves the reader's browser.",
    )
    p.add_argument("input", nargs="?", default="-", help="guide .md to encode, or the link to decode ('-' = stdin)")
    p.add_argument("-d", "--decode", action="store_true", help="decode a link/payload back to markdown")
    p.add_argument("--base", default=DEFAULT_BASE, help=f"viewer base URL (default: {DEFAULT_BASE})")
    p.add_argument("--name", help="filename to carry in the link (default: the input's basename)")
    p.add_argument("--no-name", action="store_true", help="omit the name parameter")
    p.add_argument("--out", help="(decode) write markdown to a file instead of stdout")
    p.add_argument("--query", action="store_true", help='use "?plan=" instead of the default "#plan="')
    p.add_argument("--raw", action="store_true", help="skip DEFLATE; encode as plain base64url")
    p.add_argument("--markdown", action="store_true", help="print a ready-to-paste markdown link")
    p.add_argument("--json", action="store_true", help="print url/payload/title/items as JSON")
    p.add_argument("--force", action="store_true", help="encode even if the file isn't a valid guide")
    p.add_argument("--quiet", action="store_true", help="suppress the size summary on stderr")
    a = p.parse_args()

    if a.decode:
        source = read_text("-") if a.input == "-" else a.input
        md = decode_payload(extract_payload(source))
        if md is None:
            print("plan_url: could not decode that link — the payload isn't valid base64url.", file=sys.stderr)
            return 1
        info = inspect(md)
        if not info["ok"] and not a.quiet:
            print(f"plan_url: warning — decoded text isn't a valid guide ({info['reason']}).", file=sys.stderr)
        if a.out:
            with open(a.out, "wb") as fh:
                fh.write(md.encode("utf-8"))
            if not a.quiet:
                print(f"plan_url: wrote {a.out} ({info['items']} items)", file=sys.stderr)
        else:
            write_stdout(md if md.endswith("\n") else md + "\n")
        return 0

    md = read_text(a.input)
    info = inspect(md)
    if not info["ok"] and not a.force:
        print(f"plan_url: {a.input} doesn't look like an acceptance guide — {info['reason']}.", file=sys.stderr)
        print("plan_url: fix it against FORMAT.md, or pass --force to encode anyway.", file=sys.stderr)
        return 2

    payload = encode_payload(md, raw=a.raw)
    name = None if a.no_name else (a.name or (None if a.input == "-" else os.path.basename(a.input)))
    base = re.sub(r"[#?].*$", "", a.base)
    url = f"{base}{'?' if a.query else '#'}plan={payload}"
    if name:
        url += "&name=" + urllib.parse.quote(name, safe="")

    if a.json:
        print(json.dumps({"url": url, "payload": payload, "title": info["title"],
                          "items": info["items"], "bytes": len(md.encode('utf-8')),
                          "length": len(url)}, indent=2))
    elif a.markdown:
        label = re.sub(r"[\[\]]", "", info["title"] or "Acceptance guide")
        print(f"[{label} — open in the viewer]({url})")
    else:
        print(url)

    if not a.quiet:
        src = len(md.encode("utf-8"))
        pct = round((1 - len(url) / src) * 100)
        extra = f" ({pct}% shorter)" if pct > 0 else ""
        print(f"plan_url: {info['items']} items, {src} B markdown → {len(url)} char link{extra}", file=sys.stderr)
        if len(url) > WARN_LEN:
            print(f"plan_url: warning — {len(url)} chars is long for a link; some chat clients truncate "
                  f"past ~{WARN_LEN}. Send the file instead, or trim the guide.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
