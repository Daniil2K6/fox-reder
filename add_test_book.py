#!/usr/bin/env python3
import os
import sys
import hashlib
import json
import shutil

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
sys.path.insert(0, ".")

from database import get_db, init_db, User, Book
from vb_parser import parse_vb

init_db()

VBLITE_FILE = "../test_book/test_4_chars.vblite"
OUTPUT_DIR = "uploads"
COVER_DIR = "covers"

def add_test_book():
    db = next(get_db())
    
    admin = db.query(User).filter(User.username == "admin", User.role == "admin").first()
    if not admin:
        print("Admin user not found! Run backend first.")
        return
    
    if not os.path.exists(VBLITE_FILE):
        print(f"File not found: {VBLITE_FILE}")
        return
    
    with open(VBLITE_FILE, "rb") as f:
        content = f.read()
    
    sha256 = hashlib.sha256(content).hexdigest()
    
    duplicate = db.query(Book).filter(Book.sha256 == sha256).first()
    if duplicate:
        print(f"Book already exists: {duplicate.title}")
        return
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(COVER_DIR, exist_ok=True)
    
    safe_name = f"{sha256[:16]}_test.vblite"
    file_path = os.path.join(OUTPUT_DIR, safe_name)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    parsed = parse_vb(VBLITE_FILE)
    
    book = Book(
        title=parsed.get("title", "Тестовая книга"),
        filename=safe_name,
        sha256=sha256,
        file_path=file_path,
        owner_id=admin.id,
        is_public=True,
        genres="Test",
        description="Тестовая книга с 4 персонажами",
        original_language="ru"
    )
    
    db.add(book)
    db.commit()
    db.refresh(book)
    
    parsed = parse_vb(VBLITE_FILE)
    struct_path = file_path + ".struct.json"
    with open(struct_path, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=2)
    
    print(f"Added book: {book.title} (ID: {book.id})")
    print(f"Created structure: {struct_path}")

if __name__ == "__main__":
    add_test_book()