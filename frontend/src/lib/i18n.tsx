'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import ruCommon from '@/locales/ru/common.json';
import enCommon from '@/locales/en/common.json';

type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, defaultValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, any> = {
  ru: ruCommon,
  en: enCommon,
};

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, prop) => current?.[prop], obj) || '';
}

function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || navigator.languages?.[0] || 'en';
  return lang.startsWith('ru') ? 'ru' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Проверяем localStorage при загрузке
    const savedLanguage = localStorage.getItem('preferred_language') as Language | null;
    if (savedLanguage && (savedLanguage === 'ru' || savedLanguage === 'en')) {
      setLanguageState(savedLanguage);
    } else {
      // Определяем язык браузера
      const browserLang = detectBrowserLanguage();
      setLanguageState(browserLang);
      localStorage.setItem('preferred_language', browserLang);
    }
    setIsHydrated(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
    // Отправляем на сервер для сохранения в профиле (если пользователь авторизован)
    if (localStorage.getItem('token')) {
      fetch('/api/auth/update-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {}); // Игнорируем ошибки сохранения
    }
  };

  const t = (key: string, defaultValue: string = key): string => {
    const value = getNestedValue(translations[language], key);
    return value || defaultValue;
  };

  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
