"""
SKILL常量定义
"""

import os

# SKILL文件存储根目录（相对于项目根目录）
SKILL_ROOT_DIR = os.path.join('data', 'skill')

# SKILL.md文件名
SKILL_MD_FILENAME = 'SKILL.md'

# SKILL状态
SKILL_STATUS_ENABLED = True
SKILL_STATUS_DISABLED = False

# SKILL.md标准内容模板（AGENT SKILL规范，名称和描述为必填项）
DEFAULT_SKILL_MD_TEMPLATE = """---
name: {skill_name}
description: {description}
{metadata_fields}
---

## {skill_name}

{content}
"""
