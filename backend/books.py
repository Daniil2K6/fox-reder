import hashlib
import json
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, UniqueConstraint
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import Series, Book, BookVersion, User, Comment, Like, Subscription, Notification, get_db
from auth import require_user, get_current_user, require_admin
from vb_parser import parse_vb, parse_fb2, extract_plain_text, extract_cover_from_file
from config import MAX_FILE_SIZE, MAX_FILE_SIZE_MB

LIBRALI_DIR = os.path.join(os.path.dirname(__file__), "librali")
os.makedirs(os.path.join(LIBRALI_DIR, "books"), exist_ok=True)
os.makedirs(os.path.join(LIBRALI_DIR, "covers"), exist_ok=True)
os.makedirs(os.path.join(LIBRALI_DIR, "series"), exist_ok=True)
os.makedirs(os.path.join(LIBRALI_DIR, "avatars"), exist_ok=True)

# Для совместимости
UPLOAD_DIR = os.path.join(LIBRALI_DIR, "books")
COVERS_DIR = os.path.join(LIBRALI_DIR, "covers")
SERIES_DIR = os.path.join(LIBRALI_DIR, "series")
AVATAR_DIR = os.path.join(LIBRALI_DIR, "avatars")

SUPPORTED_EXTENSIONS = (".txt", ".fb2", ".epub", ".vb", ".vblite")


def is_animated_image(content: bytes) -> bool:
    """Check if image is animated (GIF89a with NETSCAPE extension or WebP with animation)."""
    if content[:6] == b"\x47\x49\x46\x38\x39\x61":
        if b"NETSCAPE" in content:
            return True
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        if b"ANIM" in content[:100]:
            return True
    return False


def get_image_extension(filename: str, content: bytes) -> str:
    """Get safe image extension, considering content type."""
    ext = os.path.splitext(filename)[1].lower() if filename else ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        return ".jpg"
    return ext


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
    like_count: int = 0
    is_liked: bool = False
    view_count: int = 0
    owner_avatar: Optional[str] = None
    formats: List[str] = []
    preferred_format: Optional[str] = None

    class Config:
        from_attributes = True


class AuthorOut(BaseModel):
    id: int
    username: str
    book_count: int = 0
    is_subscribed: bool = False
    subscriber_count: int = 0
    total_views: int = 0
    total_comments: int = 0
    total_likes: int = 0
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BookMetadata(BaseModel):
    genres: Optional[str] = None
    description: Optional[str] = None


