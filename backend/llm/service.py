import os
import logging
import subprocess
import requests
import json
from typing import Optional

logger = logging.getLogger("fox_llm")

# ============================================================================
# LLM Конфигурация
# ============================================================================
LLM_HOST = os.getenv("LLM_HOST", "http://localhost:8080")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5-9b")
LLM_PARAMS = {
    "temperature": 0.7,
    "max_tokens": 2048,
}

# ============================================================================
# Публичное API
# ============================================================================
async def generate(
    prompt: str,
    system_prompt: Optional[str] = None,
    **params
) -> str:
    """Генерация текста через LLM"""
    # Формируем запрос
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        **{k: v for k, v in LLM_PARAMS.items() if k not in params},
        **params
    }
    
    try:
        response = requests.post(
            f"{LLM_HOST}/v1/chat/completions",
            json=payload,
            timeout=120
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"LLM generation error: {e}")
        raise


async def generate_stream(
    prompt: str,
    system_prompt: Optional[str] = None,
    callback=None,
    **params
):
    """Генерация с потоковой передачей"""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": True,
        **{k: v for k, v in LLM_PARAMS.items() if k not in params},
        **params
    }
    
    try:
        response = requests.post(
            f"{LLM_HOST}/v1/chat/completions",
            json=payload,
            stream=True,
            timeout=120
        )
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]
                    if data == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data)
                        content = chunk["choices"][0]["delta"].get("content", "")
                        if content and callback:
                            callback(content)
                    except:
                        pass
    except Exception as e:
        logger.error(f"LLM stream error: {e}")
        raise


def is_running() -> bool:
    """Проверить запущен ли LLM сервер"""
    try:
        response = requests.get(f"{LLM_HOST}/v1/models", timeout=5)
        return response.status_code == 200
    except:
        return False


def get_available_models() -> list:
    """Получить доступные модели"""
    if is_running():
        try:
            response = requests.get(f"{LLM_HOST}/v1/models", timeout=5)
            data = response.json()
            return [m["id"] for m in data.get("data", [])]
        except:
            pass
    return []


def set_model(model: str) -> bool:
    """Установить модель (требует перезапуска сервера)"""
    global LLM_MODEL
    LLM_MODEL = model
    return True


def get_current_model() -> str:
    """Получить текущую модель"""
    return LLM_MODEL