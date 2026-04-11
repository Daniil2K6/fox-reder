import hashlib
import json
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Series, Book, User, Comment, get_db
from auth import require_user, get_current_user
from vb_parser import parse_vb, parse_fb2, extract_plain_text, extract_text
from translation_service import get_translation_service

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
COVERS_DIR = os.path.join(os.path.dirname(__file__), "covers")
os.makedirs(COVERS_DIR, exist_ok=True)

SUPPORTED_EXTENSIONS = (".txt", ".fb2", ".epub", ".vb", ".vblite")

router = APIRouter(prefix="/api/books", tags=["books"])


class BookOut(BaseModel):
    id: int
    title: str
    filename: str
    sha256: str
    is_public: bool
    owner_id: int
    owner_username: str = ""
    has_structure: bool = False
    series_ids: List[int] = []
    series_names: List[str] = []
    cover_image: Optional[str] = None
    genres: Optional[str] = None
    description: Optional[str] = None
    comment_count: int = 0

    class Config:
        from_attributes = True


class BookMetadata(BaseModel):
    genres: Optional[str] = None
    description: Optional[str] = None


class CommentOut(BaseModel):
    id: int
    user_username: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class TranslateParagraphRequest(BaseModel):
    paragraph_id: str
    original_text: str
    source_language: str
    target_language: str
    force_refresh: bool = False


class TranslateMetadataRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    genres: Optional[str] = None
    source_language: str
    target_language: str
    force_refresh: bool = False


def extract_text(file_path: str, filename: str) -> tuple[str, Optional[str]]:
    ext = os.path.splitext(filename)[1].lower()
    try:
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read(), None
        elif ext == ".fb2":
            parsed = parse_fb2(file_path)
            plain = extract_plain_text(parsed["chapters"])
            structured = json.dumps(parsed, ensure_ascii=False)
            return plain, structured
        elif ext == ".epub":
            import ebooklib
            from ebooklib import epub
            from bs4 import BeautifulSoup
            book = epub.read_epub(file_path)
            texts = []
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                soup = BeautifulSoup(item.get_content(), "html.parser")
                texts.append(soup.get_text(separator=" ", strip=True))
            return "\n".join(texts), None
        elif ext in (".vb", ".vblite"):
            parsed = parse_vb(file_path)
            plain = extract_plain_text(parsed["chapters"])
            structured = json.dumps(parsed, ensure_ascii=False)
            return plain, structured
    except Exception as e:
        import logging
        logging.getLogger("books").error(f"Error extracting text from {filename}: {e}")
    return "", None


