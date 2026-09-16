#!/usr/bin/env python3
"""
Regenerate the .md twin of every .html page for Accept: text/markdown
content negotiation (see the "Markdown for agents" rules in web.config).

Run from the repository root after changing any page content:

    python3 tools/generate-markdown.py

Stdlib only - no dependencies to install.
"""

import html
import os
import re
from html.parser import HTMLParser

SITE = "https://ostechnology.uk"

# Elements whose contents never belong in the markdown twin.
DROP_TAGS = {"script", "style", "svg", "noscript", "template", "nav"}

# Class names on elements inside <main> that are chrome rather than content.
DROP_CLASSES = ("breadcrumb", "skip-link", "page-hero-bg")

VOID = {"br", "hr", "img", "input", "meta", "link", "source", "area", "col"}

HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}

# Elements that should start a new block when opened and closed.
BLOCK = {
    "p", "div", "section", "article", "header", "footer", "table", "tr",
    "blockquote", "aside", "figure", "figcaption", "form", "dl", "dt", "dd",
} | HEADINGS


def is_chrome(tag, attrs):
    """True if this element and everything inside it should be dropped."""
    if tag in DROP_TAGS:
        return True
    if attrs.get("aria-hidden") == "true":
        return True
    if tag == "i" and "data-lucide" in attrs:
        return True
    cls = attrs.get("class", "")
    return any(c in cls for c in DROP_CLASSES)


