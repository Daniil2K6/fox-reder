'use client';

import { useState } from 'react';
import { apiUploadBook, getUser, setUser } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function ConverterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [user] = useState(getUser());

  const handleConvert = async () => {
    if (!file) {
      setError('Выберите файл');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      // TODO: Подключить реальный конвертер через API
      setResult({
        message: 'Конвертер временно недоступен. Требуется подключение LLM.',
        status: 'pending'
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar activeTab="converter" />
      
      <div style={{ 
        maxWidth: 600, 
        margin: '0 auto', 
        padding: '40px 20px',
      }}>
        <h1 style={{ fontSize: 28, marginBottom: 8, color: 'var(--text-primary)' }}>
          Конвертер книг
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          Конвертируйте книги FB2/EPUB в формат VBLite с голосами персонажей
        </p>

        <div style={{ 
          border: '1px solid var(--border)', 
          borderRadius: 12, 
          padding: 24,
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Выберите файл книги (FB2, EPUB)
            </label>
            <input
              type="file"
              accept=".fb2,.epub"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Название книги
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Автоматически из книги"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <div style={{ 
              padding: 12, 
              borderRadius: 8, 
              background: 'rgba(239,68,68,0.1)', 
              color: '#ef4444',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ 
              padding: 12, 
              borderRadius: 8, 
              background: 'rgba(34,197,94,0.1)', 
              color: '#22c55e',
              marginBottom: 16,
            }}>
              {result.message}
            </div>
          )}

          <button
            onClick={handleConvert}
            disabled={loading || !file}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 8,
              border: 'none',
              background: loading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Конвертация...' : 'Конвертировать'}
          </button>
        </div>

        <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Как это работает:</h3>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Загрузите книгу FB2 или EPUB</li>
            <li>LLM проанализирует текст и определит персонажей</li>
            <li>Система создаст VBLite с голосами для каждого персонажа</li>
            <li>Книга будет озвучена разными голосами</li>
          </ul>
        </div>
      </div>
    </div>
  );
}