#!/usr/bin/env python3
"""
简单检查模块导入情况
"""

import importlib

# 要检查的模块
modules_to_check = [
    # API模块
    "app.api.chat",
    "app.api.chatbot",
    "app.api.knowledge",
    "app.api.llm_model",
    "app.api.mcp",
    "app.api.prompt",
    "app.api.user",
    
    # Services模块
    "app.services.chat.service",
    "app.services.chatbot.service",
    "app.services.knowledge.service",
    "app.services.llm_model.service",
    "app.services.mcp.service",
    "app.services.prompt.service",
    "app.services.user.service",
    
    # DTO模块
    "app.services.chat.dto",
    "app.services.chatbot.dto",
    "app.services.knowledge.dto",
    "app.services.llm_model.dto",
    "app.services.mcp.dto",
    "app.services.prompt.dto",
    "app.services.user.dto",
    
    # Core模块
    "app.core.exceptions",
    
    # Database模块
    "app.database.database",
    "app.database.db_utils",
    "app.database.models"
]

if __name__ == "__main__":
    print("检查模块导入情况...\n")
    
    for module_name in modules_to_check:
        try:
            importlib.import_module(module_name)
            print(f"✓ {module_name}")
        except Exception as e:
            print(f"✗ {module_name}: {e}")
    
    print("\n检查完成！")
