"""AI for Boss harness: sổ quyết định, trần bước công cụ, sổ token.

Chuyển từ plugin OpenClaw ``aifb-harness`` (kho ai-for-boss, packages/harness-plugin)
sang giao diện plugin của Hermes Agent, không sửa lõi:

* Công cụ ``aifb_record_decision`` ghi ``QUYET-DINH.md`` (người đọc) và
  ``QUYET-DINH.jsonl`` (plugin đọc lại) trong ``<HERMES_HOME>/aifb/``.
* ``pre_llm_call`` chèn tối đa 10 quyết định gần nhất vào lượt hiện tại. Lõi chèn
  vào tin nhắn người dùng và không lưu lại, nên phần đầu prompt vẫn trúng bộ đệm.
* ``pre_tool_call`` chặn khi một lượt vượt trần bước công cụ (mặc định 40, đổi bằng
  biến môi trường ``AFB_MAX_TOOL_STEPS``), kèm câu tiếng Việt nói rõ đã dùng bao nhiêu.
* ``post_api_request`` ghi một dòng JSONL mỗi lần gọi mô hình vào
  ``<HERMES_HOME>/aifb/trace.jsonl``: token vào, ra, đọc và ghi bộ đệm. Đây là số
  liệu để đo prompt caching và Advisor có thật sự tiết kiệm không.
* Middleware ``llm_request`` xin OpenAI giữ bộ đệm 24 giờ
  (``prompt_cache_retention: "24h"``) khi gọi thẳng api.openai.com bằng khóa API với
  dòng model OpenAI hỗ trợ. Lõi chỉ tự bật mức này cho Meta và AWS Bedrock. Đường
  đăng nhập ChatGPT (chatgpt.com) và các nhà cung cấp khác không bị đụng.

Chưa có ở bản này: ba nút hợp đồng tác vụ (Nhanh, Kỹ, Quyết định quan trọng) và trần
token theo lượt, vì cần giao diện trong ô soạn.
"""

from __future__ import annotations

import json
import os
import threading
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DECISION_LOG = "QUYET-DINH.jsonl"
DECISION_PAGE = "QUYET-DINH.md"
TRACE_LOG = "trace.jsonl"
RECENT_LIMIT = 10
RECENT_CHARS = 2500
DEFAULT_MAX_TOOL_STEPS = 40
_TURN_MEMORY = 256  # số lượt gần nhất giữ bộ đếm bước

_PAGE_HEADER = (
    "# Sổ quyết định\n\n"
    "Mỗi dòng là một điều anh chị đã chốt. Trợ lý đọc lại mười dòng gần nhất trước mỗi lượt.\n\n"
    "| Ngày | Quyết định | Căn cứ | Đã loại | Người chốt | Kết quả |\n"
    "| --- | --- | --- | --- | --- | --- |\n"
)

_lock = threading.Lock()
_steps: "OrderedDict[str, int]" = OrderedDict()


def _state_dir() -> Path:
    from hermes_constants import get_hermes_home

    path = Path(get_hermes_home()) / "aifb"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _max_steps() -> int:
    try:
        return max(1, int(os.environ.get("AFB_MAX_TOOL_STEPS", DEFAULT_MAX_TOOL_STEPS)))
    except ValueError:
        return DEFAULT_MAX_TOOL_STEPS


def _cell(value: Any) -> str:
    return str(value or "").replace("\r", " ").replace("\n", " ").replace("|", "\\|").strip()


def _clip(value: Any, limit: int = 2000) -> str:
    return str(value or "").strip()[:limit]


# ── Sổ quyết định ────────────────────────────────────────────────────────────


def record_decision(state: Path, args: Dict[str, Any]) -> Dict[str, Any]:
    decision = _clip(args.get("decision"))
    if not decision:
        raise ValueError("Thiếu nội dung quyết định.")
    rejected = args.get("rejected") or []
    if not isinstance(rejected, list):
        rejected = [rejected]
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "decision": decision,
        "rationale": _clip(args.get("rationale")),
        "rejected": [_clip(r) for r in rejected[:10] if _clip(r)],
        "decidedBy": _clip(args.get("decidedBy"), 200),
        "outcome": _clip(args.get("outcome")),
    }
    page = state / DECISION_PAGE
    with _lock:
        if not page.exists():
            page.write_text(_PAGE_HEADER, encoding="utf-8")
        with page.open("a", encoding="utf-8") as fh:
            fh.write(
                f"| {entry['ts'][:10]} | {_cell(entry['decision'])} | {_cell(entry['rationale'])} | "
                f"{_cell('; '.join(entry['rejected']))} | {_cell(entry['decidedBy'])} | {_cell(entry['outcome'])} |\n"
            )
        with (state / DECISION_LOG).open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def recent_decisions(state: Path) -> str:
    try:
        raw = (state / DECISION_LOG).read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""
    entries: List[Dict[str, Any]] = []
    for line in raw.splitlines()[-RECENT_LIMIT:]:
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if isinstance(item, dict) and isinstance(item.get("decision"), str):
            entries.append(item)
    if not entries:
        return ""
    text = "Quyết định gần đây của người dùng (đọc, không hỏi lại những điều đã chốt):\n"
    for item in reversed(entries):
        row = f"- {str(item.get('ts', ''))[:10]}: {item['decision']}"
        if item.get("rationale"):
            row += f" (vì {item['rationale']})"
        if item.get("outcome"):
            row += f" → {item['outcome']}"
        row += "\n"
        if len(text) + len(row) > RECENT_CHARS:
            break
        text += row
    return text.rstrip()