class Extractor(HTMLParser):
    """Pull <title>, the meta description, the canonical URL and <main>."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.main = []
        self._in_title = False
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
            return
        if tag == "meta" and a.get("name") == "description":
            self.description = html.unescape(a.get("content", ""))
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href", "")

        if tag == "main":
            self._depth += 1
            if self._depth == 1:
                return
        if self._depth:
            self.main.append(self.get_starttag_text())

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
            return
        if not self._depth:
            return
        if tag == "main":
            self._depth -= 1
            if self._depth == 0:
                return
        self.main.append(f"</{tag}>")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._depth:
            self.main.append(data)

    def handle_entityref(self, name):
        self.handle_data(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        self.handle_data(html.unescape(f"&#{name};"))


class ToMarkdown(HTMLParser):
    """Convert the extracted <main> fragment into markdown."""

    def __init__(self, page_url):
        super().__init__(convert_charrefs=False)
        self.page_url = page_url
        self.out = []
        # Suppression: when set, everything up to the matching close is dropped.
        self._sup_tag = None
        self._sup_depth = 0
        self._list = []
        self._href = None
        self._link_text = []
        # Table state: rows are collected then rendered as a pipe table.
        self._table = None
        self._row = None
        self._cell = None
        self._in_thead = False

    # -- helpers ---------------------------------------------------------
    @property
    def suppressed(self):
        return self._sup_tag is not None

    def _write(self, text):
        if self._cell is not None:
            self._cell.append(text)
        else:
            self.out.append(text)

    def _emit(self, text):
        if self._href is not None:
            self._link_text.append(text)
        else:
            self._write(text)

    def _break(self, count=2):
        if self._cell is not None:
            self._cell.append(" ")
        else:
            self.out.append("\n" * count)

    def _render_table(self):
        rows = [r for r in self._table if r[1]]
        self._table = None
        if not rows:
            return
        width = max(len(cells) for _, cells in rows)

        def line(cells):
            padded = list(cells) + [""] * (width - len(cells))
            return "| " + " | ".join(padded) + " |"

        header, body = None, rows
        if rows[0][0]:
            header, body = rows[0][1], rows[1:]

        self.out.append("\n\n")
        if header is None:
            self.out.append(line([""] * width) + "\n")
        else:
            self.out.append(line(header) + "\n")
        self.out.append("| " + " | ".join(["---"] * width) + " |\n")
        for _, cells in body:
            self.out.append(line(cells) + "\n")
        self.out.append("\n")

    def _abs(self, url):
        if not url:
            return ""
        if url.startswith(("http://", "https://", "mailto:", "tel:")):
            return url
        if url.startswith("#"):
            return self.page_url + url
        if url.startswith("/"):
            return SITE + url
        base = self.page_url.rstrip("/").rsplit("/", 1)[0]
        while url.startswith("../"):
            url = url[3:]
            base = base.rsplit("/", 1)[0]
        return f"{base}/{url}"

    # -- parser callbacks ------------------------------------------------
    def handle_starttag(self, tag, attrs, void=False):
        a = dict(attrs)

        if self.suppressed:
            # Track nesting so we close suppression at the right element.
            if tag == self._sup_tag and not void and tag not in VOID:
                self._sup_depth += 1
            return

        if is_chrome(tag, a):
            if not void and tag not in VOID:
                self._sup_tag = tag
                self._sup_depth = 1
            return

        if tag == "table":
            self._break()
            self._table = []
            return
        if self._table is not None:
            if tag == "thead":
                self._in_thead = True
                return
            if tag == "tbody":
                self._in_thead = False
                return
            if tag == "tr":
                self._row = []
                return
            if tag in ("th", "td"):
                self._cell = []
                return

        if tag in HEADINGS:
            self._break()
            self.out.append("#" * int(tag[1]) + " ")
        elif tag == "p":
            self._break()
        elif tag == "br":
            self.out.append("  \n")
        elif tag == "hr":
            self._break()
            self.out.append("---")
            self._break()
        elif tag in ("ul", "ol"):
            self._break()
            self._list.append([tag, 0])
        elif tag == "li":
            self.out.append("\n")
            if self._list:
                kind, n = self._list[-1]
                indent = "  " * (len(self._list) - 1)
                if kind == "ol":
                    self._list[-1][1] = n + 1
                    self.out.append(f"{indent}{n + 1}. ")
                else:
                    self.out.append(f"{indent}- ")
            else:
                self.out.append("- ")
        elif tag in ("strong", "b"):
            self._emit("**")
        elif tag in ("em", "i"):
            self._emit("*")
        elif tag == "code":
            self._emit("`")
        elif tag == "blockquote":
            self._break()
            self.out.append("> ")
        elif tag == "a":
            self._href = self._abs(a.get("href", ""))
            self._link_text = []
        elif tag == "img":
            alt = a.get("alt", "")
            if alt:
                self._emit(f"![{alt}]({self._abs(a.get('src', ''))})")
        elif tag in BLOCK:
            self._break()

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs, void=True)
        if tag not in VOID and not self.suppressed:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.suppressed:
            if tag == self._sup_tag:
                self._sup_depth -= 1
                if self._sup_depth <= 0:
                    self._sup_tag = None
                    self._sup_depth = 0
            return

        if self._table is not None:
            if tag == "table":
                self._render_table()
                self._row = None
                self._cell = None
                self._in_thead = False
                return
            if tag in ("th", "td"):
                text = re.sub(r"\s+", " ", "".join(self._cell or [])).strip()
                self._cell = None
                if self._row is not None:
                    self._row.append(text.replace("|", "\\|"))
                return
            if tag == "tr":
                if self._row is not None:
                    self._table.append((self._in_thead, self._row))
                self._row = None
                return
            if tag in ("thead", "tbody"):
                return

        if tag in HEADINGS:
            self._break()
        elif tag in ("strong", "b"):
            self._emit("**")
        elif tag in ("em", "i"):
            self._emit("*")
        elif tag == "code":
            self._emit("`")
        elif tag in ("ul", "ol"):
            if self._list:
                self._list.pop()
            self._break()
        elif tag == "li":
            pass  # keep list items tight
        elif tag == "a":
            text = "".join(self._link_text).strip()
            href = self._href
            self._href = None
            self._link_text = []
            if text and href:
                self._write(f"[{text}]({href})")
            elif text:
                self._write(text)
        elif tag in BLOCK:
            self._break()

    def handle_data(self, data):
        if self.suppressed:
            return
        text = re.sub(r"\s+", " ", data)
        if not text.strip():
            if self.out and not self.out[-1].endswith((" ", "\n")):
                self._emit(" ")
            return
        self._emit(text)

    def handle_entityref(self, name):
        self.handle_data(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        self.handle_data(html.unescape(f"&#{name};"))

    def result(self):
        text = "".join(self.out)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        # Drop emphasis markers left empty by removed icons.
        text = re.sub(r"\*\*\s*\*\*", "", text)
        text = re.sub(r"(?m)^\*{1,2}$", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip() + "\n"


def page_url(path):
    slug = path[: -len(".html")].replace(os.sep, "/")
    if slug == "index":
        return SITE + "/"
    return f"{SITE}/{slug}"


def convert(path):
    raw = open(path, encoding="utf-8").read()
    ex = Extractor()
    ex.feed(raw)
    url = ex.canonical or page_url(path)

    md = ToMarkdown(url)
    md.feed("".join(ex.main))
    body = md.result()

    header = [f"# {ex.title.strip()}", ""]
    if ex.description:
        header += [f"> {ex.description}", ""]
    header += [f"Source: {url}", "", "---", ""]
    return "\n".join(header) + body


def main():
    pages = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "tools", "node_modules")]
        for f in files:
            if f.endswith(".html"):
                pages.append(os.path.normpath(os.path.join(root, f)))

    for path in sorted(pages):
        out = path[: -len(".html")] + ".md"
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(convert(path))

    print(f"{len(pages)} markdown files written.")


if __name__ == "__main__":
    main()