@router.post("/upload", response_model=BookOut)
async def upload_book(
    file: UploadFile = File(...),
    is_public: bool = Query(False),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Use {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()

    existing = db.query(Book).filter(Book.owner_id == user.id, Book.sha256 == sha256).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Duplicate book: '{existing.title}' already in your library")

    user_dir = os.path.join(UPLOAD_DIR, str(user.id))
    os.makedirs(user_dir, exist_ok=True)
    safe_name = f"{sha256[:16]}_{file.filename}"
    file_path = os.path.join(user_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    title = os.path.splitext(file.filename)[0]
    text_content, structured_content = extract_text(file_path, file.filename)

    book = Book(
        title=title,
        filename=file.filename,
        sha256=sha256,
        file_path=file_path,
        is_public=is_public,
        owner_id=user.id,
        text_content=text_content,
    )
    db.add(book)
    db.commit()
    db.refresh(book)

    if structured_content:
        struct_path = file_path + ".struct.json"
        with open(struct_path, "w", encoding="utf-8") as f:
            f.write(structured_content)

    return BookOut(
        id=book.id,
        title=book.title,
        filename=book.filename,
        sha256=book.sha256,
        is_public=book.is_public,
        owner_id=book.owner_id,
        owner_username=user.username,
        has_structure=structured_content is not None,
        series_ids=[s.id for s in book.series_list],
        series_names=[s.name for s in book.series_list],
    )


@router.get("/my", response_model=List[BookOut])
def my_books(user: User = Depends(require_user), db: Session = Depends(get_db)):
    # Admins see all books, regular users see only their own
    if user.role == "admin":
        books = db.query(Book).order_by(Book.created_at.desc()).all()
    else:
        books = db.query(Book).filter(Book.owner_id == user.id).order_by(Book.created_at.desc()).all()
    result = []
    for b in books:
        has_struct = os.path.exists(b.file_path + ".struct.json") if b.file_path else False
        comment_count = db.query(Comment).filter(Comment.book_id == b.id).count()
        owner = db.query(User).filter(User.id == b.owner_id).first()
        result.append(BookOut(
            id=b.id, title=b.title, filename=b.filename, sha256=b.sha256,
            is_public=b.is_public, owner_id=b.owner_id, owner_username=owner.username if owner else "Unknown",
            has_structure=has_struct, 
            series_ids=[s.id for s in b.series_list],
            series_names=[s.name for s in b.series_list],
            cover_image=b.cover_image,
            genres=b.genres,
            description=b.description,
            comment_count=comment_count,
        ))
    return result


@router.get("/public", response_model=List[BookOut])
def public_books(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    books = db.query(Book).filter(Book.is_public == True).order_by(Book.created_at.desc()).all()
    result = []
    for b in books:
        owner = db.query(User).filter(User.id == b.owner_id).first()
        has_struct = os.path.exists(b.file_path + ".struct.json") if b.file_path else False
        comment_count = db.query(Comment).filter(Comment.book_id == b.id).count()
        result.append(BookOut(
            id=b.id, title=b.title, filename=b.filename, sha256=b.sha256,
            is_public=b.is_public, owner_id=b.owner_id,
            owner_username=owner.username if owner else "unknown",
            has_structure=has_struct, 
            series_ids=[s.id for s in b.series_list],
            series_names=[s.name for s in b.series_list],
            cover_image=b.cover_image,
            genres=b.genres,
            description=b.description,
            comment_count=comment_count,
        ))
    return result


@router.get("/search")
def search_books(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    Search books by title, description, genres, and translations.
    For public books only (or user's own books if authenticated).
    """
    if not q:
        return []

    result = []
    
    # Simple substring search (works across databases)
    books = db.query(Book).filter(Book.is_public == True).all()
    
    for b in books:
        match = False
        search_lower = q.lower()
        
        # Check original fields
        if (b.title and search_lower in b.title.lower() or
            b.description and search_lower in b.description.lower() or
            b.genres and search_lower in b.genres.lower()):
            match = True
        
        # Check translated metadata
        if not match:
            for meta_trans in b.metadata_translations:
                if ((meta_trans.title and search_lower in meta_trans.title.lower()) or
                    (meta_trans.description and search_lower in meta_trans.description.lower()) or
                    (meta_trans.genres and search_lower in meta_trans.genres.lower())):
                    match = True
                    break
        
        if match:
            owner = db.query(User).filter(User.id == b.owner_id).first()
            has_struct = os.path.exists(b.file_path + ".struct.json") if b.file_path else False
            comment_count = db.query(Comment).filter(Comment.book_id == b.id).count()
            result.append(BookOut(
                id=b.id, title=b.title, filename=b.filename, sha256=b.sha256,
                is_public=b.is_public, owner_id=b.owner_id,
                owner_username=owner.username if owner else "unknown",
                has_structure=has_struct, 
                series_ids=[s.id for s in b.series_list],
                series_names=[s.name for s in b.series_list],
                cover_image=b.cover_image,
                genres=b.genres,
                description=b.description,
                comment_count=comment_count,
            ))
    
    return result


@router.get("/{book_id}", response_model=BookOut)
def get_book(
    book_id: int,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    owner = db.query(User).filter(User.id == book.owner_id).first()
    has_struct = os.path.exists(book.file_path + ".struct.json") if book.file_path else False
    comment_count = db.query(Comment).filter(Comment.book_id == book.id).count()
    return BookOut(
        id=book.id, title=book.title, filename=book.filename, sha256=book.sha256,
        is_public=book.is_public, owner_id=book.owner_id,
        owner_username=owner.username if owner else "unknown",
        has_structure=has_struct, 
        series_ids=[s.id for s in book.series_list],
        series_names=[s.name for s in book.series_list],
        cover_image=book.cover_image,
        genres=book.genres,
        description=book.description,
        comment_count=comment_count,
    )


@router.get("/{book_id}/text")
def get_book_text(
    book_id: int,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"text": book.text_content or "", "title": book.title}


@router.get("/{book_id}/structured")
def get_book_structured(
    book_id: int,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    struct_path = book.file_path + ".struct.json"
    if not os.path.exists(struct_path):
        raise HTTPException(status_code=404, detail="No structured content available")

    with open(struct_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@router.put("/{book_id}/visibility")
def toggle_visibility(
    book_id: int,
    is_public: bool = Query(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book.is_public = is_public
    db.commit()
    return {"id": book.id, "is_public": book.is_public}


@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    # Admins can delete any book, users can only delete their own
    if user.role == "admin":
        book = db.query(Book).filter(Book.id == book_id).first()
    else:
        book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if os.path.exists(book.file_path):
        os.remove(book.file_path)
    struct_path = book.file_path + ".struct.json"
    if os.path.exists(struct_path):
        os.remove(struct_path)
    db.delete(book)
    db.commit()
    return {"detail": "Book deleted"}


@router.put("/{book_id}/chapter/{chapter_index}")
def update_chapter(
    book_id: int,
    chapter_index: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found or access denied")

    struct_path = book.file_path + ".struct.json"
    if not os.path.exists(struct_path):
        raise HTTPException(status_code=404, detail="No structured content available")

    with open(struct_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    chapters = data.get("chapters", [])
    if chapter_index < 0 or chapter_index >= len(chapters):
        raise HTTPException(status_code=400, detail="Invalid chapter index")

    new_title = payload.get("title")
    new_paragraphs = payload.get("paragraphs")

    if new_title:
        chapters[chapter_index]["title"] = new_title
        for toc_item in data.get("toc", []):
            if toc_item.get("index") == chapter_index:
                toc_item["title"] = new_title

    if new_paragraphs and isinstance(new_paragraphs, list):
        chapters[chapter_index]["paragraphs"] = new_paragraphs

    with open(struct_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    plain_text = extract_plain_text(chapters)
    book.text_content = plain_text
    db.commit()

    return {"detail": "Chapter updated", "chapter_index": chapter_index}


@router.get("/{book_id}/convert/vblite")
def convert_to_vblite(
    book_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found or access denied")

    struct_path = book.file_path + ".struct.json"
    if os.path.exists(struct_path):
        with open(struct_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        from vb_parser import parse_fb2, parse_vb
        ext = os.path.splitext(book.filename)[1].lower()
        if ext == ".fb2":
            data = parse_fb2(book.file_path)
        else:
            plain = book.text_content or ""
            data = {
                "format_version": "vblite-1.0",
                "title": book.title,
                "author": "Unknown",
                "toc": [{"id": "ch-0", "title": book.title, "index": 0}],
                "chapters": [{
                    "id": "ch-0",
                    "title": book.title,
                    "index": 0,
                    "paragraphs": [{"id": f"ch-0-p-{i}", "text": p, "character": None, "emotion": None, "bold": False, "italic": False, "color": None} for i, p in enumerate(plain.split("\n")) if p.strip()],
                }],
            }

    vblite = {
        "format_version": "vblite-1.0",
        "title": data.get("title", book.title),
        "author": data.get("author", "Unknown"),
        "content": [
            {
                "title": ch["title"],
                "content": [
                    {
                        "text": p["text"],
                        "style": {
                            "bold": p.get("bold", False),
                            "italic": p.get("italic", False),
                            **({"color": p["color"]} if p.get("color") else {}),
                        },
                        **({"ai": {"character": p["character"]}} if p.get("character") else {}),
                    }
                    for p in ch.get("paragraphs", [])
                ],
            }
            for ch in data.get("chapters", [])
        ],
    }

    return vblite


@router.post("/series")
def create_series(
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Series name required")
    existing = db.query(Series).filter(Series.owner_id == user.id, Series.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Series already exists")
    s = Series(name=name, owner_id=user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "name": s.name}

@router.get("/series/list")
def list_series(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    # Admins see all series, regular users see only their own
    if user.role == "admin":
        series_list = db.query(Series).order_by(Series.name).all()
    else:
        series_list = db.query(Series).filter(Series.owner_id == user.id).order_by(Series.name).all()
    result = []
    for s in series_list:
        book_count = len(s.books)
        result.append({"id": s.id, "name": s.name, "book_count": book_count})
    return result

@router.delete("/series/{series_id}")
def delete_series(
    series_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id, Series.owner_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    db.delete(s)
    db.commit()
    return {"detail": "Series deleted"}

@router.put("/{book_id}/series")
def assign_to_series(
    book_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Get series_ids array (allow both single ID and multiple)
    series_ids = payload.get("series_ids", [])
    if isinstance(series_ids, int):
        series_ids = [series_ids]
    
    # Clear existing series
    book.series_list.clear()
    
    # Add new series
    for series_id in series_ids:
        s = db.query(Series).filter(Series.id == series_id, Series.owner_id == user.id).first()
        if s:
            book.series_list.append(s)
    
    db.commit()
    return {"id": book.id, "series_ids": [s.id for s in book.series_list]}


@router.post("/preview")
async def preview_book(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Use {', '.join(SUPPORTED_EXTENSIONS)}",
        )
    content = await file.read()
    # Save to a temporary file for parsing
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        title = os.path.splitext(file.filename)[0]
        text_content, structured_content = extract_text(tmp_path, file.filename)
        structured_data = None
        if structured_content:
            try:
                structured_data = json.loads(structured_content)
            except json.JSONDecodeError:
                structured_data = None
        return {
            "title": title,
            "filename": file.filename,
            "text": text_content,
            "has_structure": structured_content is not None,
            "structured": structured_data,
        }
    finally:
        os.unlink(tmp_path)


@router.post("/{book_id}/cover")
async def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    content = await file.read()
    # Determine extension
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    # Ensure it's an image extension (simple check)
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="Invalid image format")
    cover_filename = f"cover_{book_id}{ext}"
    cover_path = os.path.join(COVERS_DIR, cover_filename)
    # Remove old cover if exists
    if book.cover_image and os.path.exists(os.path.join(COVERS_DIR, book.cover_image)):
        try:
            os.remove(os.path.join(COVERS_DIR, book.cover_image))
        except OSError:
            pass
    with open(cover_path, "wb") as f:
        f.write(content)
    book.cover_image = cover_filename
    db.commit()
    return {"cover_image": book.cover_image}


@router.get("/{book_id}/cover")
def get_cover(
    book_id: int,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.cover_image:
        raise HTTPException(status_code=404, detail="No cover")
    cover_path = os.path.join(COVERS_DIR, book.cover_image)
    if not os.path.exists(cover_path):
        raise HTTPException(status_code=404, detail="Cover file missing")
    return FileResponse(cover_path)


@router.put("/{book_id}/metadata")
def update_metadata(
    book_id: int,
    payload: BookMetadata,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if payload.genres is not None:
        book.genres = payload.genres
    if payload.description is not None:
        book.description = payload.description
    db.commit()
    return {"id": book.id, "genres": book.genres, "description": book.description}


@router.post("/{book_id}/translate/paragraph")
async def translate_paragraph(
    book_id: int,
    payload: TranslateParagraphRequest,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    service = get_translation_service()
    try:
        translated = await service.translate_paragraph(
            db,
            book_id,
            payload.paragraph_id,
            payload.original_text,
            payload.source_language,
            payload.target_language,
            payload.force_refresh
        )
        return {"translated_text": translated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@router.post("/{book_id}/translate/metadata")
async def translate_metadata(
    book_id: int,
    payload: TranslateMetadataRequest,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    service = get_translation_service()
    try:
        translated = await service.translate_metadata(
            db,
            book_id,
            payload.title,
            payload.description,
            payload.genres,
            payload.source_language,
            payload.target_language,
            payload.force_refresh
        )
        return translated
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metadata translation failed: {str(e)}")


@router.get("/{book_id}/comments", response_model=List[CommentOut])
def get_comments(
    book_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != (user.id if user else -1) and not book.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    comments = db.query(Comment).filter(Comment.book_id == book_id).order_by(Comment.created_at.asc()).all()
    result = []
    for c in comments:
        result.append(CommentOut(
            id=c.id,
            user_username=c.user.username if c.user else "unknown",
            content=c.content,
            created_at=c.created_at,
        ))
    return result


@router.post("/{book_id}/comments", response_model=CommentOut)
def create_comment(
    book_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    content = payload.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.owner_id != user.id and not book.is_public:
        raise HTTPException(status_code=403, detail="Cannot comment on private book")
    comment = Comment(book_id=book_id, user_id=user.id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut(
        id=comment.id,
        user_username=user.username,
        content=comment.content,
        created_at=comment.created_at,
    )


@router.delete("/{book_id}/comments/{comment_id}")
def delete_comment(
    book_id: int,
    comment_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.book_id == book_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    db.delete(comment)
    db.commit()
    return {"detail": "Deleted"}
