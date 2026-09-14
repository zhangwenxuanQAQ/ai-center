"""
Hermes 智能体服务类

封装 hermes CLI 的调用，提供智能体（Profile）的管理与详情数据读取。
所有管理操作（增删改查）均通过 subprocess 调用官方 CLI 完成；
文件内容（SOUL.md / MEMORY.md / USER.md）直接读写 profile 目录。
"""

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml

from app.configs.config import config
from app.core.exceptions import ResourceNotFoundError

# 默认智能体名称（hermes_home 根目录即 default，不可删除）
DEFAULT_AGENT_NAME = "default"

# hermes profile create 的名称规则：小写字母、数字、连字符
PROFILE_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")

# 支持的头像格式：扩展名 -> MIME 类型
AVATAR_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
# 头像文件最大 5MB
AVATAR_MAX_SIZE = 5 * 1024 * 1024


class HermesAgentError(Exception):
    """hermes 智能体操作异常"""
    pass


class HermesAgentService:
    """
    Hermes 智能体服务类

    通过 hermes CLI 管理智能体（Profile），并读取其文件内容。
    """

    def __init__(self):
        self.hermes_home = Path(config.hermes_agent.get("hermes_home", "")).resolve()
        hermes_bin = config.hermes_agent.get("hermes_bin") or ""
        if hermes_bin:
            self.hermes_bin = hermes_bin
        else:
            # 默认使用项目 .venv 中的 hermes CLI
            self.hermes_bin = str(Path(sys.executable).parent / "hermes.exe"
                                  if os.name == "nt"
                                  else Path(sys.executable).parent / "hermes")

    # ==================== 基础工具方法 ====================

    def get_agent_dir(self, name: str) -> Path:
        """
        获取智能体目录

        default 智能体位于 hermes_home 根目录，其他位于 profiles/<name> 下
        """
        if name == DEFAULT_AGENT_NAME:
            return self.hermes_home
        return self.hermes_home / "profiles" / name

    def _get_agent_stats(self, agent_dir: Path) -> dict:
        """
        获取智能体统计信息（时间戳、技能数、工具数）

        hermes 的 profile.yaml 不含时间戳，使用目录关键文件的 mtime 兜底：
        - created_at: 取目录下各关键文件最早创建时间（近似）
        - updated_at: 取目录下所有文件中最新的 mtime
        - skill_count: 扫描 skills/*/SKILL.md 数量
        """
        created_at = None
        updated_at = None
        skill_count = 0

        try:
            # 遍历目录取最早/最新文件时间（跳过日志与缓存目录）
            skip_dirs = {"logs", "audio_cache", "image_cache", "sessions", "__pycache__"}
            for path in agent_dir.rglob("*"):
                if not path.is_file():
                    continue
                if any(part in skip_dirs for part in path.parts):
                    continue
                try:
                    mtime = path.stat().st_mtime
                except OSError:
                    continue
                if updated_at is None or mtime > updated_at:
                    updated_at = mtime
                # ctime 在 Windows 为创建时间，Linux 为 inode 变更时间，均作近似
                ctime = path.stat().st_ctime
                if created_at is None or ctime < created_at:
                    created_at = ctime

            skills_dir = agent_dir / "skills"
            if skills_dir.is_dir():
                # 技能为两级目录结构 skills/<category>/<skill>/SKILL.md，.hub 为索引缓存
                skill_count = sum(
                    1 for p in skills_dir.rglob("SKILL.md")
                    if ".hub" not in p.parts
                )
        except OSError:
            pass

        return {
            "created_at": self._format_ts(created_at),
            "updated_at": self._format_ts(updated_at),
            "skill_count": skill_count,
        }

    @staticmethod
    def _format_ts(ts: Optional[float]) -> str:
        """时间戳格式化为 ISO8601 字符串（本地时区）"""
        if not ts:
            return ""
        from datetime import datetime
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")

    def _get_tool_count(self, agent_dir: Path) -> int:
        """
        统计智能体工具集数量（通过 CLI 输出，与 list_tools 解析逻辑一致）

        CLI 失败时降级为 0（不影响列表展示）
        """
        try:
            output = self.run_hermes(["tools", "list"], home=str(agent_dir), timeout=30)
        except HermesAgentError:
            return 0
        count = 0
        for line in output.splitlines():
            if re.match(r"^[✓✗]\s+(enabled|disabled)\s+\S+\s+", line.strip()):
                count += 1
        return count

    def agent_exists(self, name: str) -> bool:
        """检查智能体是否存在"""
        agent_dir = self.get_agent_dir(name)
        if not agent_dir.is_dir():
            return False
        # profile create 会创建 profile.yaml / SOUL.md / .env；
        # config.yaml 仅在完成 setup 后存在，不能作为存在性标志
        markers = ("profile.yaml", "SOUL.md", "config.yaml", "state.db")
        return any((agent_dir / f).exists() for f in markers)

    def _check_agent_exists(self, name: str):
        if not self.agent_exists(name):
            raise ResourceNotFoundError(f"智能体 {name} 不存在")

    def _validate_name(self, name: str):
        if not name or not PROFILE_NAME_PATTERN.match(name):
            raise HermesAgentError(f"智能体名称不合法：{name}（仅允许小写字母、数字、连字符）")
        if name == DEFAULT_AGENT_NAME:
            raise HermesAgentError("default 为保留名称，不可使用")

    def run_hermes(self, args: list, home: Optional[str] = None, timeout: int = 60) -> str:
        """
        执行 hermes CLI 命令

        Args:
            args: CLI 参数列表，如 ["profile", "list"]
            home: HERMES_HOME 环境变量，默认使用配置的 hermes_home
            timeout: 超时时间（秒）

        Returns:
            str: 命令标准输出
        """
        env = os.environ.copy()
        env["HERMES_HOME"] = str(home or self.hermes_home)
        # 避免 CLI 进入交互模式
        env["NO_COLOR"] = "1"
        env["TERM"] = "dumb"

        try:
            result = subprocess.run(
                [self.hermes_bin] + args,
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                cwd=str(self.hermes_home),
            )
        except FileNotFoundError:
            raise HermesAgentError(f"未找到 hermes CLI：{self.hermes_bin}")
        except subprocess.TimeoutExpired:
            raise HermesAgentError(f"hermes 命令执行超时：{' '.join(args)}")

        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            raise HermesAgentError(f"hermes 命令执行失败：{stderr or result.stdout or '未知错误'}")
        return result.stdout or ""

    async def run_hermes_async(self, args: list, home: Optional[str] = None, timeout: int = 60) -> str:
        """异步执行 hermes CLI 命令"""
        env = os.environ.copy()
        env["HERMES_HOME"] = str(home or self.hermes_home)
        env["NO_COLOR"] = "1"
        env["TERM"] = "dumb"

        try:
            proc = await asyncio.create_subprocess_exec(
                self.hermes_bin, *args,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.hermes_home),
            )
        except FileNotFoundError:
            raise HermesAgentError(f"未找到 hermes CLI：{self.hermes_bin}")

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise HermesAgentError(f"hermes 命令执行超时：{' '.join(args)}")

        stdout_text = (stdout or b"").decode("utf-8", errors="replace")
        stderr_text = (stderr or b"").decode("utf-8", errors="replace")

        if proc.returncode != 0:
            raise HermesAgentError(f"hermes 命令执行失败：{stderr_text.strip() or stdout_text or '未知错误'}")
        return stdout_text

    # ==================== 智能体管理（CLI） ====================

    def list_agents(self) -> list:
        """
        获取智能体列表（含描述、模型、统计信息）

        解析 `hermes profile list` 表格输出获取基础列表，
        再通过文件系统直接补充详情字段（避免逐个调用 CLI 详情）
        """
        try:
            output = self.run_hermes(["profile", "list"])
        except HermesAgentError:
            # CLI 不可用时降级为目录扫描
            return self._list_agents_from_fs()

        agents = []
        # 表格行格式： "◆default         —   stopped   —   —" 或 " test_zwx  Qwen3.8-27B ..."
        for line in output.splitlines():
            line = line.rstrip()
            if not line.strip():
                continue
            active = line.strip().startswith("◆")
            stripped = line.strip().lstrip("◆").strip()
            if not stripped or stripped.startswith("Profile") or stripped.startswith("─"):
                continue
            name = stripped.split()[0] if stripped.split() else ""
            if not name or name == "Profile":
                continue
            agents.append(self._build_agent_summary(name, active))
        return agents

    def _build_agent_summary(self, name: str, is_active: bool = False) -> dict:
        """组装单个智能体的摘要信息（列表页展示用）"""
        agent_dir = self.get_agent_dir(name)
        meta = self._read_profile_meta(name)
        stats = self._get_agent_stats(agent_dir)
        return {
            "name": name,
            "is_default": name == DEFAULT_AGENT_NAME,
            "is_active": is_active,
            "description": meta.get("description", ""),
            "model": self._read_model(name),
            "avatar": self._read_avatar(name),
            "path": str(agent_dir),
            "created_at": stats["created_at"],
            "updated_at": stats["updated_at"],
            "skill_count": stats["skill_count"],
            "tool_count": self._get_tool_count(agent_dir),
        }

    def _list_agents_from_fs(self) -> list:
        """CLI 不可用时，通过文件系统扫描智能体列表"""
        agents = []
        if self.agent_exists(DEFAULT_AGENT_NAME):
            agents.append(self._build_agent_summary(DEFAULT_AGENT_NAME, is_active=True))
        profiles_dir = self.hermes_home / "profiles"
        if profiles_dir.is_dir():
            for child in sorted(profiles_dir.iterdir()):
                if child.is_dir() and (child / "profile.yaml").exists():
                    agents.append(self._build_agent_summary(child.name))
        return agents

    def create_agent(self, name: str, description: str = "", clone_from: Optional[str] = None) -> dict:
        """
        创建智能体（默认从 default 克隆）

        Args:
            name: 智能体名称
            description: 描述
            clone_from: 克隆来源智能体名称，默认 default
        """
        self._validate_name(name)
        if self.agent_exists(name):
            raise HermesAgentError(f"智能体 {name} 已存在")

        source = clone_from or DEFAULT_AGENT_NAME
        self._check_agent_exists(source)

        args = ["profile", "create", name, "--clone-from", source, "--no-alias"]
        if description:
            args.extend(["--description", description])
        self.run_hermes(args)

        if not self.agent_exists(name):
            raise HermesAgentError(f"智能体 {name} 创建失败")
        return self.get_agent(name)

    def delete_agent(self, name: str) -> dict:
        """删除智能体（default 不允许删除）"""
        if name == DEFAULT_AGENT_NAME:
            raise HermesAgentError("默认智能体 default 不允许删除")
        self._check_agent_exists(name)

        self.run_hermes(["profile", "delete", name, "--yes"])
        return {"name": name, "deleted": True}

    def rename_agent(self, name: str, new_name: str) -> dict:
        """重命名智能体"""
        if name == DEFAULT_AGENT_NAME:
            raise HermesAgentError("默认智能体 default 不允许重命名")
        self._check_agent_exists(name)
        self._validate_name(new_name)
        if self.agent_exists(new_name):
            raise HermesAgentError(f"智能体 {new_name} 已存在")

        self.run_hermes(["profile", "rename", name, new_name])
        return self.get_agent(new_name)

    def update_agent(self, name: str, new_name: Optional[str] = None, description: Optional[str] = None) -> dict:
        """
        更新智能体信息（重命名/描述）
        """
        self._check_agent_exists(name)
        result = None
        if description is not None:
            self.run_hermes(["profile", "describe", name, "--text", description])
            result = self.get_agent(name)
        if new_name and new_name != name:
            result = self.rename_agent(name, new_name)
        return result or self.get_agent(name)

    # ==================== 详情数据读取 ====================

    def _read_file(self, agent_dir: Path, relative: str) -> Optional[str]:
        """读取智能体目录下文件，不存在返回 None"""
        path = agent_dir / relative
        if not path.is_file():
            return None
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            return None

    def _read_soul(self, name: str) -> Optional[str]:
        return self._read_file(self.get_agent_dir(name), "SOUL.md")

    def _read_memory(self, name: str) -> Optional[str]:
        return self._read_file(self.get_agent_dir(name), "memories/MEMORY.md")

    def _read_user(self, name: str) -> Optional[str]:
        return self._read_file(self.get_agent_dir(name), "memories/USER.md")

    def _read_profile_meta(self, name: str) -> dict:
        """读取 profile.yaml 元数据（description 等）"""
        content = self._read_file(self.get_agent_dir(name), "profile.yaml")
        if not content:
            return {"description": "", "description_auto": False}
        try:
            data = yaml.safe_load(content) or {}
        except Exception:
            data = {}
        return {
            "description": str(data.get("description") or "").strip(),
            "description_auto": bool(data.get("description_auto", False)),
        }

    def _read_avatar(self, name: str) -> str:
        """读取智能体头像的相对路径（存在时），不存在返回空字符串"""
        agent_dir = self.get_agent_dir(name)
        for ext in AVATAR_TYPES:
            if (agent_dir / f"avatar{ext}").is_file():
                return f"avatar{ext}"
        return ""

    def get_avatar(self, name: str):
        """
        获取智能体头像文件

        Returns:
            tuple: (文件路径, media_type)，头像不存在时返回 (None, None)
        """
        self._check_agent_exists(name)
        relative = self._read_avatar(name)
        if not relative:
            return None, None
        path = self.get_agent_dir(name) / relative
        return path, AVATAR_TYPES[path.suffix.lower()]

    def save_avatar(self, name: str, filename: str, content: bytes) -> dict:
        """
        保存智能体头像（写入智能体目录，统一命名为 avatar.<ext>，覆盖旧头像）

        Args:
            name: 智能体名称
            filename: 原始文件名（用于扩展名校验）
            content: 文件二进制内容
        """
        self._check_agent_exists(name)
        ext = Path(filename).suffix.lower() if filename else ""
        if ext not in AVATAR_TYPES:
            raise HermesAgentError(
                f"不支持的头像格式：{ext or '未知'}（支持 {'/'.join(AVATAR_TYPES)}）")
        if len(content) > AVATAR_MAX_SIZE:
            raise HermesAgentError("头像文件大小不能超过 5MB")

        agent_dir = self.get_agent_dir(name)
        # 删除其他扩展名的旧头像，避免残留
        for old_ext in AVATAR_TYPES:
            old = agent_dir / f"avatar{old_ext}"
            if old.is_file() and old_ext != ext:
                old.unlink(missing_ok=True)

        target = agent_dir / f"avatar{ext}"
        target.write_bytes(content)
        return {"name": name, "avatar": f"avatar{ext}", "size": len(content)}

    def delete_avatar(self, name: str) -> dict:
        """删除智能体头像"""
        self._check_agent_exists(name)
        agent_dir = self.get_agent_dir(name)
        for ext in AVATAR_TYPES:
            (agent_dir / f"avatar{ext}").unlink(missing_ok=True)
        return {"name": name, "avatar": ""}

    def get_agent(self, name: str) -> dict:
        """
        获取智能体基本信息（含统计信息与模型配置）
        """
        self._check_agent_exists(name)
        meta = self._read_profile_meta(name)
        agent_dir = self.get_agent_dir(name)
        stats = self._get_agent_stats(agent_dir)
        return {
            "name": name,
            "is_default": name == DEFAULT_AGENT_NAME,
            "path": str(agent_dir),
            "description": meta.get("description", ""),
            "model": self._read_model(name),
            "avatar": self._read_avatar(name),
            "soul": self._read_soul(name) or "",
            "memory": self._read_memory(name) or "",
            "user_profile": self._read_user(name) or "",
            "created_at": stats["created_at"],
            "updated_at": stats["updated_at"],
            "skill_count": stats["skill_count"],
            "tool_count": self._get_tool_count(agent_dir),
        }

    def _read_model_config(self, name: str) -> dict:
        """读取 config.yaml 模型配置（provider/model 及其余字段）"""
        content = self._read_file(self.get_agent_dir(name), "config.yaml")
        if not content:
            return {}
        try:
            data = yaml.safe_load(content) or {}
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    def _read_model(self, name: str) -> str:
        """从 config.yaml 读取模型名称（顶层 model 或 model.default）"""
        data = self._read_model_config(name)
        if not data:
            return ""
        if isinstance(data.get("model"), dict):
            return str(data["model"].get("default") or "")
        return str(data.get("model") or "")

    def get_model_config(self, name: str) -> dict:
        """
        获取智能体模型配置

        返回 config.yaml 中与模型相关的配置：model/api_key/url 等，
        读取 hermes CLI 规范的 model.default / model.api_key / model.base_url
        """
        self._check_agent_exists(name)
        data = self._read_model_config(name)
        model = data.get("model")
        if isinstance(model, dict):
            model_id = str(model.get("default") or "")
            api_key = str(model.get("api_key") or "")
            url = str(model.get("base_url") or model.get("api_base") or "")
        else:
            model_id = str(model or "")
            api_key = ""
            url = str(data.get("base_url") or data.get("api_base") or "")
        return {
            "model": model_id,
            "api_key": api_key,
            "url": url,
            "raw": data,
        }

    def update_model_config(self, name: str, model: Optional[str] = None,
                            api_key: Optional[str] = None, url: Optional[str] = None) -> dict:
        """
        更新智能体模型配置（读写 config.yaml）

        仅更新传入的字段，保留 config.yaml 中的其余配置；
        统一按 OpenAI 兼容模式存储（provider 固定 openai，
        模型配置写入 hermes CLI 规范的 model.* 结构）
        """
        self._check_agent_exists(name)
        data = self._read_model_config(name)
        # 兼容顶层 model 为字符串的情况，统一转为 dict 结构
        model_cfg = data.get("model")
        if not isinstance(model_cfg, dict):
            model_cfg = {"default": model_cfg} if model_cfg else {}
        if model is not None:
            model_cfg["default"] = model
        if api_key is not None:
            if api_key:
                model_cfg["api_key"] = api_key
            else:
                model_cfg.pop("api_key", None)
        if url is not None:
            if url:
                model_cfg["base_url"] = url
                model_cfg.pop("api_base", None)
            else:
                model_cfg.pop("base_url", None)
                model_cfg.pop("api_base", None)
        data["model"] = model_cfg
        data["provider"] = "openai"
        # 清理根级旧字段（hermes CLI 会将其迁移到 model.* 下，避免重复）
        data.pop("api_base", None)

        target = self.get_agent_dir(name) / "config.yaml"
        target.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return self.get_model_config(name)

    def list_skills(self, name: str) -> list:
        """
        获取智能体技能列表（按分类分组数据源）

        技能目录为两级结构 skills/<category>/<skill>/SKILL.md，
        直接扫描文件系统读取（profile 下 CLI 不返回 builtin 技能，且需要分类信息）；
        SKILL.md 的 frontmatter 中解析 name/description 作为展示信息。
        """
        self._check_agent_exists(name)
        skills = []
        skills_dir = self.get_agent_dir(name) / "skills"
        if not skills_dir.is_dir():
            return skills

        for skill_md in sorted(skills_dir.rglob("SKILL.md")):
            # .hub 为技能市场索引缓存，跳过
            if ".hub" in skill_md.parts:
                continue
            rel = skill_md.relative_to(skills_dir)
            if len(rel.parts) != 3:
                continue
            category, skill_name, _ = rel.parts
            meta = self._parse_skill_meta(skill_md)
            skills.append({
                "name": meta.get("name") or skill_name,
                "dir_name": skill_name,
                "category": category,
                "description": meta.get("description", ""),
                "source": "local",
                "trust": "",
                "status": "enabled",
            })
        return skills

    @staticmethod
    def _parse_skill_meta(skill_md: Path) -> dict:
        """解析 SKILL.md 的 YAML frontmatter（name/description），解析失败返回空"""
        try:
            content = skill_md.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return {}
        m = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
        if not m:
            return {}
        try:
            data = yaml.safe_load(m.group(1)) or {}
        except Exception:
            return {}
        if not isinstance(data, dict):
            return {}
        return {
            "name": str(data.get("name") or "").strip(),
            "description": str(data.get("description") or "").strip(),
        }

    def list_tools(self, name: str) -> list:
        """
        获取智能体工具集列表

        通过 HERMES_HOME 指向智能体目录执行 hermes tools list；
        名称/描述/子工具从 CLI 的 CONFIGURABLE_TOOLSETS 注册表补全。
        """
        self._check_agent_exists(name)
        agent_dir = self.get_agent_dir(name)
        try:
            output = self.run_hermes(["tools", "list"], home=str(agent_dir), timeout=30)
        except HermesAgentError:
            return []

        # 工具集注册表：key -> (label, sub_tools 描述)
        registry: dict = {}
        try:
            from hermes_cli.tools_config import CONFIGURABLE_TOOLSETS
            registry = {key: (label, subs) for key, label, subs in CONFIGURABLE_TOOLSETS}
        except Exception:
            registry = {}

        tools = []
        # 行格式： "✓ enabled  web  🔍 Web Search & Scraping" 或 "✗ disabled  video  🎬 Video Analysis"
        for line in output.splitlines():
            stripped = line.strip()
            m = re.match(r"^[✓✗]\s+(enabled|disabled)\s+(\S+)\s+(.*)$", stripped)
            if not m:
                continue
            enabled = m.group(1) == "enabled"
            tool_key = m.group(2)
            tools.append({
                "name": tool_key,
                "description": m.group(3).strip(),
                "enabled": enabled,
                "sub_tools": registry.get(tool_key, ("", ""))[1],
            })
        return tools

    # ==================== 文件内容读写 ====================

    def read_file(self, name: str, file_type: str) -> str:
        """
        读取智能体文件内容

        Args:
            name: 智能体名称
            file_type: 文件类型 soul / memory / user
        """
        self._check_agent_exists(name)
        readers = {
            "soul": self._read_soul,
            "memory": self._read_memory,
            "user": self._read_user,
        }
        reader = readers.get(file_type)
        if not reader:
            raise HermesAgentError(f"不支持的文件类型：{file_type}")
        return reader(name) or ""

    def write_file(self, name: str, file_type: str, content: str) -> dict:
        """
        写入智能体文件内容

        Args:
            name: 智能体名称
            file_type: 文件类型 soul / memory / user
            content: 文件内容
        """
        self._check_agent_exists(name)
        paths = {
            "soul": "SOUL.md",
            "memory": "memories/MEMORY.md",
            "user": "memories/USER.md",
        }
        relative = paths.get(file_type)
        if not relative:
            raise HermesAgentError(f"不支持的文件类型：{file_type}")

        target = self.get_agent_dir(name) / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"name": name, "file_type": file_type, "size": len(content)}

    # ==================== 技能文件管理 ====================

    def _resolve_skill_path(self, name: str, category: str, skill: str, relative: str) -> Path:
        """
        解析技能内文件路径并校验安全（不允许越出技能目录）

        Args:
            name: 智能体名称
            category: 技能分类（skills 下的一级目录名）
            skill: 技能目录名（分类下的二级目录名）
            relative: 技能目录内的相对路径
        """
        self._check_agent_exists(name)
        skill_root = self.get_agent_dir(name) / "skills" / category / skill
        if not skill_root.is_dir():
            raise ResourceNotFoundError(f"技能 {category}/{skill} 不存在")
        if not relative:
            raise HermesAgentError("文件路径不能为空")
        # 根目录（"."）解析为技能根目录本身
        normalized = relative.replace("\\", "/").strip("/")
        if normalized in (".", ""):
            return skill_root.resolve()
        # 统一为 posix 风格再拼接，防止 Windows 反斜杠注入
        target = (skill_root / normalized).resolve()
        if not str(target).startswith(str(skill_root.resolve()) + os.sep):
            raise HermesAgentError(f"非法的文件路径：{relative}")
        return target

    def get_skill_tree(self, name: str, category: str, skill: str) -> dict:
        """
        获取技能文件目录树

        Returns:
            dict: { tree: [...], skill_md: "SKILL.md 相对路径或空" }
        """
        self._check_agent_exists(name)
        skill_root = self.get_agent_dir(name) / "skills" / category / skill
        if not skill_root.is_dir():
            raise ResourceNotFoundError(f"技能 {category}/{skill} 不存在")

        def build(node: Path) -> dict:
            children = []
            if node.is_dir():
                for child in sorted(node.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
                    # 跳过隐藏文件与缓存
                    if child.name.startswith("."):
                        continue
                    children.append(build(child))
                return {
                    "name": node.name,
                    "path": node.relative_to(skill_root).as_posix(),
                    "is_dir": True,
                    "children": children,
                }
            return {
                "name": node.name,
                "path": node.relative_to(skill_root).as_posix(),
                "is_dir": False,
                "children": [],
            }

        tree = build(skill_root)
        skill_md_rel = "SKILL.md" if (skill_root / "SKILL.md").is_file() else ""
        return {"tree": tree, "skill_md": skill_md_rel}

    def read_skill_file(self, name: str, category: str, skill: str, relative: str) -> dict:
        """读取技能内文件内容（文本，含最近更新时间）"""
        target = self._resolve_skill_path(name, category, skill, relative)
        if not target.is_file():
            raise ResourceNotFoundError(f"文件不存在：{relative}")
        try:
            content = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            raise HermesAgentError("仅支持读取文本文件")
        return {
            "path": relative,
            "content": content,
            "size": target.stat().st_size,
            "updated_at": self._format_ts(target.stat().st_mtime),
        }

    def write_skill_file(self, name: str, category: str, skill: str, relative: str, content: str) -> dict:
        """写入技能内文件内容（文本，SKILL.md 允许编辑）"""
        target = self._resolve_skill_path(name, category, skill, relative)
        if not target.is_file():
            raise ResourceNotFoundError(f"文件不存在：{relative}")
        target.write_text(content, encoding="utf-8")
        return {"path": relative, "size": len(content)}

    def create_skill_dir(self, name: str, category: str, skill: str, relative: str) -> dict:
        """在技能目录内新建文件夹（已存在时报错）"""
        target = self._resolve_skill_path(name, category, skill, relative)
        if target.exists():
            raise HermesAgentError(f"目录已存在：{relative}")
        target.mkdir(parents=True, exist_ok=True)
        return {"path": relative, "created": True}

    def upload_skill_files(self, name: str, category: str, skill: str, relative: str,
                           files: list) -> dict:
        """
        上传文件（支持多文件，按 webkitRelativePath 保留文件夹结构）

        Args:
            relative: 目标目录（技能内相对路径，根目录传空串）
            files: [(filename, relative_in_upload, content_bytes), ...]
        """
        base = self._resolve_skill_path(name, category, skill, relative)
        if not base.is_dir():
            raise ResourceNotFoundError(f"目标目录不存在：{relative}")
        saved = []
        for filename, rel_in_upload, content in files:
            if not filename:
                continue
            # 上传文件夹时按相对路径还原目录结构，仅取文件名部分做安全校验
            rel_parts = [p for p in rel_in_upload.replace("\\", "/").split("/") if p and p not in (".", "..")]
            target = (base / Path(*rel_parts) if rel_parts else base / filename).resolve()
            if not str(target).startswith(str(base.resolve()) + os.sep):
                raise HermesAgentError(f"非法的上传路径：{rel_in_upload or filename}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            saved.append(str(target.relative_to(base)))
        return {"saved": saved, "count": len(saved)}

    def delete_skill_node(self, name: str, category: str, skill: str, relative: str) -> dict:
        """删除技能内文件或目录（根目录与 SKILL.md 不允许删除）"""
        normalized = relative.replace("\\", "/").strip("/")
        if normalized in (".", ""):
            raise HermesAgentError("技能根目录不允许删除")
        if normalized == "SKILL.md":
            raise HermesAgentError("SKILL.md 为技能入口文件，不允许删除")
        target = self._resolve_skill_path(name, category, skill, relative)
        if not target.exists():
            raise ResourceNotFoundError(f"路径不存在：{relative}")
        if target.is_dir():
            import shutil
            shutil.rmtree(target)
        else:
            target.unlink()
        return {"path": relative, "deleted": True}

    def rename_skill_node(self, name: str, category: str, skill: str, relative: str, new_name: str) -> dict:
        """
        重命名技能内文件或目录（根目录与 SKILL.md 不允许重命名）

        Args:
            relative: 技能内相对路径
            new_name: 新名称（仅名称部分，不含路径）
        """
        normalized = relative.replace("\\", "/").strip("/")
        if normalized in (".", ""):
            raise HermesAgentError("技能根目录不允许重命名")
        if normalized == "SKILL.md":
            raise HermesAgentError("SKILL.md 为技能入口文件，不允许重命名")
        new_name = (new_name or "").strip()
        if not new_name:
            raise HermesAgentError("新名称不能为空")
        # 名称不允许包含路径分隔符，防止移动到其他目录
        if "/" in new_name or "\\" in new_name or new_name in (".", ".."):
            raise HermesAgentError(f"新名称不合法：{new_name}")
        target = self._resolve_skill_path(name, category, skill, relative)
        if not target.exists():
            raise ResourceNotFoundError(f"路径不存在：{relative}")
        new_target = target.parent / new_name
        if new_target.exists():
            raise HermesAgentError(f"同名路径已存在：{new_name}")
        target.rename(new_target)
        return {
            "path": relative,
            "new_path": new_target.relative_to(self._resolve_skill_path(name, category, skill, ".")).as_posix(),
            "renamed": True,
        }