class CommentOut(BaseModel):
    id: int
    user_id: int
    user_username: str
    user_avatar: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


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
    series_name: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    genres: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    group_id: Optional[str] = Form(None),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    print(f"Upload params: title={title}, group_id={group_id}, filename={file.filename}")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Use {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    
    # SECURITY: Check file size limit (defense in depth)
    file_size = len(content)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB:.0f}MB"
        )
    
    sha256 = hashlib.sha256(content).hexdigest()
    print(f"Uploaded file SHA256: {sha256}")

    book_title = title.strip() if title else os.path.splitext(file.filename)[0]
    book_format = ext.lstrip(".")
    
    # Check if adding as alternative format to existing book
    existing_book = None
    print(f"group_id = {group_id}")
    if group_id:
        try:
            gid = int(group_id)
            print(f"Parsing group_id: {gid}")
            existing_book = db.query(Book).filter(Book.id == gid, Book.owner_id == user.id).first()
            print(f"Found by group_id: {existing_book}")
        except Exception as e:
            print(f"Error parsing group_id: {e}")
            pass
    
    # Or find by title
    if not existing_book and title:
        existing_book = db.query(Book).filter(
            Book.owner_id == user.id,
            func.lower(Book.title) == title.lower()
        ).first()
        print(f"Found by title: {existing_book}")
    
    # Check if this exact file already exists (only for new books)
    if not existing_book:
        duplicate = db.query(Book).filter(Book.owner_id == user.id, Book.sha256 == sha256).first()
        if duplicate:
            print(f"Duplicate detected: existing book {duplicate.id} with same SHA256")
            raise HTTPException(status_code=409, detail="Эта книга уже есть в вашей библиотеке")
    
    if existing_book:
        # Add as alternative format
        safe_name = f"{sha256[:16]}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(file_path, "wb") as f:
            f.write(content)
        
        version = BookVersion(
            book_id=existing_book.id,
            format=book_format,
            file_path=file_path,
            sha256=sha256,
            filename=file.filename,
        )
        db.add(version)
        db.commit()
        
        # Try to extract cover from this format if book doesn't have one
        if not existing_book.cover_image:
            try:
                cover_filename = extract_cover_from_file(file_path, COVERS_DIR)
                if cover_filename:
                    existing_book.cover_image = cover_filename
                    db.commit()
            except Exception as e:
                print(f"Warning: Could not extract cover: {e}")

        return BookOut(
            id=existing_book.id,
            title=existing_book.title,
            filename=file.filename,
            sha256=sha256,
            is_public=existing_book.is_public,
            owner_id=existing_book.owner_id,
            owner_username=user.username,
            has_structure=False,
            series_ids=[s.id for s in existing_book.series_list],
            series_names=[s.name for s in existing_book.series_list],
            view_count=existing_book.view_count or 0,
            formats=[v.format for v in existing_book.versions] + [file.filename.split('.')[-1].lower()],
            preferred_format=existing_book.preferred_format,
        )

    # New book
    safe_name = f"{sha256[:16]}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    book = Book(
        title=book_title,
        filename=file.filename,
        sha256=sha256,
        file_path=file_path,
        is_public=True,
        owner_id=user.id,
        genres=genres if genres else None,
        description=description if description else None,
    )
    db.add(book)
    
     # Extract text content for new books
    text_content, structured_content = extract_text(file_path, file.filename)
    book.text_content = text_content
    
    try:
        db.commit()
        db.refresh(book)
    except IntegrityError:
        db.rollback()
        db.query(Book).filter(Book.owner_id == user.id, Book.sha256 == sha256).first()
        raise HTTPException(status_code=409, detail="Эта книга уже есть в вашей библиотеке")

    if series_name:
        series_name = series_name.strip()
        if series_name:
            existing_series = db.query(Series).filter(func.lower(Series.name) == series_name.lower()).first()
            if existing_series:
                book.series_list.append(existing_series)
            else:
                new_series = Series(name=series_name)
                db.add(new_series)
                db.flush()
                book.series_list.append(new_series)
    
    db.commit()
    db.refresh(book)

    # Extract cover from file
    try:
        cover_filename = extract_cover_from_file(file_path, COVERS_DIR)
        if cover_filename and not book.cover_image:
            book.cover_image = cover_filename
            db.commit()
    except Exception as e:
        print(f"Warning: Could not extract cover: {e}")

    if structured_content:
        struct_path = file_path + ".struct.json"
        with open(struct_path, "w", encoding="utf-8") as f:
            f.write(structured_content)

    formats = [book.filename.split('.')[-1].lower()]
    if book.versions:
        for v in book.versions:
            if v.format not in formats:
                formats.append(v.format)

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
        view_count=0,
        owner_avatar=None,
        formats=formats,
        preferred_format=book.preferred_format,
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
            view_count=b.view_count or 0,
            owner_avatar=owner.avatar_url if owner else None,
            formats=[b.filename.split('.')[-1].lower()] + [v.format for v in b.versions],
            preferred_format=b.preferred_format,
        ))
    return result


