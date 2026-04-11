'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiTranslateParagraph, apiTranslateMetadata } from './api';

type TranslationCache = Record<string, string>;

export function useTranslationCache() {
  const [cache, setCache] = useState<TranslationCache>({});
  const cacheRef = useRef<TranslationCache>({});

  // Initialize cache from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fox_translation_cache');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCache(parsed);
          cacheRef.current = parsed;
        } catch (e) {
          console.warn('Failed to load translation cache from localStorage');
        }
      }
    }
  }, []);

  const getCacheKey = (bookId: number, paragraphId: string, targetLanguage: string): string => {
    return `${bookId}:${paragraphId}:${targetLanguage}`;
  };

  const saveToLocalStorage = useCallback((newCache: TranslationCache) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('fox_translation_cache', JSON.stringify(newCache));
      } catch (e) {
        console.warn('Failed to save translation cache to localStorage');
      }
    }
  }, []);

  const getTranslation = useCallback(
    (bookId: number, paragraphId: string, targetLanguage: string): string | undefined => {
      const key = getCacheKey(bookId, paragraphId, targetLanguage);
      return cacheRef.current[key] as string | undefined;
    },
    []
  );

  const translateParagraph = useCallback(
    async (
      bookId: number,
      paragraphId: string,
      originalText: string,
      sourceLanguage: string,
      targetLanguage: string,
      forceRefresh: boolean = false
    ): Promise<string> => {
      const cacheKey = getCacheKey(bookId, paragraphId, targetLanguage);

      // Check cache first
      if (!forceRefresh && cacheRef.current[cacheKey]) {
        return cacheRef.current[cacheKey];
      }

      try {
        const result = await apiTranslateParagraph(
          bookId,
          paragraphId,
          originalText,
          sourceLanguage,
          targetLanguage,
          forceRefresh
        );

        const translatedText = result.translated_text;

        // Update cache
        const newCache = {
          ...cacheRef.current,
          [cacheKey]: translatedText,
        };
        cacheRef.current = newCache;
        setCache(newCache);
        saveToLocalStorage(newCache);

        return translatedText;
      } catch (error) {
        console.error('Translation failed:', error);
        // Fallback to original text
        return originalText;
      }
    },
    [saveToLocalStorage]
  );

  const clearCache = useCallback(() => {
    cacheRef.current = {};
    setCache({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fox_translation_cache');
    }
  }, []);

  return {
    cache,
    getTranslation,
    translateParagraph,
    clearCache,
  };
}

export function useIntersectionObserver(callback: () => void, options?: IntersectionObserverInit) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback();
      }
    }, options);

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [callback, options]);

  return elementRef;
}
