import os
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint, create_engine, text, Table
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fox_reader.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

book_series_association = Table(
    'book_series',
    Base.metadata,
    Column('book_id', Integer, ForeignKey('books.id', ondelete='CASCADE'), primary_key=True),
    Column('series_id', Integer, ForeignKey('series.id', ondelete='CASCADE'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(16), default="user", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    preferred_voice = Column(String(32), default="ru", nullable=True)
    preferred_language = Column(String(32), default="ru", nullable=True)

    books = relationship("Book", back_populates="owner")
    series = relationship("Series", back_populates="owner")
    comments = relationship("Comment", back_populates="user")


class Series(Base):
    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="series")
    books = relationship("Book", secondary=book_series_association, back_populates="series_list")


class Book(Base):
     __tablename__ = "books"

     id = Column(Integer, primary_key=True, index=True)
     title = Column(String(512), nullable=False)
     filename = Column(String(512), nullable=False)
     sha256 = Column(String(64), nullable=False, index=True)
     file_path = Column(String(1024), nullable=False)
     is_public = Column(Boolean, default=False)
     owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
     created_at = Column(DateTime, default=datetime.utcnow)
     text_content = Column(Text, nullable=True)
     cover_image = Column(String(512), nullable=True)
     genres = Column(String(512), nullable=True)
     description = Column(Text, nullable=True)
     original_language = Column(String(16), default="en", nullable=False)  # ISO 639-1 (en, ru, ja, etc.)
     is_translated = Column(Boolean, default=False)  # Флаг: содержит ли переводы

     owner = relationship("User", back_populates="books")
     series_list = relationship("Series", secondary=book_series_association, back_populates="books")
     comments = relationship("Comment", back_populates="book", cascade="all, delete-orphan")

     __table_args__ = (
         UniqueConstraint("owner_id", "sha256", name="uq_owner_sha256"),
     )


class Comment(Base):
     __tablename__ = "comments"

     id = Column(Integer, primary_key=True, index=True)
     book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
     user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
     content = Column(Text, nullable=False)
     created_at = Column(DateTime, default=datetime.utcnow)

     book = relationship("Book", back_populates="comments")
     user = relationship("User", back_populates="comments")


def init_db():
    Base.metadata.create_all(bind=engine)
    # Migrations for existing databases
    migrations = [
        "ALTER TABLE users ADD COLUMN preferred_voice VARCHAR(32) DEFAULT 'ru'",
        "ALTER TABLE users ADD COLUMN preferred_language VARCHAR(32) DEFAULT 'ru'",
        "ALTER TABLE books ADD COLUMN cover_image VARCHAR(512)",
        "ALTER TABLE books ADD COLUMN genres VARCHAR(512)",
        "ALTER TABLE books ADD COLUMN description TEXT",
        "ALTER TABLE books ADD COLUMN original_language VARCHAR(16) DEFAULT 'en'",
        "ALTER TABLE books ADD COLUMN is_translated BOOLEAN DEFAULT 0",
        # FTS for multilingual search
        "CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(title, description, genres, original_language, content=books, content_rowid=id)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
        conn.commit()
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
