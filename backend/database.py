import logging
import os
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint, create_engine, text, Table, Float
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fox_reader.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

book_series_association = Table(
    'book_series',
    Base.metadata,
    Column('book_id', Integer, ForeignKey('books.id', ondelete='CASCADE'), primary_key=True),
    Column('series_id', Integer, ForeignKey('series.id', ondelete='CASCADE'), primary_key=True),
    Column('order_index', Integer, default=0)
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(16), default="user", nullable=False)
    is_plus = Column(Boolean, default=False, nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    preferred_voice = Column(String(32), default="female", nullable=True)
    preferred_language = Column(String(32), default="ru", nullable=True)
    voice_pitch = Column(Float, default=2.0, nullable=True)
    voice_rate = Column(Float, default=0.0, nullable=True)
    voice_volume = Column(Float, default=0.0, nullable=True)
    avatar_url = Column(String(512), nullable=True)

    books = relationship("Book", back_populates="owner")
    series = relationship("Series", back_populates="owner")
    comments = relationship("Comment", back_populates="user")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", foreign_keys="Subscription.subscriber_id", back_populates="subscriber", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Series(Base):
    __tablename__ = "series"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    cover_image = Column(String(512), nullable=True)
    common_genres = Column(String(512), nullable=True)

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
     view_count = Column(Integer, default=0)
     group_id = Column(String(64), nullable=True)  # Group ID for multi-format books
     preferred_format = Column(String(16), nullable=True)  # Default format for download

     owner = relationship("User", back_populates="books")
     series_list = relationship("Series", secondary=book_series_association, back_populates="books")
     comments = relationship("Comment", back_populates="book", cascade="all, delete-orphan")
     likes = relationship("Like", back_populates="book", cascade="all, delete-orphan")

     __table_args__ = (
         UniqueConstraint("owner_id", "sha256", name="uq_owner_sha256"),
     )


class BookVersion(Base):
    __tablename__ = "book_versions"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    format = Column(String(16), nullable=False)  # fb2, epub, txt, vb, vblite
    file_path = Column(String(1024), nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    filename = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    book = relationship("Book", backref="versions")


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="likes")
    book = relationship("Book", back_populates="likes")

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_user_book_like"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscriber_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subscriber = relationship("User", foreign_keys=[subscriber_id], back_populates="subscriptions")
    author = relationship("User", foreign_keys=[author_id])

    __table_args__ = (
        UniqueConstraint("subscriber_id", "author_id", name="uq_subscriber_author"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(32), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(256), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


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
        "ALTER TABLE books ADD COLUMN view_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_sha256 ON books(owner_id, sha256)",
        "ALTER TABLE series ADD COLUMN cover_image VARCHAR(512)",
        "ALTER TABLE series ADD COLUMN common_genres VARCHAR(512)",
        "ALTER TABLE book_series ADD COLUMN order_index INTEGER DEFAULT 0",
        # FTS for multilingual search
        "CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(title, description, genres, original_language, content=books, content_rowid=id)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                # Log migration issues, but only fail if it's not "already exists" type error
                error_msg = str(e).lower()
                if any(phrase in error_msg for phrase in ["already exists", "duplicate", "unique constraint"]):
                    # These are expected for idempotent migrations
                    logger.debug(f"Migration already applied: {sql[:80]}...")
                else:
                    # Unexpected error - log and fail startup
                    logger.error(f"MIGRATION ERROR: {sql}")
                    logger.error(f"Error details: {e}")
                    raise RuntimeError(f"Database migration failed: {e}") from e
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
