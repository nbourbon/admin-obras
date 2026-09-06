"""Sanitize rich text produced by the notes editor before storing or returning it."""

from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit


ALLOWED_TAGS = {
    "a", "b", "blockquote", "br", "code", "em", "h1", "h2", "h3",
    "i", "li", "ol", "p", "pre", "s", "span", "strong", "u", "ul",
}
VOID_TAGS = {"br"}
DROP_WITH_CONTENT = {"applet", "audio", "embed", "iframe", "math", "object", "script", "style", "svg", "template", "video"}


class _RichTextSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in DROP_WITH_CONTENT:
            self.drop_depth += 1
            return
        if self.drop_depth or tag not in ALLOWED_TAGS:
            return

        clean_attrs: list[tuple[str, str]] = []
        for name, value in attrs:
            name = name.lower()
            value = value or ""
            if tag == "a" and name == "href":
                scheme = urlsplit(value.strip()).scheme.lower()
                if scheme in {"", "http", "https", "mailto"}:
                    clean_attrs.append(("href", value.strip()))
            elif tag == "a" and name == "title":
                clean_attrs.append(("title", value))
            elif tag == "a" and name == "target" and value in {"_blank", "_self"}:
                clean_attrs.append(("target", value))
            elif name == "class" and tag in {"p", "li", "span"}:
                classes = " ".join(token for token in value.split() if token.startswith("ql-"))
                if classes:
                    clean_attrs.append(("class", classes))

        if tag == "a" and any(name == "target" and value == "_blank" for name, value in clean_attrs):
            clean_attrs.append(("rel", "noopener noreferrer"))
        rendered_attrs = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in clean_attrs)
        self.parts.append(f"<{tag}{rendered_attrs}>")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in DROP_WITH_CONTENT:
            if self.drop_depth:
                self.drop_depth -= 1
            return
        if not self.drop_depth and tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.drop_depth:
            self.parts.append(escape(data))


class _PlainTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in DROP_WITH_CONTENT:
            self.drop_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in DROP_WITH_CONTENT and self.drop_depth:
            self.drop_depth -= 1

    def handle_data(self, data):
        if not self.drop_depth:
            self.parts.append(data)


def sanitize_rich_text(value: str | None) -> str | None:
    if value is None:
        return None
    sanitizer = _RichTextSanitizer()
    sanitizer.feed(value)
    sanitizer.close()
    return "".join(sanitizer.parts)


def sanitize_plain_text(value: str | None) -> str | None:
    if value is None:
        return None
    extractor = _PlainTextExtractor()
    extractor.feed(value)
    extractor.close()
    return "".join(extractor.parts)
