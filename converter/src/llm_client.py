import json
import logging
from typing import Optional

import requests

logger = logging.getLogger("converter_llm")

LLM_HOST = "http://localhost:8080"
LLM_MODEL = "qwen2.5-7b-instruct"
TIMEOUT = 300


def is_server_running() -> bool:
    try:
        resp = requests.get(f"{LLM_HOST}/v1/models", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def generate(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    resp = requests.post(
        f"{LLM_HOST}/v1/chat/completions",
        json=payload,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()
    return result["choices"][0]["message"]["content"]


def generate_json(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
) -> dict:
    raw = generate(prompt, system_prompt, temperature)
    return json.loads(raw)
