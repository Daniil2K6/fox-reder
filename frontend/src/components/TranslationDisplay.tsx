'use client';

import React, { useState, useEffect } from 'react';
import { useTranslationCache } from '@/lib/useTranslation';
import { useLanguage } from '@/lib/i18n';

interface TranslationDisplayProps {
  paragraphId: string;
  originalText: string;
  bookId: number;
  sourceLanguage: string;
  targetLanguage?: string;
  showTranslation?: boolean;
  onTranslationStateChange?: (isLoading: boolean) => void;
}

export function TranslationDisplay({
  paragraphId,
  originalText,
  bookId,
  sourceLanguage,
  targetLanguage,
  showTranslation = false,
  onTranslationStateChange,
}: TranslationDisplayProps) {
  const { translateParagraph, getTranslation } = useTranslationCache();
  const [displayText, setDisplayText] = useState(originalText);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(showTranslation);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const { language: uiLanguage } = useLanguage();

  const effectiveTargetLanguage = targetLanguage || uiLanguage;

  // Load translation when component mounts or when targetLanguage changes
  useEffect(() => {
    if (!showTranslation) return;

    const cached = getTranslation(bookId, paragraphId, effectiveTargetLanguage);
    if (cached) {
      setTranslatedText(cached);
      setDisplayText(cached);
    } else {
      // Trigger translation load
      setIsLoading(true);
      onTranslationStateChange?.(true);

      translateParagraph(
        bookId,
        paragraphId,
        originalText,
        sourceLanguage,
        effectiveTargetLanguage
      )
        .then((translated) => {
          setTranslatedText(translated);
          setDisplayText(translated);
        })
        .catch(() => {
          setDisplayText(originalText);
        })
        .finally(() => {
          setIsLoading(false);
          onTranslationStateChange?.(false);
        });
    }
  }, [showTranslation, effectiveTargetLanguage, bookId, paragraphId]);

  const toggleTranslation = async () => {
    if (isTranslating) {
      // Switch to original
      setDisplayText(originalText);
      setIsTranslating(false);
    } else {
      // Switch to translation
      setIsTranslating(true);

      if (!translatedText) {
        setIsLoading(true);
        onTranslationStateChange?.(true);

        try {
          const translated = await translateParagraph(
            bookId,
            paragraphId,
            originalText,
            sourceLanguage,
            effectiveTargetLanguage
          );
          setTranslatedText(translated);
          setDisplayText(translated);
        } catch (error) {
          console.error('Translation error:', error);
          setDisplayText(originalText);
          setIsTranslating(false);
        } finally {
          setIsLoading(false);
          onTranslationStateChange?.(false);
        }
      } else {
        setDisplayText(translatedText);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      <div
        style={{
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          fontSize: 'inherit',
          opacity: isLoading ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {displayText}
      </div>

      {translatedText !== null && (
        <button
          onClick={toggleTranslation}
          disabled={isLoading}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: isTranslating ? 'var(--accent-light)' : 'transparent',
            color: isTranslating ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 500,
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
        >
          {isLoading ? '⟳ ' : isTranslating ? '✓ ' : '○ '}
          {isTranslating ? 'Перевод' : 'Оригинал'}
        </button>
      )}

      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      )}
    </div>
  );
}

// Добавляем CSS анимацию если её нет
if (typeof window !== 'undefined' && !document.getElementById('translation-display-styles')) {
  const style = document.createElement('style');
  style.id = 'translation-display-styles';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
