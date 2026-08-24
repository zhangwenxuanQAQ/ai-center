"""
版本控制模块
提供版本管理功能，用于控制不同版本的可用模块
"""

from app.versioning.manager import VersionManager, ModuleConfig

# 全局版本管理器实例
version_manager = VersionManager()

__all__ = ["version_manager", "VersionManager", "ModuleConfig"]