@router.get("/public", response_model=List[BookOut])
def public_books(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at", description="created_at, likes, views"),
    genre: Optional[str] = Query(None),
    extension: Optional[str] = Query(None),
    min_pages: Optional[int] = Query(None),
):
    query = db.query(Book).filter(Book.is_public == True)
    
    if search:
        search_lower = search.lower()
        query = query.filter(
            (Book.title.ilike(f"%{search_lower}%")) |
            (Book.description.ilike(f"%{search_lower}%")) |
            (Book.genres.ilike(f"%{search_lower}%"))
        )
    
    if genre:
        query = query.filter(Book.genres.ilike(f"%{genre}%"))
    
    if extension:
        ext = f".{extension.lower().strip('.')}"
        query = query.filter(Book.filename.ilike(f"%{ext}"))
    
    total = query.count()
    
    if sort_by == "likes":
        # Need to join with Like to sort - get book IDs with like counts
        books_with_likes = db.query(
            Book.id,
            func.count(Like.id).label("like_count")
        ).outerjoin(Like, Book.id == Like.book_id).filter(Book.is_public == True).group_by(Book.id).order_by(func.count(Like.id).desc()).all()
        book_ids_ordered = [b.id for b in books_with_likes]
        # Manual sort
        books = query.all()
        books.sort(key=lambda b: book_ids_ordered.index(b.id) if b.id in book_ids_ordered else 9999)
    elif sort_by == "views":
        query = query.order_by(Book.view_count.desc())
        books = query.offset((page - 1) * limit).limit(limit).all()
    else:  # created_at
        query = query.order_by(Book.created_at.desc())
        books = query.offset((page - 1) * limit).limit(limit).all()
    
    result = []
    for b in books:
        owner = db.query(User).filter(User.id == b.owner_id).first()
        has_struct = os.path.exists(b.file_path + ".struct.json") if b.file_path else False
        comment_count = db.query(Comment).filter(Comment.book_id == b.id).count()
        like_count = db.query(Like).filter(Like.book_id == b.id).count()
        is_liked = False
        if user:
            like = db.query(Like).filter(Like.user_id == user.id, Like.book_id == b.id).first()
            is_liked = bool(like)
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
            like_count=like_count,
            is_liked=is_liked,
            view_count=b.view_count or 0,
            owner_avatar=owner.avatar_url if owner else None,
formats=[b.filename.split('.')[-1].lower()] + [v.format for v in b.versions],
            preferred_format=b.preferred_format,
        ))
    return result

@router.get("/public/count")
def public_books_count(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
):
    query = db.query(Book).filter(Book.is_public == True)
    
    if search:
        search_lower = search.lower()
        query = query.filter(
            (Book.title.ilike(f"%{search_lower}%")) |
            (Book.description.ilike(f"%{search_lower}%")) |
            (Book.genres.ilike(f"%{search_lower}%"))
        )
    
    return {"total": query.count()}


@router.get("/public/hot")
def hot_books(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Get 5 random books from Plus users for hot books section."""
    plus_users = db.query(User).filter(User.is_plus == True).all()
    if not plus_users:
        return []
    plus_user_ids = [u.id for u in plus_users]
    books = db.query(Book).filter(
        Book.is_public == True,
        Book.owner_id.in_(plus_user_ids)
    ).all()
    if len(books) <= 5:
        return [{"id": b.id, "title": b.title, "cover_image": b.cover_image, "owner_id": b.owner_id, "owner_username": b.owner.username if b.owner else "", "formats": [b.filename.split('.')[-1].lower()] + [v.format for v in b.versions]} for b in books]
    import random
    selected = random.sample(books, 5)
    return [{"id": b.id, "title": b.title, "cover_image": b.cover_image, "owner_id": b.owner_id, "owner_username": b.owner.username if b.owner else "", "formats": [b.filename.split('.')[-1].lower()] + [v.format for v in b.versions]} for b in selected]


@router.get("/search")
def search_books(
    q: str = Query("", min_length=1),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Search public books by title, description, and genres."""
    if not q:
        return []

    result = []
    
    # Simple substring search (works across databases)
    books = db.query(Book).filter(Book.is_public == True).all()
    
    for b in books:
        match = False
        search_lower = q.lower()
        
        if (b.title and search_lower in b.title.lower() or
            b.description and search_lower in b.description.lower() or
            b.genres and search_lower in b.genres.lower()):
            match = True

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
                view_count=b.view_count or 0,
                owner_avatar=owner.avatar_url if owner else None,
                formats=[b.filename.split('.')[-1].lower()] + [v.format for v in b.versions],
                preferred_format=b.preferred_format,
            ))
    
    return result


