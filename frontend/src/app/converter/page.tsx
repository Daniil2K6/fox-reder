'use client';

import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { apiConvertFb2ToVblite, apiUploadBook, getUser } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { convertFb2ToVblite } from '@/lib/fb2converter';

type Mode = 'server' | 'local' | 'neuro';

const MODES: { key: Mode; icon: string; label: string; desc: string }[] = [
  { key: 'server', icon: '⚡', label: 'Сервер', desc: '1 файл, быстро' },
  { key: 'local', icon: '🖥', label: 'Локально', desc: 'До 50 файлов' },
  { key: 'neuro', icon: '🧠', label: 'Нейро', desc: 'Скоро' },
];

export default function ConverterPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('server');
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ name: string; data: any }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [clickedDownload, setClickedDownload] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  useEffect(() => { setUser(getUser()); }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fb2Files = Array.from(newFiles).filter(f => f.name.endsWith('.fb2'));
    if (fb2Files.length === 0) { setError('Только файлы .fb2'); return; }
    const maxFiles = mode === 'server' ? (user?.is_plus ? 20 : 1) : 50;
    if (files.length + fb2Files.length > maxFiles) {
      setError(mode === 'server'
        ? (user?.is_plus ? 'Максимум 20 файлов' : 'У вас нет подписки Plus. Только 1 файл за раз.')
        : 'Максимум 50 файлов за раз');
      return;
    }
    setError('');
    setFiles(prev => [...prev, ...fb2Files]);
  }, [mode, files.length, user?.is_plus]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  };

  const handleConvert = async () => {
    if (files.length === 0) { setError('Выберите файлы'); return; }
    if (mode === 'neuro') return;
    if (mode === 'server' && files.length > (user?.is_plus ? 20 : 1)) {
      setError(user?.is_plus
        ? 'Максимум 20 файлов.'
        : '🔒 Подписка Plus нужна для конвертации нескольких книг на сервере.');
      return;
    }

    setConverting(true);
    setError('');
    setResults([]);
    setUploadResult(null);
    setConvertProgress({ done: 0, total: files.length });

    const newResults: { name: string; data: any }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let data: any;
        if (mode === 'server') {
          data = await apiConvertFb2ToVblite(file);
        } else {
          const result = await convertFb2ToVblite(file);
          data = result.data;
        }
        newResults.push({ name: file.name.replace(/\.[^.]+$/, '') + '.vblite', data });
      } catch (e: any) {
        setError(prev => prev + (prev ? '\n' : '') + `${file.name}: ${e.message}`);
      }
      setConvertProgress({ done: i + 1, total: files.length });
    }

    setResults(newResults);
    if (newResults.length > 0) {
      const totalChars = newResults.reduce((sum, r) => sum + (r.data.characters?.length || 0), 0);
      setNotification(`✅ ${newResults.length} файлов конвертировано, ${totalChars} персонажей`);
      setTimeout(() => setNotification(''), 4000);
    }
    setConverting(false);
    setConvertProgress(null);
  };

  const downloadResult = (name: string, data: any, skipAnim?: boolean) => {
    if (!skipAnim) {
      setClickedDownload(name);
      setTimeout(() => setClickedDownload(prev => prev === name ? null : prev), 300);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    setClickedDownload('__all__');
    setTimeout(() => setClickedDownload(prev => prev === '__all__' ? null : prev), 300);
    const zip = new JSZip();
    for (const r of results) {
      zip.file(r.name, JSON.stringify(r.data, null, 2));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'books.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadToLibrary = async () => {
    if (results.length !== 1 || mode !== 'server') return;
    setUploading(true);
    setUploadResult(null);
    try {
      const r = results[0];
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const vbliteFile = new File([blob], r.name);
      const book = await apiUploadBook(vbliteFile, undefined, r.data.metadata?.title);
      setUploadResult({ id: book.id, title: book.title });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Navbar activeTab="converter" />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, color: 'var(--text-primary)', margin: 0 }}>
            Конвертер книг
          </h1>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--text-muted)',
              background: 'transparent', color: 'var(--text-muted)',
              fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0, flexShrink: 0,
            }}
            title="Как пользоваться"
          >?</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          FB2 → VBLite с голосами персонажей
        </p>

        {/* Help modal */}
        {showHelp && (
          <div onClick={() => setShowHelp(false)} style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              maxWidth: 440, width: '90%', background: 'var(--bg-primary)',
              borderRadius: 16, padding: 28, position: 'relative',
            }}>
              <button onClick={() => setShowHelp(false)} style={{
                position: 'absolute', top: 12, right: 16,
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
                color: 'var(--text-muted)',
              }}>✕</button>
              <h2 style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>📖 Как пользоваться</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: '📁', title: 'Выбери FB2 книгу', desc: 'Нажми или перетащи файл .fb2' },
                  { icon: '⚙️', title: 'Выбери режим', desc: 'Сервер (быстро) или Локально (до 50 книг)' },
                  { icon: '▶️', title: 'Нажми "Конвертировать"', desc: 'Подожди пару секунд' },
                  { icon: '⬇️', title: 'Скачай .vblite', desc: 'Нажми на кнопку скачивания' },
                  { icon: '📚', title: 'Загрузи в библиотеку', desc: 'Или открой в читалке на сайте' },
                  { icon: '🎧', title: 'Слушай с голосами', desc: 'TTS сам подберёт голос' },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{step.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{step.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 20, padding: 12, borderRadius: 8,
                background: 'rgba(251,191,36,0.1)', color: '#f59e0b',
                fontSize: 13, textAlign: 'center',
              }}>⚠ Только FB2. Другие форматы не поддерживаются.</div>
            </div>
          </div>
        )}

        {/* Neuro mode — coming soon */}
        {mode === 'neuro' ? (
          <div>
            <div style={{
              display: 'flex', gap: 4, marginBottom: 2, paddingLeft: 4,
            }}>
              {MODES.map(m => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => { setMode(m.key); setFiles([]); setResults([]); setError(''); }}
                    style={{
                      padding: '4px 12px', borderRadius: '8px 8px 0 0',
                      border: active ? '2px solid var(--border)' : '1px solid var(--border)',
                      borderBottom: active ? '2px solid var(--bg-secondary)' : '1px solid var(--border)',
                      background: active ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{
              border: '1px solid var(--border)', borderRadius: '0 12px 12px 12px',
              background: 'var(--bg-secondary)', overflow: 'hidden',
            }}>
              <img
                src="/лисята-разрабатывают.png"
                alt=""
                style={{ width: '100%', display: 'block' }}
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.style.padding = '80px 20px';
                    parent.style.textAlign = 'center';
                    parent.innerHTML = '<div style="font-size:64px">🦊</div><div style="font-size:14px;color:var(--text-muted);margin-top:8px">лисята разрабатывают</div>';
                  }
                }}
              />
            </div>
          </div>
        ) : (

        /* Converter card */
        <div style={{
          border: '1px solid var(--border)', borderRadius: 12, padding: 24,
          background: 'var(--bg-secondary)',
        }}>
          {/* Mode tabs */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 20, marginTop: -36,
            paddingLeft: 4,
          }}>
            {MODES.map(m => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setFiles([]); setResults([]); setError(''); }}
                  style={{
                    padding: '4px 12px', borderRadius: '8px 8px 0 0',
                    border: active ? '2px solid var(--border)' : '1px solid var(--border)',
                    borderBottom: active ? '2px solid var(--bg-secondary)' : '1px solid var(--border)',
                    background: active ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', opacity: 1,
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Drop zone */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
              📄 Файлы .fb2 {mode === 'local' && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>— до 50 шт</span>}
            </label>
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onClick={() => {
                const input = document.getElementById('fb2-input') as HTMLInputElement;
                if (input) { input.value = ''; input.click(); }
              }}
              style={{
                width: '100%', padding: files.length > 0 ? 16 : 24, borderRadius: 8,
                cursor: 'pointer', boxSizing: 'border-box',
                border: '2px dashed var(--border)',
                background: 'var(--bg-primary)', color: 'var(--text-muted)',
                fontSize: 13, textAlign: 'center', transition: 'all 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {files.length === 0 ? (
                <span>👆 Нажми или перетащи .fb2 сюда</span>
              ) : (
                <div style={{ textAlign: 'left' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0', fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {f.name}
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeFile(i); }} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 14, padding: 0,
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              id="fb2-input"
              type="file"
              accept=".fb2"
              multiple={true}
              onChange={e => { if (e.target.files) addFiles(e.target.files); }}
              style={{ display: 'none' }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              {mode === 'local'
                ? '🖥 До 50 файлов'
                : (user?.is_plus ? '⚡ До 20 файлов (Plus)' : '⚡ 1 файл · Купи Plus для массовой конвертации')}
            </div>
          </div>

          {/* Convert progress */}
          {convertProgress && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 16,
              background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 13,
            }}>
              ⏳ Конвертация: {convertProgress.done}/{convertProgress.total}
            </div>
          )}

          {/* Messages */}
          {notification && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 16,
              background: 'rgba(34,197,94,0.1)',
              color: '#22c55e',
              fontSize: 13,
            }}>
              {notification}
            </div>
          )}
          {error && !convertProgress && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 16,
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              fontSize: 13, whiteSpace: 'pre-line',
            }}>
              {error}
            </div>
          )}

          {/* Convert button */}
          <button
            onClick={handleConvert}
            disabled={converting || files.length === 0}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 8, border: 'none',
              background: converting ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: converting || files.length === 0 ? 'not-allowed' : 'pointer',
              opacity: converting || files.length === 0 ? 0.6 : 1,
            }}
          >
            {converting ? '⏳ Конвертация...' : '▶ Конвертировать'}
          </button>
        </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: 24 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', marginBottom: 8,
                background: 'var(--bg-secondary)', borderRadius: 8,
              }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ✅ {r.name}
                </span>
                <button onClick={() => downloadResult(r.name, r.data)} style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)',
                  background: clickedDownload === r.name ? 'var(--accent)' : 'transparent',
                  color: clickedDownload === r.name ? '#fff' : 'var(--accent)',
                  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s', transform: clickedDownload === r.name ? 'scale(0.95)' : 'scale(1)',
                }}>
                  ⬇ Скачать
                </button>
              </div>
            ))}

            {results.length > 1 && (
              <button onClick={downloadAll} style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: '1px solid var(--accent)',
                background: clickedDownload === '__all__' ? 'var(--accent)' : 'transparent',
                color: clickedDownload === '__all__' ? '#fff' : 'var(--accent)',
                fontSize: 14, cursor: 'pointer', marginTop: 4,
                transition: 'all 0.15s', transform: clickedDownload === '__all__' ? 'scale(0.97)' : 'scale(1)',
              }}>
                ⬇ Скачать всё ({results.length})
              </button>
            )}


            {/* Upload to library (only server, 1 file) */}
            {results.length === 1 && mode === 'server' && user && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={handleUploadToLibrary}
                  disabled={uploading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8,
                    border: '2px solid var(--accent)',
                    background: uploading ? 'var(--text-muted)' : 'transparent',
                    color: 'var(--accent)', fontSize: 14, fontWeight: 600,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? '⏳ Загрузка...' : '📚 Загрузить в библиотеку'}
                </button>
                {uploadResult && (
                  <div style={{
                    marginTop: 8, padding: 10, borderRadius: 8,
                    background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 13,
                  }}>
                    ✅ «{uploadResult.title}» загружена!{' '}
                    <a href={`/reader/${uploadResult.id}`} style={{ color: 'var(--accent)' }}>Открыть →</a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
