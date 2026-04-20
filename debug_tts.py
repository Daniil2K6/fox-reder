#!/usr/bin/env python3
import json
import sys
import os

os.chdir("backend")
sys.path.insert(0, ".")

from main import app
from database import init_db, SessionLocal
from passlib.context import CryptContext
from vb_parser import parse_vb
import asyncio

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

init_db()
db = SessionLocal()

from database import User
admin = db.query(User).filter(User.username == "admin").first()
if not admin:
    print("No admin")
    sys.exit(1)

print(f"Admin: {admin.username} id={admin.id}")

# Get structured data
from books import get_book_structured
try:
    data = get_book_structured(8, admin, db)
    para = data["chapters"][0]["paragraphs"][0]
    print(f"\nParagraph 0:")
    print(f"  text: {repr(para['text'])}")
    print(f"  char: {para.get('character')}")
    
    # Test TTS
    from tts.service import TTSService
    tts = TTSService()
    
    async def test():
        text = para["text"]
        char = para.get("character")
        char_name = char.get("name") if char else None
        char_gender = char.get("gender") if char else None
        print(f"\nCalling synthesize:")
        print(f"  text={repr(text)}")
        print(f"  char_name={char_name}")
        print(f"  char_gender={char_gender}")
        
        audio = await tts.synthesize(text, "ru", char_name, char_gender)
        print(f"  audio size: {len(audio)} bytes")
    
    asyncio.run(test())
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()