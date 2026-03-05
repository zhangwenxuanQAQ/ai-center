#!/usr/bin/env python3
"""
验证所有模块导入情况
"""

import importlib

# 要检查的模块
modules_to_check = [
    # API模块
    "app.api.chatbot",
    "app.api.chatbot_category",
    "app.api.knowledge",
    "app.api.llm_model",
    "app.api.mcp",
    "app.api.prompt",
    "app.api.user",
    "app.api.chat",
    
    # Services模块
    "app.services.chatbot.service",
    "app.services.chatbot_category.service",
    "app.services.knowledge.service",
    "app.services.llm_model.service",
    "app.services.mcp.service",
    "app.services.prompt.service",
    "app.services.user.service",
    "app.services.chat.service",
    
    # DTO模块
    "app.services.chatbot.dto",
    "app.services.chatbot_category.dto",
    "app.services.knowledge.dto",
    "app.services.llm_model.dto",
    "app.services.mcp.dto",
    "app.services.prompt.dto",
    "app.services.user.dto",
    "app.services.chat.dto",
    
    # Core模块
    "app.core.exceptions",
    
    # Database模块
    "app.database.database",
    "app.database.db_utils",
    "app.database.models"
]

if __name__ == "__main__":
    print("检查模块导入情况...\n")
    
    errors = []
    for module_name in modules_to_check:
        try:
            importlib.import_module(module_name)
            print(f"✓ {module_name}")
        except Exception as e:
            print(f"✗ {module_name}: {e}")
            errors.append((module_name, str(e)))
    
    print("\n" + "="*50)
    if errors:
        print(f"发现 {len(errors)} 个错误:")
        for module_name, error in errors:
            print(f"  - {module_name}: {error}")
    else:
        print("所有模块导入检查通过！")
