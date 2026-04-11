'use client';

import { useState, useCallback, useRef } from 'react';
import { apiTranslateParagraph } from './api';

interface PendingTranslation {
  bookId: number;
  paragraphId: string;
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export function useTranslationBatcher() {
  const [loadingCount, setLoadingCount] = useState(0);
  const batchQueue = useRef<PendingTranslation[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(async () => {
    if (batchQueue.current.length === 0) return;

    const batch = batchQueue.current.splice(0, 10); // Process 10 at a time
    setLoadingCount((prev) => prev + batch.length);

    try {
      await Promise.all(
        batch.map((item) =>
          apiTranslateParagraph(
            item.bookId,
            item.paragraphId,
            item.originalText,
            item.sourceLanguage,
            item.targetLanguage
          ).catch((err) => {
            console.warn(`Translation failed for ${item.paragraphId}:`, err);
          })
        )
      );
    } finally {
      setLoadingCount((prev) => Math.max(0, prev - batch.length));

      // Process next batch if any
      if (batchQueue.current.length > 0) {
        batchTimerRef.current = setTimeout(processBatch, 100);
      }
    }
  }, []);

  const queueTranslation = useCallback(
    (translation: PendingTranslation) => {
      // Check if already queued
      const exists = batchQueue.current.some(
        (t) => t.bookId === translation.bookId && t.paragraphId === translation.paragraphId
      );

      if (!exists) {
        batchQueue.current.push(translation);
      }

      // Clear existing timer and set new one
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processBatch, 200);
    },
    [processBatch]
  );

  return {
    queueTranslation,
    loadingCount,
    isLoading: loadingCount > 0,
  };
}
