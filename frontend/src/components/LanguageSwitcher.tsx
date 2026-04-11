'use client';

import { useLanguage } from '@/lib/i18n';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = [
    { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
    { code: 'en', nativeName: 'English', englishName: 'English' },
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = 'var(--bg-secondary)';
        }}
      >
        🌐 {language.toUpperCase()}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: 180,
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code as 'ru' | 'en');
                setIsOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: language === lang.code ? 'var(--accent-light)' : 'transparent',
                color: language === lang.code ? 'var(--accent)' : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: language === lang.code ? 600 : 400,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (language !== lang.code) {
                  (e.target as HTMLElement).style.background = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (language !== lang.code) {
                  (e.target as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <div style={{ fontWeight: 600 }}>{lang.nativeName}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{lang.englishName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
