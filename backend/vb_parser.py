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

    FB2_NS = "http://www.gribuser.ru/xml/fictionbook/2.0"

    def _fb2_tag(tag: str) -> str:
        return f"{{{FB2_NS}}}{tag}"

    try:
        parser = etree.XMLParser(huge_tree=True)
        tree = etree.parse(file_path, parser)
        root = tree.getroot()
    except Exception as e:
        err_str = str(e).lower()
        if "too long" in err_str or "huge" in err_str or "resource" in err_str:
            logger.warning(f"Large FB2 file detected, retrying with huge_tree: {file_path}")
            try:
                parser = etree.XMLParser(huge_tree=True)
                tree = etree.parse(file_path, parser)
                root = tree.getroot()
            except Exception as e2:
                logger.error(f"Failed to parse FB2 even with huge_tree: {e2}")
                # Return minimal structure for failed parse
                filename = os.path.basename(file_path)
                title = os.path.splitext(filename)[0].split('_', 1)[1] if '_' in filename else filename
                return {"format_version": "fb2", "title": title, "author": "", "toc": [], "chapters": []}
        else:
            raise

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

    # Extract cover image from coverpage
    cover_image_id = None
    coverpage = root.find(f".//{_fb2_tag('coverpage')}")
    if coverpage is not None:
        for img in coverpage:
            if img.tag == _fb2_tag("image"):
                href = img.get("{http://www.w3.org/1999/xlink}href")
                if href:
                    cover_image_id = href.lstrip("#")
    
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
    
    # Add cover image as first paragraph if exists
    if cover_image_id:
        chapters.insert(0, {
            "id": "cover",
            "title": "Обложка",
            "index": 0,
            "paragraphs": [
                {
                    "id": "cover-image",
                    "text": "",
                    "image": cover_image_id,
                    "character": None,
                    "emotion": None,
                    "bold": False,
                    "italic": False,
                    "color": None,
                }
            ],
        })
    
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

            character = block.get("character")

            ai = block.get("ai", {}) or {}
            if character is None:
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


# ============================================================================
# Image extraction from books
# ============================================================================
def extract_fb2_images(file_path: str, output_dir: str) -> dict:
    """Extract images from FB2 file to output directory. Returns dict of id -> filename."""
    from lxml import etree
    
    images = {}
    try:
        parser = etree.XMLParser(huge_tree=True)
        tree = etree.parse(file_path, parser)
        root = tree.getroot()
        
        binaries = root.findall(f".//{{{FB2_NS}}}binary")
        for binary in binaries:
            bid = binary.get("id")
            content_type = binary.get("content-type", "")
            
            if "jpeg" in content_type.lower() or "jpg" in content_type.lower():
                ext = ".jpg"
            elif "png" in content_type.lower():
                ext = ".png"
            elif "gif" in content_type.lower():
                ext = ".gif"
            elif "webp" in content_type.lower():
                ext = ".webp"
            else:
                ext = ".jpg"
            
            if binary.text:
                import base64
                try:
                    image_data = base64.b64decode(binary.text)
                    filename = f"{bid}{ext}"
                    out_path = os.path.join(output_dir, filename)
                    with open(out_path, "wb") as f:
                        f.write(image_data)
                    images[bid] = filename
                except Exception as e:
                    logger.warning(f"Failed to decode binary {bid}: {e}")
                    
    except Exception as e:
        logger.error(f"Error extracting images from FB2: {e}")
    
    return images


def extract_epub_images(file_path: str, output_dir: str) -> dict:
    """Extract images from EPUB file to output directory. Returns dict of id -> filename."""
    import zipfile
    
    images = {}
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            for name in zf.namelist():
                if name.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                    try:
                        data = zf.read(name)
                        basename = os.path.basename(name)
                        out_path = os.path.join(output_dir, basename)
                        with open(out_path, "wb") as f:
                            f.write(data)
                        images[basename] = basename
                    except Exception as e:
                        logger.warning(f"Failed to extract {name}: {e}")
                        
    except Exception as e:
        logger.error(f"Error extracting images from EPUB: {e}")
    
    return images


def get_book_images(book_path: str, book_id: int) -> dict:
    """Extract and cache book images. Returns dict of id -> url."""
    import hashlib
    
    cache_dir = os.path.join(os.path.dirname(book_path), ".images", str(book_id))
    os.makedirs(cache_dir, exist_ok=True)
    
    ext = os.path.splitext(book_path)[1].lower()
    
    if ext == ".fb2":
        return extract_fb2_images(book_path, cache_dir)
    elif ext == ".epub":
        return extract_epub_images(book_path, cache_dir)
    else:
        return {}


def extract_cover_from_file(file_path: str, output_dir: str) -> Optional[str]:
    """Extract cover image from FB2 or EPUB file. Returns cover filename or None."""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".fb2":
        return extract_cover_from_fb2(file_path, output_dir)
    elif ext == ".epub":
        return extract_cover_from_epub(file_path, output_dir)
    
    return None


