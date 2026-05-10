# Fox Converter

Standalone конвертер книг в формат VoxBook (`.vb` / `.vblite`) с использованием LLM.

## Структура

```
converter/
├── llama.cpp/      # git submodule — исходники llama.cpp
├── scripts/
│   ├── build.sh    # сборка llama.cpp
│   └── download_model.sh  # скачать GGUF модель
├── models/         # .gguf файлы (gitignored)
├── prompts/        # pre-prompts для LLM
│   └── fb2_to_vblite.md
├── ui/             # dev-интерфейс для проверки
│   └── index.html
├── src/
│   ├── converter.py    # основной код конвертации
│   └── llm_client.py   # клиент для llama.cpp
└── requirements.txt
```

## Быстрый старт

```bash
# 1. Собрать llama.cpp
bash scripts/build.sh

# 2. Скачать модель
bash scripts/download_model.sh

# 3. Запустить сервер
./llama.cpp/build/bin/llama-server -m models/model.q4_K_M.gguf --port 8080

# 4. Запустить конвертер
python src/converter.py --input book.fb2 --output book.vb
```
