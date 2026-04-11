import logging
import os
from typing import Optional
from sqlalchemy.orm import Session
from database import Translation, BookMetadataTranslation

logger = logging.getLogger("fox-reader")

GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", None)

try:
    from google.cloud import translate_v2
    HAS_GOOGLE_TRANSLATE = True
except ImportError:
    HAS_GOOGLE_TRANSLATE = False
    logger.warning("google-cloud-translate not installed. Using fallback translation.")

try:
    from transformers import pipeline
    HAS_LOCAL_TRANSLATOR = True
except ImportError:
    HAS_LOCAL_TRANSLATOR = False
    logger.info("transformers not installed. Local translator unavailable.")


class TranslationService:
    def __init__(self):
        self.google_client = None
        self.local_translator = None
        self._init_translators()

    def _init_translators(self):
        """Initialize translation backends"""
        # Google Translate
        if HAS_GOOGLE_TRANSLATE and GOOGLE_TRANSLATE_API_KEY:
            try:
                self.google_client = translate_v2.Client(api_key=GOOGLE_TRANSLATE_API_KEY)
                logger.info("Google Translate API initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Google Translate: {e}")

        # Local translator (optional, for high-quality translations on powerful servers)
        if HAS_LOCAL_TRANSLATOR and os.getenv("USE_LOCAL_TRANSLATOR", "false").lower() == "true":
            try:
                # Use a small model for translations (M2M100 for multilingual)
                self.local_translator = pipeline(
                    "translation",
                    model="facebook/m2m100_418M",
                    device=0 if os.getenv("USE_GPU", "false").lower() == "true" else -1
                )
                logger.info("Local translator (M2M100) initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize local translator: {e}")

    def _google_translate(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Translate using Google Translate API"""
        if not self.google_client:
            return None

        try:
            result = self.google_client.translate_text(
                text,
                source_language=source_lang,
                target_language=target_lang
            )
            return result.get("translatedText")
        except Exception as e:
            logger.error(f"Google Translate error: {e}")
            return None

    def _local_translate(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Translate using local model"""
        if not self.local_translator:
            return None

        try:
            # M2M100 uses language codes like "ru_RU", "en_XX", etc.
            result = self.local_translator(text, src_lang=f"{source_lang}_XX", tgt_lang=f"{target_lang}_XX")
            return result[0]["translation_text"]
        except Exception as e:
            logger.error(f"Local translation error: {e}")
            return None

    async def translate_paragraph(
        self,
        db: Session,
        book_id: int,
        paragraph_id: str,
        original_text: str,
        source_lang: str,
        target_lang: str,
        force_refresh: bool = False
    ) -> str:
        """
        Translate a paragraph with caching and fallback strategy.
        1. Check cache in DB
        2. Try local translator (if available)
        3. Fall back to Google Translate
        4. Store in cache
        """
        # Check cache first
        if not force_refresh:
            cached = db.query(Translation).filter(
                Translation.book_id == book_id,
                Translation.paragraph_id == paragraph_id,
                Translation.target_language == target_lang
            ).first()
            if cached:
                return cached.translated_text

        translated_text = None
        translator_used = "unknown"

        # Try local translator first (if available)
        if self.local_translator:
            try:
                translated_text = self._local_translate(original_text, source_lang, target_lang)
                if translated_text:
                    translator_used = "local"
                    quality_score = 95
            except Exception as e:
                logger.warning(f"Local translator failed: {e}")

        # Fall back to Google Translate
        if not translated_text and self.google_client:
            try:
                translated_text = self._google_translate(original_text, source_lang, target_lang)
                if translated_text:
                    translator_used = "google"
                    quality_score = 85
            except Exception as e:
                logger.warning(f"Google Translate failed: {e}")

        # Last resort: return original text
        if not translated_text:
            translated_text = original_text
            translator_used = "fallback"
            quality_score = 50

        # Store in cache
        try:
            translation = Translation(
                book_id=book_id,
                paragraph_id=paragraph_id,
                original_text=original_text,
                source_language=source_lang,
                target_language=target_lang,
                translated_text=translated_text,
                translator=translator_used,
                quality_score=quality_score
            )
            db.merge(translation)  # Use merge to handle duplicates
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cache translation: {e}")
            db.rollback()

        return translated_text

    async def translate_metadata(
        self,
        db: Session,
        book_id: int,
        title: Optional[str],
        description: Optional[str],
        genres: Optional[str],
        source_lang: str,
        target_lang: str,
        force_refresh: bool = False
    ) -> dict:
        """
        Translate book metadata (title, description, genres).
        """
        # Check cache first
        if not force_refresh:
            cached = db.query(BookMetadataTranslation).filter(
                BookMetadataTranslation.book_id == book_id,
                BookMetadataTranslation.language == target_lang
            ).first()
            if cached:
                return {
                    "title": cached.title,
                    "description": cached.description,
                    "genres": cached.genres
                }

        translated_metadata = {}
        translator_used = "unknown"

        # Translate title
        if title:
            translated_title = await self.translate_paragraph(
                db, book_id, f"metadata-title", title, source_lang, target_lang
            )
            translated_metadata["title"] = translated_title
        else:
            translated_metadata["title"] = None

        # Translate description
        if description:
            translated_description = await self.translate_paragraph(
                db, book_id, f"metadata-description", description, source_lang, target_lang
            )
            translated_metadata["description"] = translated_description
        else:
            translated_metadata["description"] = None

        # Translate genres
        if genres:
            translated_genres = await self.translate_paragraph(
                db, book_id, f"metadata-genres", genres, source_lang, target_lang
            )
            translated_metadata["genres"] = translated_genres
        else:
            translated_metadata["genres"] = None

        # Store metadata translation in cache
        try:
            metadata_translation = BookMetadataTranslation(
                book_id=book_id,
                language=target_lang,
                title=translated_metadata.get("title"),
                description=translated_metadata.get("description"),
                genres=translated_metadata.get("genres"),
                translator=translator_used
            )
            db.merge(metadata_translation)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cache metadata translation: {e}")
            db.rollback()

        return translated_metadata


# Global singleton instance
_translation_service = None


def get_translation_service() -> TranslationService:
    global _translation_service
    if _translation_service is None:
        _translation_service = TranslationService()
    return _translation_service
