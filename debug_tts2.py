#!/usr/bin/env python3
import json
import sys
import os

os.chdir("backend")
sys.path.insert(0, ".")

from database import init_db, SessionLocal
from passlib.context import CryptContext
from vb_parser import parse_vb

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

init_db()
db = SessionLocal()

from database import User
admin = db.query(User).filter(User.username == "admin").first()
if not admin:
    print("No admin")
    sys.exit(1)

# Load structured data
book_id = 8
from books import get_book_structured
data = get_book_structured(book_id, admin, db)
para = data["chapters"][0]["paragraphs"][0]

text_sent = para["text"]
char_sent = para.get("character", {})
char_name = char_sent.get("name") if char_sent else None
char_gender = char_sent.get("gender") if char_sent else None

print(f"Sending to TTS API:")
print(f"  text: {repr(text_sent)}")
print(f"  character: {repr(char_name)}")
print(f"  character_gender: {repr(char_gender)}")

# Now simulate what frontend sends in JSON body
body = {
    "text": text_sent,
    "language": "ru",
    "character": char_name,
    "character_gender": char_gender
}

print(f"\nJSON body sent:")
print(json.dumps(body, ensure_ascii=False, indent=2))

# Read the file again and see if there's any difference
with open('uploads/358b2481bc9e7182_test.vblite.struct.json') as f:
    struct_data = json.load(f)
para2 = struct_data["chapters"][0]["paragraphs"][0]
    
print(f"\nFile para:")
print(f"  text: {repr(para2['text'])}")
print(f"  char: {para2.get('character')}")

# Are they the same?
print(f"\nDiff text: {para['text'] != para2['text']}")