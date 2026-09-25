"""Gieo gói doanh nghiệp AI for Boss vào HERMES_HOME. Chạy bằng Python của lõi.

Gọi: python seed_edition.py <thư-mục-edition>
Vỏ (electron/edition-seed.ts) chỉ gọi khi seedVersion trong edition.json mới hơn dấu
đã ghi ở <HERMES_HOME>/edition-seed.json, và trước khi backend khởi động.

Luật: chỉ dùng hàm công khai của lõi, không sửa lõi. Không ghi đè thứ người dùng đã
tự sửa: SOUL.md chỉ thay khi còn là mặc định của Hermes hoặc đúng bản AI for Boss đã
gieo lần trước; cache_ttl chỉ đặt khi người dùng chưa đặt. Kỹ năng, plugin và bốn vai
trò là phần của gói nên được thay bằng bản mới mỗi lần gieo.

In ra một dòng JSON tóm tắt; mã thoát khác 0 khi hỏng.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

MARKER = "edition-seed.json"
SOUL_MARKER = "<!-- ai-for-boss-soul"


def _sha(text: str) -> str:
    return hashlib.sha256(text.replace("\r\n", "\n").strip().encode("utf-8")).hexdigest()


def _copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))


def role_prompt(role: dict) -> str:
    skills = ", ".join(f"`{s}`" for s in role.get("skills", []) if s != "quy-tac-dieu-hanh")
    return (
        f"Bạn đang đóng vai {role['label']}. {role['role']} "
        f"Người dùng: {role['forWhom']} "
        f"Mục tiêu: {role['goal']} "
        f"Ưu tiên dùng các kỹ năng {skills} khi việc khớp với chúng. "
        "Quy tắc điều hành trong SOUL.md vẫn áp dụng trước mọi vai trò."
    )


def main(edition_dir: Path) -> dict:
    from hermes_constants import get_hermes_home
    from hermes_cli.config import read_raw_config, set_config_value
    from hermes_cli.default_soul import DEFAULT_SOUL_MD, is_legacy_template_soul

    home = Path(get_hermes_home())
    home.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((edition_dir / "edition.json").read_text(encoding="utf-8"))
    marker_path = home / MARKER
    previous = json.loads(marker_path.read_text(encoding="utf-8")) if marker_path.exists() else {}
    report: dict = {"edition": manifest["id"], "seedVersion": manifest["seedVersion"]}

    # 1. Kỹ năng: <HERMES_HOME>/skills/ai-for-boss/<tên>/SKILL.md
    skills_src = edition_dir / "skills"
    for category in sorted(p for p in skills_src.iterdir() if p.is_dir()):
        _copy_tree(category, home / "skills" / category.name)
    report["skills"] = sorted(p.name for p in (skills_src / "ai-for-boss").iterdir() if p.is_dir())

    # 2. Plugin harness, bật trong plugins.enabled (không cấp quyền ghi đè công cụ lõi).
    for plugin in sorted(p for p in (edition_dir / "plugins").iterdir() if p.is_dir()):
        _copy_tree(plugin, home / "plugins" / plugin.name)
        from hermes_cli.plugins_cmd import cmd_enable

        cmd_enable(plugin.name, allow_tool_override=False)
    report["plugins"] = sorted(p.name for p in (edition_dir / "plugins").iterdir() if p.is_dir())

    # 3. SOUL.md: chỉ thay khi chưa có, còn mặc định, hoặc đúng bản đã gieo lần trước.
    soul = (edition_dir / "SOUL.md").read_text(encoding="utf-8")
    soul_path = home / "SOUL.md"
    current = soul_path.read_text(encoding="utf-8") if soul_path.exists() else ""
    replaceable = (
        not current.strip()
        or _sha(current) == _sha(DEFAULT_SOUL_MD)
        or is_legacy_template_soul(current)
        or (current.lstrip().startswith(SOUL_MARKER) and _sha(current) == previous.get("soulSha"))
    )
    if replaceable:
        soul_path.write_text(soul, encoding="utf-8")
        report["soul"] = "written"
        soul_sha = _sha(soul)
    else:
        report["soul"] = "kept-user-edit"
        soul_sha = previous.get("soulSha")

    # 4. Cấu hình: bộ đệm prompt 1 giờ (chỉ khi người dùng chưa đặt) và bốn vai trò.
    raw = read_raw_config() or {}
    caching = raw.get("prompt_caching") if isinstance(raw.get("prompt_caching"), dict) else {}
    if "cache_ttl" not in caching:
        set_config_value("prompt_caching.cache_ttl", manifest.get("promptCacheTtl", "1h"))
        report["cacheTtl"] = "set"
    else:
        report["cacheTtl"] = f"kept:{caching.get('cache_ttl')}"
    roles = []
    for path in sorted((edition_dir / "roles").glob("*.json")):
        role = json.loads(path.read_text(encoding="utf-8"))
        set_config_value(f"agent.personalities.{role['id']}", role_prompt(role), force=True)
        roles.append(role["id"])
    report["roles"] = roles

    marker_path.write_text(
        json.dumps({"edition": manifest["id"], "seedVersion": manifest["seedVersion"], "soulSha": soul_sha},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: seed_edition.py <edition-dir>", file=sys.stderr)
        sys.exit(2)
    result = main(Path(sys.argv[1]))
    print("AIFB_SEED " + json.dumps(result, ensure_ascii=False))