_DECISION_SCHEMA = {
    "name": "aifb_record_decision",
    "description": (
        "Record a decision the user has just made (what was decided, why, rejected alternatives, "
        "who decided, outcome if known) into the decision log QUYET-DINH.md. Call it only after the "
        "user explicitly confirms a choice; never for your own suggestions."
    ),
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "required": ["decision"],
        "properties": {
            "decision": {"type": "string", "description": "Điều người dùng đã chốt."},
            "rationale": {"type": "string", "description": "Căn cứ để chốt."},
            "rejected": {"type": "array", "items": {"type": "string"}, "description": "Phương án đã loại."},
            "decidedBy": {"type": "string", "description": "Người chốt."},
            "outcome": {"type": "string", "description": "Kết quả nếu đã biết."},
        },
    },
}


def _handle_record_decision(args: Dict[str, Any], **_kw: Any) -> str:
    from tools.registry import tool_error, tool_result

    try:
        entry = record_decision(_state_dir(), args or {})
    except Exception as exc:  # noqa: BLE001 — trả lỗi cho mô hình thay vì làm sập lượt
        return tool_error(f"Chưa ghi được sổ quyết định: {exc}")
    return tool_result({"ok": True, "message": f"Đã ghi vào sổ quyết định ({DECISION_PAGE}): {entry['decision']}"})


# ── Hook ────────────────────────────────────────────────────────────────────


def _on_pre_llm_call(**_kw: Any) -> Optional[Dict[str, str]]:
    try:
        text = recent_decisions(_state_dir())
    except OSError:
        return None
    return {"context": text} if text else None


def count_step(key: str, limit: int) -> Optional[str]:
    """Tăng bộ đếm bước của một lượt; trả câu chặn khi đã vượt trần."""
    with _lock:
        used = _steps.pop(key, 0) + 1
        _steps[key] = used
        while len(_steps) > _TURN_MEMORY:
            _steps.popitem(last=False)
    if used <= limit:
        return None
    return (
        f"Đã chạm trần {limit} bước công cụ cho lượt này (đây là bước thứ {used}). "
        "Dừng lại, tóm tắt việc đã làm và kết quả tới giờ, rồi hỏi anh chị muốn làm tiếp hay chốt tại đây. "
        "Không dùng công cụ khác để lách trần."
    )


def _on_pre_tool_call(tool_name: str = "", session_id: str = "", turn_id: str = "", task_id: str = "", **_kw: Any):
    key = f"{session_id or task_id}:{turn_id}"
    if key == ":":
        return None
    message = count_step(key, _max_steps())
    return {"action": "block", "message": message} if message else None


def trace_row(kw: Dict[str, Any]) -> Dict[str, Any]:
    usage = kw.get("usage") or {}
    return {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "session": kw.get("session_id") or "",
        "turn": kw.get("turn_id") or "",
        "provider": kw.get("provider") or "",
        "model": kw.get("response_model") or kw.get("model") or "",
        "input": usage.get("input_tokens", 0),
        "output": usage.get("output_tokens", 0),
        "cacheRead": usage.get("cache_read_tokens", 0),
        "cacheWrite": usage.get("cache_write_tokens", 0),
        "reasoning": usage.get("reasoning_tokens", 0),
        "seconds": round(float(kw.get("api_duration") or 0), 2),
    }


def _on_post_api_request(**kw: Any) -> None:
    try:
        row = trace_row(kw)
        with _lock, (_state_dir() / TRACE_LOG).open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:  # noqa: BLE001 — sổ token không bao giờ được làm hỏng lượt chat
        pass


def openai_cache_request(request: Dict[str, Any], base_url: str, model: str) -> Optional[Dict[str, Any]]:
    """Trả request đã thêm prompt_cache_retention=24h, hoặc None nếu không áp dụng."""
    if not isinstance(request, dict) or "prompt_cache_retention" in request:
        return None
    try:
        from urllib.parse import urlparse

        host = (urlparse(str(base_url or "")).hostname or "").lower()
    except ValueError:
        return None
    if host != "api.openai.com":
        return None
    try:
        from agent.transports.codex import _EXTENDED_PROMPT_CACHE_MODEL_RE as supported
    except Exception:  # noqa: BLE001 — lõi đổi tên thì thôi, không đoán
        return None
    name = str(request.get("model") or model or "").strip().lower()
    if not supported.search(name):
        return None
    return {**request, "prompt_cache_retention": "24h"}


def _on_llm_request(request=None, base_url: str = "", model: str = "", **_kw: Any):
    updated = openai_cache_request(request, base_url, model)
    return {"request": updated, "source": "aifb-harness:openai-24h-cache"} if updated else None


def register(ctx) -> None:
    ctx.register_tool(
        name="aifb_record_decision",
        toolset="aifb_harness",
        schema=_DECISION_SCHEMA,
        handler=_handle_record_decision,
        emoji="📒",
        description="Ghi sổ quyết định",
    )
    ctx.register_hook("pre_llm_call", _on_pre_llm_call)
    ctx.register_hook("pre_tool_call", _on_pre_tool_call)
    ctx.register_hook("post_api_request", _on_post_api_request)
    ctx.register_middleware("llm_request", _on_llm_request)