def extract_cover_from_fb2(file_path: str, output_dir: str) -> Optional[str]:
    """Extract cover from FB2 file and save to output_dir. Returns filename or None."""
    from lxml import etree
    import base64
    
    try:
        tree = etree.parse(file_path, etree.XMLParser(huge_tree=True))
        root = tree.getroot()
        
        # Find coverpage and image reference
        coverpage = root.find(f".//{{{FB2_NS}}}coverpage")
        if coverpage is None:
            return None
        
        cover_image_id = None
        for img in coverpage:
            if img.tag == f"{{{FB2_NS}}}image":
                href = img.get("{http://www.w3.org/1999/xlink}href")
                if href:
                    cover_image_id = href.lstrip("#")
                    break
        
        if not cover_image_id:
            return None
        
        # Find binary with matching id
        binaries = root.findall(f".//{{{FB2_NS}}}binary")
        for binary in binaries:
            if binary.get("id") == cover_image_id:
                content_type = binary.get("content-type", "image/jpeg")
                
                # Determine extension
                if "jpeg" in content_type.lower() or "jpg" in content_type.lower():
                    ext = ".jpg"
                elif "png" in content_type.lower():
                    ext = ".png"
                elif "gif" in content_type.lower():
                    ext = ".gif"
                elif "webp" in content_type.lower():
                    ext = ".webp"
                else:
                    ext = ".jpg"
                
                if binary.text:
                    try:
                        image_data = base64.b64decode(binary.text)
                        filename = f"cover{ext}"
                        out_path = os.path.join(output_dir, filename)
                        with open(out_path, "wb") as f:
                            f.write(image_data)
                        return filename
                    except Exception as e:
                        logger.warning(f"Failed to decode cover image {cover_image_id}: {e}")
                        return None
        
        return None
        
    except Exception as e:
        logger.error(f"Error extracting cover from FB2: {e}")
        return None


def extract_cover_from_epub(file_path: str, output_dir: str) -> Optional[str]:
    """Extract cover from EPUB file and save to output_dir. Returns filename or None."""
    import zipfile
    import xml.etree.ElementTree as ET
    
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            # Try to read OPF to find cover
            opf_file = None
            
            # First, try to find container.xml to get path to OPF
            try:
                container_xml = zf.read("META-INF/container.xml")
                root = ET.fromstring(container_xml)
                # Find rootfile element
                for elem in root.iter():
                    if "rootfile" in elem.tag:
                        opf_file = elem.get("full-path")
                        break
            except:
                pass
            
            if not opf_file:
                # Fallback: look for *.opf in root
                for name in zf.namelist():
                    if name.endswith(".opf"):
                        opf_file = name
                        break
            
            if opf_file:
                try:
                    opf_content = zf.read(opf_file)
                    root = ET.fromstring(opf_content)
                    
                    # Look for cover in metadata
                    ns = {"opf": "http://www.idpf.org/2007/opf", 
                          "dc": "http://purl.org/dc/elements/1.1/"}
                    
                    cover_id = None
                    for meta in root.findall(".//opf:meta[@name='cover']", ns):
                        cover_id = meta.get("content")
                        break
                    
                    if not cover_id:
                        # Try to find cover from manifest with id containing 'cover'
                        for item in root.findall(".//opf:item", ns):
                            item_id = item.get("id", "").lower()
                            if "cover" in item_id:
                                cover_id = item.get("id")
                                break
                    
                    if cover_id:
                        # Find the file path from manifest
                        cover_path = None
                        for item in root.findall(".//opf:item", ns):
                            if item.get("id") == cover_id:
                                cover_path = item.get("href")
                                break
                        
                        if cover_path:
                            # Resolve relative path from OPF location
                            opf_dir = os.path.dirname(opf_file)
                            full_cover_path = os.path.join(opf_dir, cover_path).replace("\\", "/")
                            
                            try:
                                cover_data = zf.read(full_cover_path)
                                ext = os.path.splitext(cover_path)[1].lower()
                                if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
                                    ext = ".jpg"
                                
                                filename = f"cover{ext}"
                                out_path = os.path.join(output_dir, filename)
                                with open(out_path, "wb") as f:
                                    f.write(cover_data)
                                return filename
                            except Exception as e:
                                logger.warning(f"Failed to extract cover from {full_cover_path}: {e}")
                except Exception as e:
                    logger.warning(f"Error parsing OPF: {e}")
            
            # Fallback: look for first image in EPUB
            for name in zf.namelist():
                if name.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                    try:
                        cover_data = zf.read(name)
                        ext = os.path.splitext(name)[1].lower()
                        filename = f"cover{ext}"
                        out_path = os.path.join(output_dir, filename)
                        with open(out_path, "wb") as f:
                            f.write(cover_data)
                        return filename
                    except Exception as e:
                        logger.warning(f"Failed to extract {name}: {e}")
        
        return None
        
    except Exception as e:
        logger.error(f"Error extracting cover from EPUB: {e}")
        return None

