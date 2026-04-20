#!/usr/bin/env python3
import json
import sys
import os

os.chdir("backend")
sys.path.insert(0, ".")

from database import init_db, SessionLocal
from vb_parser import parse_vb

init_db()
db = SessionLocal()

from books import get_book_structured
from database import User

admin = db.query(User).filter(User.username == "admin").first()
book_id = 8
data = get_book_structured(book_id, admin, db)

# Simulate what frontend does
chapters = data.get("chapters", [])
for ch in chapters:
    for p in ch.get("paragraphs", []):
        char = p.get("character")
        # Frontend extraction (JS logic in Python)
        if isinstance(char, str):
            charName = char
            charGender = None
        elif isinstance(char, dict):
            charName = char.get("name")
            charGender = char.get("gender")
        else:
            charName = None
            charGender = None
        print(f"Original: {char}")
        print(f"Extracted - name: {charName}, gender: {charGender}")
        print()
        break
    break