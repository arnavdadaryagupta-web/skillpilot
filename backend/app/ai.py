"""Thin wrapper around the Anthropic API.

Every call takes a fallback so the whole app keeps working offline
(no API key, network trouble, or a malformed model reply).
"""
import json
import logging
import re
from typing import Any, Callable, Union

from .config import ANTHROPIC_API_KEY, MODEL

log = logging.getLogger("skillpilot.ai")

_client = None
if ANTHROPIC_API_KEY:
    from anthropic import AsyncAnthropic

    _client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


def ai_enabled() -> bool:
    return _client is not None


def parse_json(text: str) -> Any:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


async def ask_json(
    system: str,
    prompt: str,
    fallback: Union[Any, Callable[[], Any]],
    max_tokens: int = 1800,
    validate: Callable[[Any], bool] = lambda d: True,
) -> Any:
    def _fb():
        return fallback() if callable(fallback) else fallback

    if not _client:
        return _fb()
    try:
        resp = await _client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system + " Reply with valid JSON only, no markdown fences, no commentary.",
            messages=[{"role": "user", "content": prompt}],
        )
        data = parse_json("".join(b.text for b in resp.content if b.type == "text"))
        if not validate(data):
            raise ValueError("Model reply failed validation")
        return data
    except Exception as exc:  # noqa: BLE001 - we always want to degrade gracefully
        log.warning("AI call failed, using fallback: %s", exc)
        return _fb()
