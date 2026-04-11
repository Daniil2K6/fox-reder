import os
import hashlib
from pathlib import Path
from database import get_db, Book, User, Comment, init_db
from passlib.context import CryptContext

# Initialize database
init_db()

# Uploads directory
UPLOADS_DIR = Path("uploads")
COVERS_DIR = Path("covers")

def calculate_sha256(file_path):
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()

def get_fb2_metadata(file_path):
    """Extract basic metadata from FB2 file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Simple extraction of title and description from FB2
        title = "Unknown Title"
        description = "No description available"
        genres = "Fiction"
        
        # Look for title in <book-title> tags
        import re
        title_match = re.search(r'<book-title[^>]*>(.*?)</book-title>', content, re.IGNORECASE | re.DOTALL)
        if title_match:
            title = title_match.group(1).strip()
            
        # Look for description in <description> tags
        desc_match = re.search(r'<description[^>]*>(.*?)</description>', content, re.IGNORECASE | re.DOTALL)
        if desc_match:
            desc_text = desc_match.group(1).strip()
            # Extract actual description (not annotation)
            actual_desc = re.search(r'<title[^>]*>Описание</title>\s*(<p[^>]*>.*?</p>)', desc_text, re.IGNORECASE | re.DOTALL)
            if actual_desc:
                description = actual_desc.group(1).strip()
            else:
                # Use first few characters of description as fallback
                description = desc_text[:200] + "..." if len(desc_text) > 200 else desc_text
        
        # Look for genres
        genres_match = re.search(r'<genre[^>]*>(.*?)</genre>', content, re.IGNORECASE | re.DOTALL)
        if genres_match:
            genres = genres_match.group(1).strip()
            
        return title, description, genres
    except Exception as e:
        print(f"Error extracting metadata from {file_path}: {e}")
        return "Unknown Title", "No description available", "Fiction"

def seed_books():
    """Seed the database with test books."""
    db = next(get_db())
    
    try:
        # Get or create admin user
        admin = db.query(User).filter(User.username == 'admin').first()
        if not admin:
            pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
            admin = User(
                username='admin',
                hashed_password=pwd_context.hash('password'),
                role='admin'
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        
        print(f"Using user: {admin.username}")
        
        # Find all FB2 files in uploads directory
        fb2_files = []
        for book_dir in UPLOADS_DIR.iterdir():
            if book_dir.is_dir():
                for file in book_dir.glob("*.fb2"):
                    fb2_files.append(file)
        
        print(f"Found {len(fb2_files)} FB2 files")
        
        # Add books to database
        added_count = 0
        books_to_add = []
        
        # First pass: collect books and check for duplicates
        for fb2_file in fb2_files:
            # Extract book ID from directory name
            book_id = fb2_file.parent.name
            
            # Calculate SHA256
            sha256 = calculate_sha256(fb2_file)
            
            # Get metadata
            title, description, genres = get_fb2_metadata(fb2_file)
            
            # Create book record
            book = Book(
                title=title,
                filename=fb2_file.name,
                sha256=sha256,
                file_path=str(fb2_file),
                owner_id=admin.id,
                is_public=True,
                cover_image=f"/covers/{book_id}/cover.jpg" if (COVERS_DIR / book_id / "cover.jpg").exists() else None,
                genres=genres,
                description=description
            )
            
            books_to_add.append((book, fb2_file.name))
        
        # Second pass: add books, checking for duplicates
        added_books = set()
        for book, filename in books_to_add:
            if book.sha256 in added_books:
                print(f"Book {filename} already added (duplicate), skipping")
                continue
            
            db.add(book)
            added_books.add(book.sha256)
            added_count += 1
            print(f"Added book: {book.title}")
        
        try:
            db.commit()
            print(f"Successfully seeded {added_count} books to database")
        except Exception as e:
            db.rollback()
            print(f"Commit failed: {e}")
        
        # Create sample series
        try:
            from database import Series
            series1 = db.query(Series).filter(Series.name == "Покоривший СТЕНУ", Series.owner_id == admin.id).first()
            if not series1:
                series1 = Series(name="Покоривший СТЕНУ", owner_id=admin.id)
                db.add(series1)
                db.commit()
                db.refresh(series1)
                print(f"Created series: {series1.name}")
                
                # Assign books to series
                books = db.query(Book).all()
                for book in books:
                    if "Покоривший" in book.title or "СТЕНУ" in book.title:
                        book.series_list.append(series1)
                db.commit()
                print(f"Assigned {len([b for b in books if 'Покоривший' in b.title or 'СТЕНУ' in b.title])} books to series")
        except Exception as e:
            db.rollback()
            print(f"Series creation failed: {e}")
        
        # Add some sample comments
        books = db.query(Book).all()
        if books:
            # Comment for first book
            if len(books) > 0:
                comment1 = Comment(
                    book_id=books[0].id,
                    user_id=admin.id,
                    content="Отличная книга! Очень интересный сюжет."
                )
                db.add(comment1)
                
            # Comment for second book
            if len(books) > 1:
                comment2 = Comment(
                    book_id=books[1].id,
                    user_id=admin.id,
                    content="Хорошее продолжение, жду следующую часть."
                )
                db.add(comment2)
            
            db.commit()
            print("Added sample comments")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding books: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_books()