# Authors list - must be before /{book_id} route
@router.get("/users-with-books", response_model=List[AuthorOut])
def list_authors(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    authors = db.query(User).join(Book).filter(Book.is_public == True).distinct().all()
    result = []
    for a in authors:
        books = db.query(Book).filter(Book.owner_id == a.id, Book.is_public == True).all()
        book_ids = [b.id for b in books]
        book_count = len(books)
        total_views = sum(b.view_count or 0 for b in books)
        total_comments = sum(db.query(Comment).filter(Comment.book_id == b.id).count() for b in books)
        total_likes = db.query(Like).filter(Like.book_id.in_(book_ids)).count() if book_ids else 0
        subscriber_count = db.query(Subscription).filter(Subscription.author_id == a.id).count()
        is_subscribed = False
        if user:
            sub = db.query(Subscription).filter(Subscription.subscriber_id == user.id, Subscription.author_id == a.id).first()
            is_subscribed = bool(sub)
        result.append(AuthorOut(
            id=a.id,
            username=a.username,
            book_count=book_count,
            is_subscribed=is_subscribed,
            subscriber_count=subscriber_count,
            total_views=total_views,
            total_comments=total_comments,
            total_likes=total_likes,
            avatar_url=a.avatar_url,
        ))
    return result


@router.get("/author/{user_id}")
def get_author(
    user_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    author = db.query(User).filter(User.id == user_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    books = db.query(Book).filter(Book.owner_id == user_id, Book.is_public == True).all()
    series_list = db.query(Series).filter(Series.owner_id == user_id).all()
    subscriber_count = db.query(Subscription).filter(Subscription.author_id == user_id).count()
    is_subscribed = False
    if user:
        sub = db.query(Subscription).filter(Subscription.subscriber_id == user.id, Subscription.author_id == user_id).first()
        is_subscribed = bool(sub)
    return {
        "id": author.id,
        "username": author.username,
        "avatar_url": author.avatar_url,
        "book_count": len(books),
        "series_count": len(series_list),
        "subscriber_count": subscriber_count,
        "is_subscribed": is_subscribed,
        "books": [{"id": b.id, "title": b.title, "cover_image": b.cover_image, "genres": b.genres, "view_count": b.view_count, "like_count": db.query(Like).filter(Like.book_id == b.id).count()} for b in books],
        "series": [{"id": s.id, "name": s.name, "cover_image": s.cover_image, "book_count": len(s.books)} for s in series_list],
    }


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
    like_count = db.query(Like).filter(Like.book_id == book.id).count()
    is_liked = False
    if user:
        like = db.query(Like).filter(Like.user_id == user.id, Like.book_id == book.id).first()
        is_liked = bool(like)
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
        like_count=like_count,
        is_liked=is_liked,
        view_count=book.view_count or 0,
        owner_avatar=owner.avatar_url if owner else None,
        formats=[book.filename.split('.')[-1].lower()] + [v.format for v in book.versions],
        preferred_format=book.preferred_format,
    )


@router.post("/{book_id}/view")
def increment_view_count(
    book_id: int,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.is_public:
        raise HTTPException(status_code=403, detail="Book is not public")
    book.view_count = (book.view_count or 0) + 1
    db.commit()
    return {"view_count": book.view_count}


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
    
    text = book.text_content or ""
    return {"text": text, "title": book.title}


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
    
    # Check preferred_format and use version if set
    text_content = book.text_content
    file_path = book.file_path
    
    if book.preferred_format:
        from database import BookVersion
        version = db.query(BookVersion).filter(
            BookVersion.book_id == book_id,
            BookVersion.format == book.preferred_format
        ).first()
        if version:
            file_path = version.file_path
            # Parse version file on-the-fly if needed
            if version.format == 'fb2':
                from vb_parser import parse_fb2
                try:
                    data = parse_fb2(file_path)
                    try:
                        from vb_parser import get_book_images
                        images = get_book_images(file_path, book_id)
                        data["images"] = images
                    except: pass
                    return data
                except Exception as e:
                    pass
    
    # Check text_content first - maybe it's JSON
    if text_content:
        try:
            data = json.loads(text_content)
            if isinstance(data, dict) and "chapters" in data:
                try:
                    from vb_parser import get_book_images
                    images = get_book_images(file_path, book_id)
                    data["images"] = images
                except: pass
                return data
        except: pass
    
    # Try .struct.json file on disk
    struct_path = file_path + ".struct.json"
    if os.path.exists(struct_path):
        try:
            with open(struct_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            try:
                from vb_parser import get_book_images
                images = get_book_images(file_path, book_id)
                data["images"] = images
            except: pass
            return data
        except: pass
    
    raise HTTPException(status_code=404, detail="No structured content available")
    
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


@router.put("/{book_id}/title")
def rename_book(
    book_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    new_title = payload.get("title", "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    book.title = new_title
    db.commit()
    return {"id": book.id, "title": book.title}


@router.put("/{book_id}/preferred-format")
def set_preferred_format(
    book_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    formats = [book.filename.split('.')[-1].lower()] + [v.format for v in book.versions]
    new_format = payload.get("format", "").strip().lower()
    
    if new_format and new_format not in formats:
        raise HTTPException(status_code=400, detail=f"Format '{new_format}' is not available for this book")
    
    book.preferred_format = new_format if new_format else None
    db.commit()
    return {"id": book.id, "preferred_format": book.preferred_format}


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
    
    # Delete main file
    if os.path.exists(book.file_path):
        os.remove(book.file_path)
    # Delete struct file if exists
    struct_path = book.file_path + ".struct.json"
    if os.path.exists(struct_path):
        os.remove(struct_path)
    
    # Delete all versions
    from database import BookVersion
    versions = db.query(BookVersion).filter(BookVersion.book_id == book_id).all()
    for version in versions:
        if os.path.exists(version.file_path):
            os.remove(version.file_path)
        db.delete(version)
    
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
        raise HTTPException(status_code=400, detail="Название серии обязательно")
    
    import re
    if re.search(r'[.,;:!?"\'()\[\]{}~`@#$%^&*+=<>]', name):
        raise HTTPException(status_code=400, detail="Название серии не должно содержать спецсимволы (,.;:!?\"'()[]{}~`@#$%^&*+=<>)")
    
    existing = db.query(Series).filter(func.lower(Series.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Серия уже существует")
    
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
        result.append({"id": s.id, "name": s.name, "book_count": book_count, "cover_image": s.cover_image})
    return result


@router.get("/series/public")
def list_public_series(db: Session = Depends(get_db)):
    series_list = db.query(Series).order_by(func.lower(Series.name)).all()
    result = []
    seen_lower = set()
    for s in series_list:
        lower_name = s.name.lower()
        if lower_name in seen_lower:
            continue
        seen_lower.add(lower_name)
        books = s.books
        total_likes = sum(db.query(Like).filter(Like.book_id == b.id).count() for b in books)
        total_comments = sum(db.query(Comment).filter(Comment.book_id == b.id).count() for b in books)
        total_views = sum(b.view_count or 0 for b in books)
        result.append({
            "id": s.id, 
            "name": s.name, 
            "book_count": len(books),
            "cover_image": s.cover_image,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "total_views": total_views,
            "owner_id": s.owner_id,
            "owner_username": s.owner.username if s.owner else "",
            "owner_avatar": s.owner.avatar_url if s.owner else None,
        })
    return result


@router.get("/series/{series_id}")
def get_series(
    series_id: int,
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    
    from database import book_series_association
    books = db.query(Book).join(book_series_association).filter(
        book_series_association.c.series_id == series_id
    ).order_by(book_series_association.c.order_index).all()
    
    return {
        "id": s.id,
        "name": s.name,
        "owner_id": s.owner_id,
        "cover_image": s.cover_image,
        "common_genres": s.common_genres,
        "books": [{"id": b.id, "title": b.title, "cover_image": b.cover_image} for b in books],
    }


@router.put("/series/{series_id}")
def update_series(
    series_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id, Series.owner_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    
    if "name" in payload:
        s.name = payload["name"]
    if "cover_image" in payload:
        s.cover_image = payload["cover_image"]
    if "common_genres" in payload:
        s.common_genres = payload["common_genres"]
        for book in s.books:
            if book.genres:
                existing = set(g.strip() for g in book.genres.split(","))
                new = set(g.strip() for g in payload["common_genres"].split(","))
                combined = ",".join(sorted(existing | new))
                book.genres = combined
            else:
                book.genres = payload["common_genres"]
    
    db.commit()
    return {"id": s.id, "name": s.name, "cover_image": s.cover_image, "common_genres": s.common_genres}


@router.post("/series/{series_id}/cover")
async def upload_series_cover(
    series_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id, Series.owner_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    
    content = await file.read()
    ext = get_image_extension(file.filename, content)
    
    if ext == ".gif" and not user.is_plus and not is_animated_image(content):
        ext = ".jpg"
    elif ext == ".gif" and not user.is_plus:
        raise HTTPException(status_code=403, detail="GIF анимация доступна только для Plus пользователей")
    elif ext == ".webp" and is_animated_image(content) and not user.is_plus:
        raise HTTPException(status_code=403, detail="Анимированные изображения доступны только для Plus пользователей")
    
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    series_dir = os.path.join(LIBRALI_DIR, "series")
    os.makedirs(series_dir, exist_ok=True)
    cover_filename = f"series_{series_id}{ext}"
    cover_path = os.path.join(series_dir, cover_filename)
    
    with open(cover_path, "wb") as f:
        f.write(content)
    
    s.cover_image = cover_filename
    db.commit()
    return {"cover_image": s.cover_image}


@router.get("/series/{series_id}/cover")
def get_series_cover(
    series_id: int,
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id).first()
    if not s or not s.cover_image:
        raise HTTPException(status_code=404, detail="No cover")
    series_dir = os.path.join(LIBRALI_DIR, "series")
    cover_path = os.path.join(series_dir, s.cover_image)
    if not os.path.exists(cover_path):
        raise HTTPException(status_code=404, detail="Cover file missing")
    return FileResponse(cover_path)


@router.put("/series/{series_id}/order")
def reorder_series_books(
    series_id: int,
    payload: dict,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    s = db.query(Series).filter(Series.id == series_id, Series.owner_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Series not found")
    
    book_order = payload.get("book_ids", [])
    from sqlalchemy import update
    from database import book_series_association
    
    for idx, book_id in enumerate(book_order):
        stmt = (
            update(book_series_association)
            .where(book_series_association.c.book_id == book_id)
            .where(book_series_association.c.series_id == series_id)
            .values(order_index=idx)
        )
        db.execute(stmt)
    
    db.commit()
    return {"detail": "Order updated"}


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


@router.get("/{book_id}/versions")
def get_book_versions(
    book_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Get all versions/formats of a book."""
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    main_format = os.path.splitext(book.filename)[1].lstrip(".").lower()
    versions = db.query(BookVersion).filter(BookVersion.book_id == book_id).all()
    
    return {
        "versions": [
            {"format": main_format, "filename": book.filename},
            *[{"format": v.format, "filename": v.filename} for v in versions]
        ]
    }


@router.delete("/{book_id}/version/{version_format}")
def delete_book_version(
    book_id: int,
    version_format: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Delete a specific format version of a book."""
    book = db.query(Book).filter(Book.id == book_id, Book.owner_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    main_format = os.path.splitext(book.filename)[1].lstrip(".").lower()
    
    # Cannot delete main format
    if version_format.lower() == main_format.lower():
        raise HTTPException(status_code=400, detail="Cannot delete main format")
    
    version = db.query(BookVersion).filter(
        BookVersion.book_id == book_id,
        BookVersion.format == version_format.lower()
    ).first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Delete file
    if os.path.exists(version.file_path):
        try:
            os.remove(version.file_path)
        except OSError as e:
            print(f"Warning: Could not delete file {version.file_path}: {e}")
    
    db.delete(version)
    db.commit()
    return {"detail": "Version deleted"}


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
    ext = get_image_extension(file.filename, content)
    
    if ext == ".gif" and is_animated_image(content) and not user.is_plus:
        raise HTTPException(status_code=403, detail="GIF анимация доступна только для Plus пользователей")
    elif ext == ".webp" and is_animated_image(content) and not user.is_plus:
        raise HTTPException(status_code=403, detail="Анимированные изображения доступны только для Plus пользователей")
    
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


@router.get("/{book_id}/images")
def get_book_images(
    book_id: int,
    db: Session = Depends(get_db),
):
    """Get list of embedded images in a book."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.file_path or not os.path.exists(book.file_path):
        raise HTTPException(status_code=404, detail="Book file not found")
    
    from vb_parser import get_book_images
    images = get_book_images(book.file_path, book_id)
    return {"images": images}


@router.get("/{book_id}/image/{image_id}")
def get_book_image(
    book_id: int,
    image_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific image from a book."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if not book.file_path or not os.path.exists(book.file_path):
        raise HTTPException(status_code=404, detail="Book file not found")
    
    cache_dir = os.path.join(os.path.dirname(book.file_path), ".images", str(book_id))
    image_path = os.path.join(cache_dir, image_id)
    
    if not os.path.exists(image_path):
        # Extract on demand
        from vb_parser import get_book_images
        get_book_images(book.file_path, book_id)
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Determine content type
    if image_id.lower().endswith(".png"):
        content_type = "image/png"
    elif image_id.lower().endswith(".gif"):
        return FileResponse(image_path, media_type="image/gif")
    elif image_id.lower().endswith(".webp"):
        return FileResponse(image_path, media_type="image/webp")
    else:
        return FileResponse(image_path, media_type="image/jpeg")
    
    return FileResponse(image_path, media_type=content_type)


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
            user_id=c.user_id,
            user_username=c.user.username if c.user else "unknown",
            user_avatar=c.user.avatar_url if c.user else None,
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
        user_id=comment.user_id,
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


# Likes
@router.post("/{book_id}/like")
def like_book(
    book_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    existing = db.query(Like).filter(Like.user_id == user.id, Like.book_id == book_id).first()
    if existing:
        return {"liked": True}
    like = Like(user_id=user.id, book_id=book_id)
    db.add(like)
    db.commit()
    if book.owner_id != user.id:
        notif = Notification(
            user_id=book.owner_id,
            type="like",
            message=f"Пользователь {user.username} оценил вашу книгу «{book.title}»",
            link=f"/book/{book.id}"
        )
        db.add(notif)
        db.commit()
    return {"liked": True}


@router.delete("/{book_id}/like")
def unlike_book(
    book_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    like = db.query(Like).filter(Like.user_id == user.id, Like.book_id == book_id).first()
    if not like:
        return {"liked": False}
    db.delete(like)
    db.commit()
    return {"liked": False}


# Subscriptions
@router.post("/subscribe/{author_id}")
def subscribe_to_author(
    author_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if author_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot subscribe to yourself")
    author = db.query(User).filter(User.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    existing = db.query(Subscription).filter(Subscription.subscriber_id == user.id, Subscription.author_id == author_id).first()
    if existing:
        return {"subscribed": True}
    sub = Subscription(subscriber_id=user.id, author_id=author_id)
    db.add(sub)
    db.commit()
    return {"subscribed": True}


@router.delete("/subscribe/{author_id}")
def unsubscribe_from_author(
    author_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.subscriber_id == user.id, Subscription.author_id == author_id).first()
    if not sub:
        return {"subscribed": False}
    db.delete(sub)
    db.commit()
    return {"subscribed": False}


@router.get("/subscriptions")
def my_subscriptions(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    subs = db.query(Subscription).filter(Subscription.subscriber_id == user.id).all()
    result = []
    for s in subs:
        author = db.query(User).filter(User.id == s.author_id).first()
        book_count = db.query(Book).filter(Book.owner_id == s.author_id, Book.is_public == True).count()
        result.append({
            "author_id": s.author_id,
            "author_username": author.username if author else "unknown",
            "book_count": book_count,
        })
    return result


# Notifications
@router.get("/notifications", response_model=List[NotificationOut])
def get_notifications(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    notifs = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()
    return [NotificationOut(
        id=n.id,
        type=n.type,
        message=n.message,
        link=n.link,
        is_read=n.is_read,
        created_at=n.created_at,
    ) for n in notifs]


@router.get("/notifications/unread-count")
def unread_count(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).count()
    return {"count": count}


@router.post("/notifications/{notif_id}/read")
def mark_read(
    notif_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"read": True}


@router.post("/notifications/read-all")
def mark_all_read(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"read": True}


# End of routes


# User avatar
@router.post("/user/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    ext = get_image_extension(file.filename, content)
    
    if ext == ".gif" and is_animated_image(content) and not user.is_plus:
        raise HTTPException(status_code=403, detail="GIF анимация доступна только для Plus пользователей")
    elif ext == ".webp" and is_animated_image(content) and not user.is_plus:
        raise HTTPException(status_code=403, detail="Анимированные изображения доступны только для Plus пользователей")
    
    avatar_dir = AVATAR_DIR
    
    avatar_path = os.path.join(avatar_dir, avatar_filename)
    if user.avatar_url and os.path.exists(os.path.join(avatar_dir, user.avatar_url)):
        try:
            os.remove(os.path.join(avatar_dir, user.avatar_url))
        except OSError:
            pass
    with open(avatar_path, "wb") as f:
        f.write(content)
    user.avatar_url = avatar_filename
    db.commit()
    return {"avatar_url": user.avatar_url}


@router.get("/user/avatar/{user_id}")
def get_avatar(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.avatar_url:
        raise HTTPException(status_code=404, detail="No avatar")
    avatar_dir = AVATAR_DIR
    avatar_path = os.path.join(avatar_dir, user.avatar_url)
    if not os.path.exists(avatar_path):
        raise HTTPException(status_code=404, detail="Avatar file missing")
    return FileResponse(avatar_path)


@router.get("/admin/users")
def admin_list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        book_count = db.query(Book).filter(Book.owner_id == u.id).count()
        series_count = db.query(Series).filter(Series.owner_id == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_plus": u.is_plus,
            "is_banned": u.is_banned,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "book_count": book_count,
            "series_count": series_count,
            "avatar_url": u.avatar_url,
        })
    return result


@router.get("/admin/books")
def admin_list_books(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
):
    query = db.query(Book)
    if search:
        query = query.filter(Book.title.ilike(f"%{search}%"))
    total = query.count()
    books = query.order_by(Book.id.desc()).offset((page - 1) * limit).limit(limit).all()
    result = []
    for b in books:
        owner = db.query(User).filter(User.id == b.owner_id).first()
        result.append({
            "id": b.id,
            "title": b.title,
            "filename": b.filename,
            "owner_id": b.owner_id,
            "owner_username": owner.username if owner else "Unknown",
            "is_public": b.is_public,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "cover_image": b.cover_image,
            "genres": b.genres,
            "view_count": b.view_count or 0,
            "like_count": db.query(Like).filter(Like.book_id == b.id).count(),
            "comment_count": db.query(Comment).filter(Comment.book_id == b.id).count(),
        })
    return {"books": result, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/admin/series")
def admin_list_series(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    series_list = db.query(Series).order_by(Series.id.desc()).all()
    result = []
    for s in series_list:
        owner = db.query(User).filter(User.id == s.owner_id).first()
        result.append({
            "id": s.id,
            "name": s.name,
            "owner_id": s.owner_id,
            "owner_username": owner.username if owner else "Unknown",
            "book_count": len(s.books),
            "cover_image": s.cover_image,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return result


@router.delete("/admin/book/{book_id}")
def admin_delete_book(
    book_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.file_path and os.path.exists(book.file_path):
        try:
            os.remove(book.file_path)
        except OSError:
            pass
    if book.cover_image:
        cover_path = os.path.join(COVERS_DIR, book.cover_image)
        if os.path.exists(cover_path):
            try:
                os.remove(cover_path)
            except OSError:
                pass
    db.delete(book)
    db.commit()
    return {"detail": "Book deleted"}


@router.delete("/admin/series/{series_id}")
def admin_delete_series(
    series_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    series = db.query(Series).filter(Series.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if series.cover_image:
        series_dir = SERIES_DIR
        cover_path = os.path.join(series_dir, series.cover_image)
        if os.path.exists(cover_path):
            try:
                os.remove(cover_path)
            except OSError:
                pass
    db.delete(series)
    db.commit()
    return {"detail": "Series deleted"}


@router.put("/admin/user/{user_id}/ban")
def admin_ban_user(
    user_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user.is_plus = payload.get("is_plus", target_user.is_plus)
    target_user.role = payload.get("role", target_user.role)
    target_user.is_banned = payload.get("is_banned", target_user.is_banned)
    db.commit()
    return {"id": target_user.id, "username": target_user.username, "role": target_user.role, "is_plus": target_user.is_plus, "is_banned": target_user.is_banned}


@router.delete("/admin/user/{user_id}")
def admin_delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(target_user)
    db.commit()
    return {"detail": "User deleted"}


@router.put("/admin/book/{book_id}/visibility")
def admin_toggle_book_visibility(
    book_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book.is_public = payload.get("is_public", not book.is_public)
    db.commit()
    return {"id": book.id, "is_public": book.is_public}
