#!/usr/bin/env python3
"""
检查所有模块的导入情况
"""

import importlib
import os

# 要检查的目录
dirs_to_check = [
    "app/services",
    "app/api",
    "app/core",
    "app/database"
]

def check_imports(directory):
    """检查目录下所有Python文件的导入情况"""
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py") and not file.startswith("__init__"):
                # 构建模块路径
                module_path = os.path.join(root, file)
                # 将路径转换为模块名，使用点号分隔
                module_name = module_path.replace("\\", ".").replace("/", "=").replace(".py", "")
                # 移除路径开头的目录名，只保留app开头的模块路径
                if "app." in module_name:
                    module_name = module_name.split("app.", 1)[1]
                    module_name = "app." + module_name
                
                try:
                    importlib.import_module(module_name)
                    print(f"✓ {module_name}")
                except Exception as e:
                    print(f"✗ {module_name}: {e}")

if __name__ == "__main__":
    print("检查模块导入情况...\n")
    for directory in dirs_to_check:
        if os.path.exists(directory):
            check_imports(directory)
    print("\n检查完成！")
