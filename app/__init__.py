"""
AI Center 应用初始化模块
提供系统名称、版本等全局信息
"""

import os
from pathlib import Path
from typing import Tuple


def _get_project_info() -> Tuple[str, str, str]:
    """
    从 pyproject.toml 获取项目信息

    Returns:
        Tuple[str, str, str]: (名称, 描述, 版本)
    """
    try:
        import tomllib

        project_root = Path(__file__).parent.parent
        pyproject_path = project_root / "pyproject.toml"

        if pyproject_path.exists():
            with open(pyproject_path, "rb") as f:
                data = tomllib.load(f)
                project = data.get("project", {})
                name = project.get("name", "AI Center")
                description = project.get("description", "大模型AI服务中心")
                version = project.get("version", "0.1.0")
                return name, description, version
    except Exception:
        pass

    # 默认值
    return "AI Center", "大模型AI服务中心", "0.1.0"


def get_system_name() -> str:
    """获取系统名称"""
    return _PROJECT_NAME


def get_system_description() -> str:
    """获取系统描述"""
    return _PROJECT_DESCRIPTION


def get_system_version() -> str:
    """获取系统版本"""
    return _PROJECT_VERSION


def get_banner() -> str:
    """
    获取系统启动 Banner

    Returns:
        str: ASCII艺术Banner
    """
    banner = r"""
            _____    _____ ______ _   _ _______ ______ _____
      /\   |_   _|  / ____|  ____| \ | |__   __|  ____|  __ \
     /  \    | |   | |    | |__  |  \| |  | |  | |__  | |__) |
    / /\ \   | |   | |    |  __| | . ` |  | |  |  __| |  _  /
   / ____ \ _| |_  | |____| |____| |\  |  | |  | |____| | \ \
  /_/    \_\_____|  \_____|______|_| \_|  |_|  |______|_|  \_\


  名称: {name}
  版本: {version}
  描述: {description}
""".format(name=_PROJECT_NAME, version=_PROJECT_VERSION, description=_PROJECT_DESCRIPTION)
    return banner


def get_logo_path() -> str:
    """
    获取系统 LOGO 路径

    Returns:
        str: LOGO 文件路径
    """
    return _LOGO_PATH


# 初始化全局变量
_PROJECT_NAME, _PROJECT_DESCRIPTION, _PROJECT_VERSION = _get_project_info()

# 系统 LOGO 路径（来自 web/src/assets）
_LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "web", "src", "assets", "logo.png"
)

# 导出全局变量
__all__ = [
    "get_system_name",
    "get_system_description",
    "get_system_version",
    "get_banner",
    "get_logo_path",
]
