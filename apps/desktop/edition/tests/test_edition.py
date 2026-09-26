"""Kiểm gói doanh nghiệp AI for Boss chạy thật trên lõi Hermes (không giả lập lõi).

Chạy từ gốc kho sau khi cài lõi: uv pip install -e . && python -m pytest apps/desktop/edition/tests
"""

from __future__ import annotations

import importlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

EDITION = Path(__file__).resolve().parents[1]
REPO = EDITION.parents[2]


def _seed(home: Path) -> dict:
    env = {**os.environ, "HERMES_HOME": str(home), "PYTHONPATH": str(REPO), "PYTHONIOENCODING": "utf-8"}
    out = subprocess.run(
        [sys.executable, str(EDITION / "seed_edition.py"), str(EDITION)],
        env=env, capture_output=True, text=True, timeout=180, check=True,
    ).stdout
    line = next(l for l in out.splitlines() if l.startswith("AIFB_SEED "))
    return json.loads(line[len("AIFB_SEED "):])


def _run(home: Path, code: str) -> str:
    env = {**os.environ, "HERMES_HOME": str(home), "PYTHONPATH": str(REPO), "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True,
                          timeout=180, check=True).stdout


def test_seed_fresh_home_then_core_sees_everything(tmp_path):
    report = _seed(tmp_path)
    assert report["soul"] == "written"
    assert report["cacheTtl"] == "set"
    assert len(report["skills"]) == 12
    assert report["roles"] == ["ban-hang", "dieu-hanh", "marketing-noi-dung", "quan-ly-du-an"]
    assert json.loads((tmp_path / "edition-seed.json").read_text(encoding="utf-8"))["seedVersion"] >= 1

    out = _run(tmp_path, (
        "import json\n"
        "from hermes_cli.config import load_config\n"
        "from hermes_cli.personality import resolve_personality\n"
        "from agent.skill_commands import get_skill_commands\n"
        "from hermes_cli.plugins import discover_plugins, get_plugin_manager\n"
        "from tools.registry import registry\n"
        "cfg = load_config(); discover_plugins(); pm = get_plugin_manager()\n"
        "print(json.dumps({'ttl': cfg['prompt_caching']['cache_ttl'],\n"
        "  'role': resolve_personality('quan-ly-du-an', cfg)[0],\n"
        "  'skill': '/ke-hoach-du-an' in get_skill_commands(),\n"
        "  'tool': registry.get_entry('aifb_record_decision') is not None,\n"
        "  'hooks': sorted(h for h in ('pre_llm_call','pre_tool_call','post_api_request') if pm._hooks.get(h))}))\n"
    ))
    got = json.loads(out.strip().splitlines()[-1])
    assert got == {"ttl": "1h", "role": "quan-ly-du-an", "skill": True, "tool": True,
                   "hooks": ["post_api_request", "pre_llm_call", "pre_tool_call"]}


def test_reseed_keeps_user_choices(tmp_path):
    _seed(tmp_path)
    soul = tmp_path / "SOUL.md"
    soul.write_text(soul.read_text(encoding="utf-8") + "\nAnh chị tự thêm dòng này.\n", encoding="utf-8")
    _run(tmp_path, "from hermes_cli.config import set_config_value; set_config_value('prompt_caching.cache_ttl', '5m')")
    report = _seed(tmp_path)
    assert report["soul"] == "kept-user-edit"
    assert report["cacheTtl"] == "kept:5m"
    assert soul.read_text(encoding="utf-8").rstrip().endswith("Anh chị tự thêm dòng này.")


def test_seed_replaces_hermes_default_soul(tmp_path):
    sys.path.insert(0, str(REPO))
    from hermes_cli.default_soul import DEFAULT_SOUL_MD

    (tmp_path / "SOUL.md").write_text(DEFAULT_SOUL_MD, encoding="utf-8")
    assert _seed(tmp_path)["soul"] == "written"
    assert (tmp_path / "SOUL.md").read_text(encoding="utf-8").startswith("<!-- ai-for-boss-soul")


