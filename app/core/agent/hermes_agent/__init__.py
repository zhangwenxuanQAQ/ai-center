"""
Hermes 智能体引擎（hermes_agent）

通过 hermes CLI 官方命令管理智能体（Profile）：
- 列表/创建/克隆/删除/重命名：hermes profile list/create/delete/rename
- 描述读写：hermes profile describe <name> [--text "..."]
- skills/tools：HERMES_HOME 指向 profile 目录后执行 hermes skills list / tools list
- SOUL.md / memories/MEMORY.md / memories/USER.md：直接读写 profile 目录下的文件

目录结构约定（hermes 官方）：
  <hermes_home>/                      # 默认智能体（default）
      SOUL.md
      memories/MEMORY.md, USER.md
      config.yaml, profile.yaml
  <hermes_home>/profiles/<name>/      # 其他智能体
      SOUL.md
      memories/MEMORY.md, USER.md
      config.yaml, profile.yaml
"""

from app.core.agent.hermes_agent.service import HermesAgentService, HermesAgentError

__all__ = ["HermesAgentService", "HermesAgentError"]
