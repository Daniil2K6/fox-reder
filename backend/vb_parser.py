import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger("vb_parser")

FB2_NS = "http://www.gribuser.ru/xml/fictionbook/2.0"
NS_MAP = {"fb": FB2_NS}


def _fb2_tag(tag: str) -> str:
    return f"{{{FB2_NS}}}{tag}"


def _extract_text_from_element(elem) -> str:
    parts = []
    if elem.text:
        parts.append(elem.text.strip())
    for child in elem:
        child_text = _extract_text_from_element(child)
        if child_text:
            parts.append(child_text)
        if child.tail:
            parts.append(child.tail.strip())
    return " ".join(p for p in parts if p)


def _collect_sections(sections, chapters: list, chapter_idx: list, parent_title: str = ""):
    from lxml import etree

    for section in sections:
        title_elem = section.find(_fb2_tag("title"))
        if title_elem is not None:
            title_text = _extract_text_from_element(title_elem)
        else:
            title_text = f"Глава {chapter_idx[0] + 1}" if not parent_title else parent_title

        paragraphs = []
        for child in section:
            if child.tag == _fb2_tag("title"):
                continue
            if child.tag == _fb2_tag("section"):
                _collect_sections([child], chapters, chapter_idx, title_text)
                continue
            if child.tag == _fb2_tag("p") or child.tag == _fb2_tag("empty-line"):
                text = _extract_text_from_element(child)
                if text:
                    paragraphs.append(text)

        if paragraphs:
            ch_id = f"ch-{chapter_idx[0]}"
            chapters.append({
                "id": ch_id,
                "title": title_text,
                "index": chapter_idx[0],
                "paragraphs": [
                    {
                        "id": f"{ch_id}-p-{i}",
                        "text": p,
                        "character": None,
                        "emotion": None,
                        "bold": False,
                        "italic": False,
                        "color": None,
                    }
                    for i, p in enumerate(paragraphs)
                ],
            })
            chapter_idx[0] += 1


def parse_fb2(file_path: str) -> dict:
    from lxml import etree

    tree = etree.parse(file_path)
    root = tree.getroot()

    title = "Untitled"
    title_info = root.find(f".//{_fb2_tag('title-info')}")
    if title_info is not None:
        book_title = title_info.find(_fb2_tag("book-title"))
        if book_title is not None and book_title.text:
            title = book_title.text.strip()

    author_text = "Unknown"
    if title_info is not None:
        author_elem = title_info.find(_fb2_tag("author"))
        if author_elem is not None:
            first = author_elem.find(_fb2_tag("first-name"))
            last = author_elem.find(_fb2_tag("last-name"))
            parts = []
            if first is not None and first.text:
                parts.append(first.text.strip())
            if last is not None and last.text:
                parts.append(last.text.strip())
            if parts:
                author_text = " ".join(parts)

    bodies = root.findall(_fb2_tag("body"))
    chapters = []
    chapter_idx = [0]

    for body in bodies:
        sections = body.findall(_fb2_tag("section"))
        if sections:
            _collect_sections(sections, chapters, chapter_idx)
        else:
            paragraphs = []
            for child in body:
                if child.tag == _fb2_tag("title"):
                    continue
                if child.tag == _fb2_tag("p") or child.tag == _fb2_tag("empty-line"):
                    text = _extract_text_from_element(child)
                    if text:
                        paragraphs.append(text)
            if paragraphs:
                ch_id = "ch-0"
                chapters.append({
                    "id": ch_id,
                    "title": title,
                    "index": 0,
                    "paragraphs": [
                        {
                            "id": f"{ch_id}-p-{i}",
                            "text": p,
                            "character": None,
                            "emotion": None,
                            "bold": False,
                            "italic": False,
                            "color": None,
                        }
                        for i, p in enumerate(paragraphs)
                    ],
                })

    if not chapters:
        all_text = []
        for body in bodies:
            all_text.extend(t.strip() for t in body.itertext() if t.strip())
        if all_text:
            chapters.append({
                "id": "ch-0",
                "title": title,
                "index": 0,
                "paragraphs": [
                    {
                        "id": f"ch-0-p-{i}",
                        "text": p,
                        "character": None,
                        "emotion": None,
                        "bold": False,
                        "italic": False,
                        "color": None,
                    }
                    for i, p in enumerate(all_text) if p
                ],
            })

    toc = [{"id": ch["id"], "title": ch["title"], "index": ch["index"]} for ch in chapters]

    return {
        "format_version": "fb2",
        "title": title,
        "author": author_text,
        "toc": toc,
        "chapters": chapters,
    }


def parse_vb(file_path: str) -> dict:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ValueError(f"Invalid VoxBook JSON: {e}")

    format_version = data.get("format_version", "unknown")
    chapters = []
    toc = []

    content_blocks = data.get("content", [])
    for chapter_idx, chapter in enumerate(content_blocks):
        chapter_title = chapter.get("title", f"Chapter {chapter_idx + 1}")
        chapter_id = f"ch-{chapter_idx}"
        toc.append({"id": chapter_id, "title": chapter_title, "index": chapter_idx})

        paragraphs = []
        blocks = chapter.get("content", [])
        for block_idx, block in enumerate(blocks):
            text = block.get("text", "")
            if not text:
                continue

            ai = block.get("ai", {}) or {}
            character = ai.get("character")
            emotion = ai.get("emotion")
            style = block.get("style", {}) or {}

            paragraphs.append({
                "id": f"{chapter_id}-p-{block_idx}",
                "text": text,
                "character": character,
                "emotion": emotion,
                "bold": style.get("bold", False),
                "italic": style.get("italic", False),
                "color": style.get("color"),
            })

        chapters.append({
            "id": chapter_id,
            "title": chapter_title,
            "index": chapter_idx,
            "paragraphs": paragraphs,
        })

    return {
        "format_version": format_version,
        "title": data.get("title", "Untitled"),
        "author": data.get("author", "Unknown"),
        "toc": toc,
        "chapters": chapters,
    }


def extract_plain_text(chapters: list) -> str:
     parts = []
     for ch in chapters:
         parts.append(ch["title"])
         for p in ch["paragraphs"]:
             parts.append(p["text"])
     return "\n".join(parts)


def extract_text(file_path: str, filename: str) -> tuple[str, Optional[str]]:
    """
    Extract text and structured content from a book file.
    Returns (plain_text_content, structured_json_string)
    """
    ext = os.path.splitext(filename)[1].lower()
    
    try:
        if ext == ".fb2":
            structured = parse_fb2(file_path)
        elif ext in (".vb", ".vblite"):
            structured = parse_vb(file_path)
        elif ext == ".txt":
            with open(file_path, "r", encoding="utf-8") as f:
                text_content = f.read()
            return text_content, None  # Plain text files don't have structure
        elif ext == ".epub":
            # For EPUB, we'll try to parse as text
            try:
                import zipfile
                text_parts = []
                with zipfile.ZipFile(file_path, "r") as z:
                    for name in z.namelist():
                        if name.endswith(".xhtml") or name.endswith(".html"):
                            try:
                                content = z.read(name).decode("utf-8", errors="ignore")
                                # Simple HTML text extraction
                                import re
                                text = re.sub("<[^>]+>", "\n", content)
                                text_parts.append(text)
                            except:
                                pass
                text_content = "\n".join(text_parts)
                return text_content, None
            except:
                return "", None
        else:
            return "", None
        
        # For FB2 and VB/VBLite with structure
        plain_text = extract_plain_text(structured.get("chapters", []))
        structured_json = json.dumps(structured, ensure_ascii=False)
        return plain_text, structured_json
        
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
        return "", None
