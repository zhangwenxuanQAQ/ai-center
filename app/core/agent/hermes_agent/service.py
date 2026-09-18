"""
Hermes 智能体服务类

封装 hermes CLI 的调用，提供智能体（Profile）的管理与详情数据读取。
所有管理操作（增删改查）均通过 subprocess 调用官方 CLI 完成；
文件内容（SOUL.md / MEMORY.md / USER.md）直接读写 profile 目录。
"""

import asyncio
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

import yaml

from app.configs.config import config
from app.core.exceptions import ResourceNotFoundError

# 默认智能体名称（hermes_home 根目录即 default，不可删除）
DEFAULT_AGENT_NAME = "default"

# 控制台会话来源标识（写入 state.db 的 sessions.source）
CONVERSATION_SOURCE = "aicenter"

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

    def _list_toolsets_inproc(self, agent_dir: Path):
        """
        进程内解析智能体的工具集列表（避免 CLI 子进程冷启动开销约 2s/次）

        与 hermes CLI `tools list` 输出保持一致：
        有效可配置工具集（built-in + plugin）按 platform 过滤，
        enabled 通过 _get_platform_tools 解析 config.yaml 得到。

        Returns:
            list[dict]: [{"name", "description", "enabled", "sub_tools"}, ...]，异常时返回 None
        """
        try:
            from hermes_cli.tools_config import (
                _get_effective_configurable_toolsets,
                _get_platform_tools,
                _toolset_allowed_for_platform,
            )
        except ImportError:
            return None

        try:
            with self._with_agent_home(agent_dir):
                from hermes_cli.config import load_config
                config = load_config()

                # 与 CLI tools list 一致：统一按 cli 平台过滤与解析 enabled
                platform = "cli"
                enabled_toolsets = set(
                    _get_platform_tools(
                        config, platform, include_default_mcp_servers=False
                    )
                )
                tools = [
                    {
                        "name": ts_key,
                        "description": label,
                        "enabled": ts_key in enabled_toolsets,
                        "sub_tools": subs,
                    }
                    for ts_key, label, subs in _get_effective_configurable_toolsets()
                    if _toolset_allowed_for_platform(ts_key, platform)
                ]
                return tools
        except Exception:
            return None

    def _get_tool_count(self, agent_dir: Path) -> int:
        """
        统计智能体工具集数量（进程内解析，与 list_tools 逻辑一致）

        解析失败时降级为 0（不影响列表展示）
        """
        tools = self._list_toolsets_inproc(agent_dir)
        return len(tools) if tools is not None else 0

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

    @contextmanager
    def _with_agent_home(self, agent_dir):
        """
        临时将 HERMES_HOME 指向智能体目录的上下文管理器

        使 hermes_cli 的进程内调用（load_config/list_profiles 等）
        读写该智能体的 config.yaml 等文件，结束后恢复原值。
        """
        env_backup = os.environ.get("HERMES_HOME")
        os.environ["HERMES_HOME"] = str(agent_dir)
        try:
            yield
        finally:
            if env_backup is None:
                os.environ.pop("HERMES_HOME", None)
            else:
                os.environ["HERMES_HOME"] = env_backup


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

        进程内直接调用 hermes_cli.profiles.list_profiles（避免 CLI 子进程
        冷启动开销约 2s/次）；CLI 模块不可用时降级为目录扫描。
        active 状态读取 hermes root 的 active_profile 文件。
        """
        try:
            from hermes_cli import profiles as hermes_profiles
        except ImportError:
            return self._list_agents_from_fs()

        with self._with_agent_home(self.hermes_home):
            try:
                infos = hermes_profiles.list_profiles()
                try:
                    active_name = hermes_profiles.get_active_profile()
                except Exception:
                    active_name = ""
            except Exception:
                # CLI 内部异常时降级为目录扫描
                return self._list_agents_from_fs()

        return [
            self._build_agent_summary(info.name, info.name == active_name)
            for info in infos
        ]

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
        SKILL.md 的 frontmatter 中解析 name/description 作为展示信息，
        停用状态读取 config.yaml 的 skills.disabled（按技能名称匹配）。
        """
        self._check_agent_exists(name)
        skills = []
        skills_dir = self.get_agent_dir(name) / "skills"
        if not skills_dir.is_dir():
            return skills

        disabled = self._get_disabled_skills(name)
        for skill_md in sorted(skills_dir.rglob("SKILL.md")):
            # .hub 为技能市场索引缓存，跳过
            if ".hub" in skill_md.parts:
                continue
            rel = skill_md.relative_to(skills_dir)
            if len(rel.parts) != 3:
                continue
            category, dir_name, _ = rel.parts
            meta = self._parse_skill_meta(skill_md)
            display_name = meta.get("name") or dir_name
            try:
                # ctime 在 Windows 为创建时间，Linux 为 inode 变更时间，均作近似
                created_at = skill_md.stat().st_ctime
            except OSError:
                created_at = 0.0
            skills.append({
                "name": display_name,
                "dir_name": dir_name,
                "category": category,
                "description": meta.get("description", ""),
                "source": "local",
                "trust": "",
                "status": "disabled" if display_name in disabled else "enabled",
                "created_at": self._format_ts(created_at),
            })
        # 按创建时间倒序（新创建的排前面），无时间的按名称排后面
        skills.sort(key=lambda s: (s.get("created_at") or "", s.get("name") or ""), reverse=True)
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
        获取智能体工具集列表（进程内解析，与 CLI tools list 输出一致）

        失败/模块不可用时返回空列表。
        """
        self._check_agent_exists(name)
        tools = self._list_toolsets_inproc(self.get_agent_dir(name))
        return tools if tools is not None else []

    # ==================== 技能/工具停用启用 ====================

    @staticmethod
    def _normalize_skill_names(values) -> set:
        """将配置值规范化为技能名称集合（None=空，标量=单项）"""
        if values is None:
            return set()
        if isinstance(values, str):
            values = [values]
        try:
            return {str(v).strip() for v in values if str(v).strip()}
        except TypeError:
            return set()

    def _get_disabled_skills(self, name: str) -> set:
        """读取 config.yaml 的 skills.disabled（全局停用列表）"""
        data = self._read_model_config(name)
        skills_cfg = data.get("skills") or {}
        if not isinstance(skills_cfg, dict):
            return set()
        return self._normalize_skill_names(skills_cfg.get("disabled"))

    def toggle_skill(self, name: str, category: str, skill_dir: str, enabled: bool) -> dict:
        """
        停用/启用技能（读写 config.yaml 的 skills.disabled）

        停用列表按 SKILL.md frontmatter 中的技能名称（展示名）匹配，
        与 hermes CLI 的 get_disabled_skills 机制保持一致。
        """
        self._check_agent_exists(name)
        skill_root = self.get_agent_dir(name) / "skills" / category / skill_dir
        if not skill_root.is_dir():
            raise ResourceNotFoundError(f"技能 {category}/{skill_dir} 不存在")
        meta = self._parse_skill_meta(skill_root / "SKILL.md")
        display_name = meta.get("name") or skill_dir

        data = self._read_model_config(name)
        skills_cfg = data.setdefault("skills", {})
        if not isinstance(skills_cfg, dict):
            skills_cfg = {}
            data["skills"] = skills_cfg
        disabled = self._normalize_skill_names(skills_cfg.get("disabled"))
        if enabled:
            disabled.discard(display_name)
        else:
            disabled.add(display_name)
        skills_cfg["disabled"] = sorted(disabled)

        target = self.get_agent_dir(name) / "config.yaml"
        target.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return {"name": display_name, "enabled": enabled}

    def toggle_tool(self, name: str, tool_name: str, enabled: bool) -> dict:
        """
        停用/启用工具集（读写 config.yaml 的 platform_toolsets）

        与 hermes CLI / 官方 Web 端的 tools toggle 机制保持一致：
        通过 _get_platform_tools 读取当前启用集合（含平台默认展开），
        增删目标工具后经 _save_platform_tools 写回（保留 MCP 条目等）。
        """
        self._check_agent_exists(name)
        try:
            from hermes_cli.tools_config import (
                _get_effective_configurable_toolsets,
                _get_platform_tools,
                _save_platform_tools,
                _toolset_configuration_platform,
            )
        except ImportError as e:
            raise HermesAgentError(f"hermes CLI 模块不可用：{e}")

        valid = {ts_key for ts_key, _, _ in _get_effective_configurable_toolsets()}
        if tool_name not in valid:
            raise HermesAgentError(f"未知的工具集：{tool_name}")

        agent_dir = self.get_agent_dir(name)
        # HERMES_HOME 指向智能体目录，使 load_config/save_config 读写其 config.yaml
        with self._with_agent_home(agent_dir):
            from hermes_cli.config import load_config
            data = load_config()
            platform = _toolset_configuration_platform(tool_name)
            enabled_set = set(
                _get_platform_tools(data, platform, include_default_mcp_servers=False)
            )
            if enabled:
                enabled_set.add(tool_name)
            else:
                enabled_set.discard(tool_name)
            _save_platform_tools(data, platform, enabled_set)
        return {"name": tool_name, "enabled": enabled}

    # ==================== 技能新增/删除 ====================

    # 技能目录名规则（与 hermes CLI 的 VALID_NAME_RE 一致）
    SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]*$")

    def create_skill(self, name: str, skill_dir: str, category: str, description: str) -> dict:
        """
        新增技能（创建 skills/<category>/<skill_dir>/SKILL.md）

        目录名按 hermes CLI 规则校验（小写字母、数字、点、下划线、连字符）；
        SKILL.md 写入 name/description frontmatter 与正文模板。
        """
        self._check_agent_exists(name)
        skill_dir = (skill_dir or "").strip()
        if not skill_dir:
            raise HermesAgentError("技能名称不能为空")
        if len(skill_dir) > 64:
            raise HermesAgentError("技能名称超过 64 个字符")
        if not self.SKILL_NAME_PATTERN.match(skill_dir):
            raise HermesAgentError(
                f"技能名称不合法：{skill_dir}（仅允许小写字母、数字、点、下划线、连字符，且以字母或数字开头）"
            )
        category = (category or "").strip()
        if category:
            if "/" in category or "\\" in category:
                raise HermesAgentError("技能分类必须是单个目录名")
            if len(category) > 64 or not self.SKILL_NAME_PATTERN.match(category):
                raise HermesAgentError(
                    f"技能分类不合法：{category}（仅允许小写字母、数字、点、下划线、连字符）"
                )

        skill_root = self.get_agent_dir(name) / "skills" / (category or "custom") / skill_dir
        if skill_root.exists():
            raise HermesAgentError(f"同名技能已存在：{(category or 'custom')}/{skill_dir}")

        description = (description or "").strip()
        skill_md = [
            "---",
            f"name: {skill_dir}",
            f"description: {description or skill_dir}",
            "---",
            "",
            f"# {skill_dir}",
            "",
            description or "在此编写技能的具体指令与流程。",
            "",
        ]
        skill_root.mkdir(parents=True, exist_ok=True)
        (skill_root / "SKILL.md").write_text("\n".join(skill_md), encoding="utf-8")
        return {
            "name": skill_dir,
            "dir_name": skill_dir,
            "category": category or "custom",
            "description": description,
        }

    def delete_skill(self, name: str, category: str, skill_dir: str) -> dict:
        """删除技能目录（含停用列表清理）"""
        self._check_agent_exists(name)
        skill_root = self.get_agent_dir(name) / "skills" / category / skill_dir
        if not skill_root.is_dir():
            raise ResourceNotFoundError(f"技能 {category}/{skill_dir} 不存在")
        meta = self._parse_skill_meta(skill_root / "SKILL.md")
        display_name = meta.get("name") or skill_dir

        import shutil
        shutil.rmtree(skill_root)
        # 清理空的分类目录
        category_dir = skill_root.parent
        if category_dir.parent.name == "skills" and category_dir.exists() and not any(category_dir.iterdir()):
            category_dir.rmdir()
        # 从停用列表移除已删除的技能名
        data = self._read_model_config(name)
        skills_cfg = data.get("skills")
        if isinstance(skills_cfg, dict):
            disabled = self._normalize_skill_names(skills_cfg.get("disabled"))
            if display_name in disabled:
                disabled.discard(display_name)
                skills_cfg["disabled"] = sorted(disabled)
                target = self.get_agent_dir(name) / "config.yaml"
                target.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return {"name": display_name, "category": category, "deleted": True}

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

    # ==================== 对话（官方 SDK） ====================

    def _resolve_agent_runtime(self, name: str) -> dict:
        """
        解析智能体运行时（provider/base_url/api_key/api_mode）

        优先使用智能体自身 config.yaml 的模型凭据；子 profile 未配置凭据时
        继承 default 的凭据（模型名称仍使用子 profile 自身的），
        最终通过官方 SDK resolve_runtime_provider 得到运行时配置。
        """
        from hermes_cli.runtime_provider import resolve_runtime_provider

        model_cfg = self.get_model_config(name)
        model = model_cfg.get("model") or ""
        api_key = model_cfg.get("api_key") or ""
        url = model_cfg.get("url") or ""

        # 子 profile 缺少凭据时继承 default
        if (not api_key or not url) and name != DEFAULT_AGENT_NAME:
            fallback = self.get_model_config(DEFAULT_AGENT_NAME)
            api_key = api_key or fallback.get("api_key") or ""
            url = url or fallback.get("url") or ""
            if not model:
                model = fallback.get("model") or ""

        if not url or not api_key:
            raise HermesAgentError(f"智能体 {name} 未配置模型凭据（api_key/base_url），请先完成模型配置")

        with self._with_agent_home(self.get_agent_dir(name)):
            runtime = resolve_runtime_provider(
                requested="custom",
                target_model=model or None,
                explicit_base_url=url,
                explicit_api_key=api_key,
            )
        return runtime

    def _get_platform_config(self, name: str) -> dict:
        """读取智能体平台配置（用于构建 AIAgent）"""
        from hermes_cli.config import load_config
        from hermes_cli.fallback_config import get_fallback_chain
        from hermes_cli.tools_config import _get_platform_tools

        with self._with_agent_home(self.get_agent_dir(name)):
            cfg = load_config()
            toolsets = sorted(_get_platform_tools(cfg, "cli"))
            fallback = get_fallback_chain(cfg)
        return {"config": cfg, "toolsets": toolsets, "fallback": fallback}

    def _open_conversation_db(self, name: str) -> "object":
        """打开智能体会话数据库（state.db，不存在时创建）"""
        from hermes_state import SessionDB

        db_path = self.get_agent_dir(name) / "state.db"
        return SessionDB(db_path=db_path)

    def create_conversation(self, name: str, title: Optional[str] = None) -> dict:
        """
        新建对话

        生成会话 id 并写入智能体的 state.db，返回会话基本信息。
        """
        self._check_agent_exists(name)
        session_id = f"api_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        model = self.get_model_config(name).get("model") or ""
        db = self._open_conversation_db(name)
        try:
            db.create_session(
                session_id=session_id,
                source=CONVERSATION_SOURCE,
                model=model or None,
                profile_name=name,
                cwd=str(self.get_agent_dir(name)),
            )
            if title:
                db.set_session_title(session_id, title)
        finally:
            db.close()
        return {
            "session_id": session_id,
            "title": title or "新对话",
            "model": model,
            "agent": name,
        }

    def list_conversations(self, name: str, limit: int = 20, offset: int = 0,
                           search: Optional[str] = None) -> dict:
        """
        查询会话列表

        按最近活跃时间倒序返回智能体的会话（含标题、消息数、预览）。
        """
        self._check_agent_exists(name)
        db_path = self.get_agent_dir(name) / "state.db"
        if not db_path.exists():
            return {"data": [], "total": 0}
        db = self._open_conversation_db(name)
        try:
            sessions = db.list_sessions_rich(
                source=CONVERSATION_SOURCE,
                limit=limit,
                offset=offset,
                order_by_last_active=True,
                search_query=search or None,
                compact_rows=True,
            )
        finally:
            db.close()
        data = [
            {
                "session_id": item.get("id"),
                "title": item.get("title") or item.get("preview") or "新对话",
                "preview": item.get("preview") or "",
                "model": item.get("model") or "",
                "message_count": item.get("message_count") or 0,
                "started_at": item.get("started_at"),
                "last_active": item.get("last_active"),
            }
            for item in sessions
        ]
        return {"data": data, "total": len(data)}

    def get_conversation_messages(self, name: str, session_id: str,
                                  limit: Optional[int] = None, offset: int = 0) -> dict:
        """
        查询会话历史消息

        返回指定会话的消息列表（仅 user/assistant 展示用内容）。
        """
        self._check_agent_exists(name)
        db_path = self.get_agent_dir(name) / "state.db"
        if not db_path.exists():
            return {"data": [], "total": 0}
        db = self._open_conversation_db(name)
        try:
            resolved = db.resolve_session_id(session_id) or session_id
            messages = db.get_messages(resolved, limit=limit, offset=offset)
        finally:
            db.close()
        data = [
            {
                "id": msg.get("id"),
                "role": msg.get("role"),
                "content": msg.get("content") or "",
                "timestamp": msg.get("timestamp"),
            }
            for msg in messages
            if msg.get("role") in ("user", "assistant")
        ]
        return {"data": data, "total": len(data)}

    def delete_conversation(self, name: str, session_id: str) -> dict:
        """删除对话（同时删除其历史消息与磁盘记录）"""
        self._check_agent_exists(name)
        db = self._open_conversation_db(name)
        try:
            resolved = db.resolve_session_id(session_id) or session_id
            deleted = db.delete_session(resolved, sessions_dir=self.get_agent_dir(name) / "sessions")
        finally:
            db.close()
        if not deleted:
            raise ResourceNotFoundError(f"会话不存在：{session_id}")
        return {"session_id": session_id, "deleted": True}

    def chat_stream(self, name: str, session_id: str,
                    message: str) -> Generator[str, None, None]:
        """
        流式对话（使用官方 SDK AIAgent 运行，逐段返回模型输出）

        工作线程内运行 AIAgent（SDK 内部为同步阻塞调用），
        通过队列将增量文本实时传回当前生成器，实现 SSE 流式输出。
        """
        self._check_agent_exists(name)
        if not message or not message.strip():
            raise HermesAgentError("消息内容不能为空")

        runtime = self._resolve_agent_runtime(name)
        platform_cfg = self._get_platform_config(name)
        model = self.get_model_config(name).get("model") or ""

        agent_dir = self.get_agent_dir(name)
        chunk_queue: "queue.Queue" = queue.Queue()
        done_marker = object()
        error_box: list = []

        with self._with_agent_home(agent_dir):
            from run_agent import AIAgent

            db = self._open_conversation_db(name)
            resolved = db.resolve_session_id(session_id) or session_id
            history = db.get_messages_as_conversation(resolved, repair_alternation=True)

            agent = AIAgent(
                api_key=runtime.get("api_key"),
                base_url=runtime.get("base_url"),
                provider=runtime.get("provider"),
                api_mode=runtime.get("api_mode"),
                model=model,
                enabled_toolsets=platform_cfg["toolsets"],
                quiet_mode=True,
                platform="cli",
                session_db=db,
                session_id=resolved,
                credential_pool=runtime.get("credential_pool"),
                fallback_model=platform_cfg["fallback"] or None,
                clarify_callback=self._chat_clarify_callback,
            )
            # 静默运行，仅通过 stream_callback 输出文本增量
            agent.suppress_status_output = True
            agent.stream_delta_callback = None
            agent.tool_gen_callback = None

            def _on_delta(text):
                if text:
                    chunk_queue.put(text)

            def _worker():
                try:
                    result = agent.run_conversation(
                        user_message=message,
                        conversation_history=history or None,
                        stream_callback=_on_delta,
                    )
                    # SDK 运行失败时不抛异常，而是返回 failed 标记，需显式转为异常
                    if isinstance(result, dict) and result.get("failed"):
                        detail = (
                            result.get("error")
                            or result.get("failure_reason")
                            or result.get("final_response")
                            or "未知错误"
                        )
                        error_box.append(HermesAgentError(str(detail)))
                except Exception as exc:  # noqa: BLE001
                    error_box.append(exc)
                finally:
                    chunk_queue.put(done_marker)

            worker = threading.Thread(target=_worker, daemon=True)
            worker.start()

            try:
                while True:
                    chunk = chunk_queue.get()
                    if chunk is done_marker:
                        break
                    yield chunk
            finally:
                worker.join(timeout=5)
                try:
                    session_messages = getattr(agent, "_session_messages", None)
                    if isinstance(session_messages, list):
                        agent.shutdown_memory_provider(session_messages)
                    else:
                        agent.shutdown_memory_provider()
                except Exception:
                    pass
                try:
                    agent.close()
                except Exception:
                    pass
                db.close()

        if error_box:
            raise HermesAgentError(f"对话执行失败：{error_box[0]}")

    @staticmethod
    def _chat_clarify_callback(question: str, choices=None) -> str:
        """澄清回调：无交互终端时让智能体自行决策并继续"""
        if choices:
            return (
                f"[控制台模式：无用户可交互。请从 {choices} 中选择最合适的选项并继续。]"
            )
        return "[控制台模式：无用户可交互。请做出最合理的假设并继续。]"