@pytest.fixture
def harness(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    sys.path.insert(0, str(REPO))
    sys.path.insert(0, str(EDITION / "plugins"))
    spec = importlib.util.spec_from_file_location("aifb_harness", EDITION / "plugins" / "aifb-harness" / "__init__.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, tmp_path


def test_decision_log_and_recent_context(harness):
    module, home = harness
    state = home / "aifb"
    state.mkdir()
    assert module.recent_decisions(state) == ""
    module.record_decision(state, {"decision": "Chọn gói | Cân bằng", "rationale": "rẻ hơn", "rejected": ["Chất lượng"]})
    page = (state / "QUYET-DINH.md").read_text(encoding="utf-8")
    assert "Chọn gói \\| Cân bằng" in page
    assert "Chọn gói | Cân bằng (vì rẻ hơn)" in module.recent_decisions(state)
    with pytest.raises(ValueError):
        module.record_decision(state, {"decision": "  "})


def test_step_cap_blocks_after_limit_per_turn(harness):
    module, _ = harness
    assert module.count_step("s:t1", 2) is None
    assert module.count_step("s:t1", 2) is None
    assert "trần 2 bước" in module.count_step("s:t1", 2)
    assert module.count_step("s:t2", 2) is None, "lượt mới đếm lại từ đầu"


def test_trace_row_reads_core_usage_buckets(harness):
    module, _ = harness
    row = module.trace_row({"session_id": "s", "turn_id": "t", "provider": "anthropic", "model": "m",
                            "usage": {"input_tokens": 10, "output_tokens": 5, "cache_read_tokens": 900,
                                      "cache_write_tokens": 0, "reasoning_tokens": 2}, "api_duration": 1.456})
    assert (row["input"], row["output"], row["cacheRead"], row["reasoning"], row["seconds"]) == (10, 5, 900, 2, 1.46)


def test_seed_applies_token_defaults_once_and_respects_user(tmp_path):
    report = _seed(tmp_path)
    assert "platform_toolsets.cli" in report["configDefaults"]
    assert "compression.threshold_tokens" in report["configDefaults"]
    out = _run(tmp_path, (
        "import json\nfrom hermes_cli.config import load_config\n"
        "c = load_config()\n"
        "print(json.dumps({'tools': c['platform_toolsets']['cli'], 'thr': c['compression']['threshold_tokens'],"
        " 'fast': c['auxiliary']['title_generation']['prefer_fast_model'], 'read': c['file_read_max_chars']}))\n"
    ))
    got = json.loads(out.strip().splitlines()[-1])
    assert "terminal" in got["tools"] and "aifb_harness" in got["tools"]
    assert (got["thr"], got["fast"], got["read"]) == (100000, True, 40000)
    # Người dùng tự đổi một mặc định: lần gieo sau không được ghi đè.
    _run(tmp_path, "from hermes_cli.config import set_config_value; set_config_value('file_read_max_chars', '90000')")
    (tmp_path / "edition-seed.json").unlink()
    report = _seed(tmp_path)
    assert "file_read_max_chars" not in report["configDefaults"]


def test_openai_24h_cache_only_for_direct_openai_supported_models(harness):
    module, _ = harness
    req = {"model": "gpt-5.5", "messages": []}
    assert module.openai_cache_request(req, "https://api.openai.com/v1", "gpt-5.5")["prompt_cache_retention"] == "24h"
    assert module.openai_cache_request(req, "https://chatgpt.com/backend-api/codex", "gpt-5.5") is None
    assert module.openai_cache_request({"model": "gpt-4o"}, "https://api.openai.com/v1", "gpt-4o") is None
    assert module.openai_cache_request({**req, "prompt_cache_retention": "in_memory"}, "https://api.openai.com/v1", "gpt-5.5") is None


def test_upgrade_from_v2_toolsets_reenables_terminal_but_respects_user_lists(tmp_path):
    manifest = json.loads((EDITION / "edition.json").read_text(encoding="utf-8"))
    old = manifest["configUpgrades"]["platform_toolsets.cli"]["from"]
    code = ("import json,sys\nfrom hermes_cli.config import read_raw_config, save_config\n"
            "c = read_raw_config() or {}\nc.setdefault('platform_toolsets', {})['cli'] = json.loads(sys.argv[1])\nsave_config(c)\n")
    env = {**os.environ, "HERMES_HOME": str(tmp_path), "PYTHONPATH": str(REPO)}
    # Máy đã gieo bản 2 còn nguyên mặc định cũ → được nâng.
    subprocess.run([sys.executable, "-c", code, json.dumps(old)], env=env, check=True, timeout=120)
    report = _seed(tmp_path)
    assert report["configUpgrades"] == ["platform_toolsets.cli"]
    tools = json.loads(_run(tmp_path, "import json\nfrom hermes_cli.config import load_config\nprint(json.dumps(load_config()['platform_toolsets']['cli']))").strip().splitlines()[-1])
    assert "terminal" in tools and "browser" in tools
    # Người dùng tự đặt danh sách khác → không đụng.
    custom = ["web", "file"]
    subprocess.run([sys.executable, "-c", code, json.dumps(custom)], env=env, check=True, timeout=120)
    (tmp_path / "edition-seed.json").unlink()
    assert _seed(tmp_path)["configUpgrades"] == []
