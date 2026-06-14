import json
import os
from typing import Any, TypeVar

import httpx
import pydantic

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=30.0)

T = TypeVar("T", bound=pydantic.BaseModel)


class OpenRouterError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise OpenRouterError(
            "OPENROUTER_API_KEY is not set. Add it to your environment or GitHub Actions secrets."
        )
    return key


def _headers() -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    referer = os.environ.get("OPENROUTER_HTTP_REFERER", "").strip()
    if referer:
        headers["HTTP-Referer"] = referer
    app_name = os.environ.get("OPENROUTER_APP_NAME", "MuseLab Agents").strip()
    if app_name:
        headers["X-Title"] = app_name
    return headers


def _extract_message_content(data: dict[str, Any]) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError(f"Unexpected OpenRouter response shape: {data}") from exc
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        content = "".join(parts)
    if not isinstance(content, str) or not content.strip():
        raise OpenRouterError("OpenRouter returned empty assistant content.")
    return content


def chat(
    *,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
    response_model: type[T] | None = None,
    temperature: float = 0.2,
    session_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if session_id:
        payload["user"] = session_id
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice or "auto"
    if response_model is not None:
        schema = response_model.model_json_schema()
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": response_model.__name__,
                "strict": True,
                "schema": schema,
            },
        }

    response = httpx.post(
        OPENROUTER_URL,
        headers=_headers(),
        json=payload,
        timeout=DEFAULT_TIMEOUT,
    )
    if response.status_code >= 400:
        raise OpenRouterError(
            f"OpenRouter request failed ({response.status_code}): {response.text}"
        )
    data = response.json()
    if data.get("error"):
        raise OpenRouterError(f"OpenRouter error: {data['error']}")
    return data


def chat_text(
    *,
    model: str,
    system: str,
    user: str,
    temperature: float = 0.2,
    session_id: str | None = None,
) -> str:
    data = chat(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        session_id=session_id,
    )
    return _extract_message_content(data)


def chat_structured(
    *,
    model: str,
    system: str,
    user: str,
    response_model: type[T],
    temperature: float = 0.1,
    session_id: str | None = None,
) -> T:
    try:
        data = chat(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_model=response_model,
            temperature=temperature,
            session_id=session_id,
        )
        content = _extract_message_content(data)
        return response_model.model_validate_json(content)
    except (OpenRouterError, pydantic.ValidationError, json.JSONDecodeError):
        repair_prompt = (
            f"{user}\n\nRespond with ONLY valid JSON matching this schema:\n"
            f"{json.dumps(response_model.model_json_schema(), indent=2)}"
        )
        content = chat_text(
            model=model,
            system=system,
            user=repair_prompt,
            temperature=0.0,
            session_id=session_id,
        )
        return response_model.model_validate_json(content)


def chat_with_tools(
    *,
    model: str,
    system: str,
    user: str,
    tools: list[dict[str, Any]],
    execute_tool,
    max_rounds: int = 40,
    temperature: float = 0.2,
    session_id: str | None = None,
) -> str:
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    for round_idx in range(max_rounds):
        data = chat(
            model=model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=temperature,
            session_id=session_id,
        )
        message = data["choices"][0]["message"]
        messages.append(message)

        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            content = message.get("content")
            if not content:
                raise OpenRouterError(f"Tool loop ended without content at round {round_idx + 1}.")
            if isinstance(content, list):
                return _extract_message_content(data)
            return content

        for tool_call in tool_calls:
            function = tool_call.get("function") or {}
            name = function.get("name", "")
            raw_args = function.get("arguments") or "{}"
            try:
                args = json.loads(raw_args)
            except json.JSONDecodeError as exc:
                result = {"error": f"Invalid JSON arguments: {exc}"}
            else:
                try:
                    result = execute_tool(name, args)
                except Exception as exc:  # noqa: BLE001 - return tool errors to the model
                    result = {"error": str(exc)}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id"),
                    "content": json.dumps(result),
                }
            )

    raise OpenRouterError(f"Tool loop exceeded {max_rounds} rounds without finishing.")
