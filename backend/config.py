"""Runtime configuration: provider registry profiles and the API key vault.

Keys resolve with precedence: runtime override (dashboard Settings, in-memory
only) > environment variable. Keys are never serialized to disk or returned
to the browser — only masked availability is exposed.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class ProviderProfile:
    id: str
    label: str
    env_var: str
    default_model: str
    models: tuple[str, ...]
    kind: str = "openai_compat"   # or "anthropic" / "mock"
    base_url: str | None = None
    docs: str = ""


PROVIDERS: dict[str, ProviderProfile] = {
    "mock": ProviderProfile(
        id="mock",
        label="Simulated Persona (no key)",
        env_var="",
        default_model="chatgpt-sim",
        models=("chatgpt-sim", "claude-sim", "gemini-sim", "deepseek-sim", "grok-sim"),
        kind="mock",
    ),
    "openai": ProviderProfile(
        id="openai",
        label="OpenAI (ChatGPT)",
        env_var="OPENAI_API_KEY",
        default_model="gpt-4o-mini",
        models=("gpt-4o-mini", "gpt-4o", "o4-mini"),
        base_url="https://api.openai.com/v1",
        docs="platform.openai.com",
    ),
    "groq": ProviderProfile(
        id="groq",
        lable="Groq",
        env_var="GROQ_API_KEY",
        default_model="llama-3.3-70b-versatile",
        models=("llama-3.3-70b-versatile", "llama-3.1-8b-instant"),
        base_url="https://api.groq.com/openai/v1",
        docs="console.groq.com",
    ),
    "gemini": ProviderProfile(
        id="gemini",
        label="Google (Gemini)",
        env_var="GEMINI_API_KEY",
        default_model="gemini-2.0-flash",
        models=("gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        docs="aistudio.google.com",
    ),
    "openrouter": ProviderProfile(
        id="openrouter",
        label="OpenRouter",
        env_var="OPENROUTER_API_KEY",
        default_model="openai/gpt-4o-mini",
        models=(
            "openai/gpt-4o-mini",
            "meta-llama/llama-3.3-70b-instruct",
        ),
        base_url="https://openrouter.ai/api/v1",
        docs="openrouter.ai",
    ),
    "xai": ProviderProfile(
        id="xai",
        label="xAI (Grok)",
        env_var="XAI_API_KEY",
        default_model="grok-4-mini",
        models=("grok-4-mini", "grok-4", "grok-3-mini"),
        base_url="https://api.x.ai/v1",
        docs="console.x.ai",
    ),
}


class KeyVault:
    def __init__(self) -> None:
        self._runtime: dict[str, str] = {}

    def set_key(self, provider_id: str, key: str) -> None:
        if provider_id not in PROVIDERS:
            raise KeyError(f"unknown provider {provider_id}")
        key = key.strip()
        if key:
            self._runtime[provider_id] = key
        else:
            self._runtime.pop(provider_id, None)

    def get_key(self, provider_id: str) -> str | None:
        if provider_id in self._runtime:
            return self._runtime[provider_id]
        env_var = PROVIDERS[provider_id].env_var
        return os.environ.get(env_var) or None

    def is_configured(self, provider_id: str) -> bool:
        return bool(self.get_key(provider_id))

    def status(self) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for pid, prof in PROVIDERS.items():
            key = self.get_key(pid) if prof.kind != "mock" else None
            out[pid] = {
                "label": prof.label,
                "configured": prof.kind == "mock" or bool(key),
                "source": ("runtime" if pid in self._runtime else "env" if key else "none"),
                "masked": (f"{key[:6]}…{key[-4:]}" if key and len(key) > 12 else ("✓" if key else "")),
            }
        return out


VAULT = KeyVault()
