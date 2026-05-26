"""
测试component_class方法逻辑

验证component_class方法的逻辑是否正确
"""
import sys
import os
import importlib
import inspect
from pathlib import Path

ragflow_path = r"F:\project\ragflow-0.22.1"
if os.path.exists(ragflow_path):
    sys.path.insert(0, ragflow_path)
    print(f"添加ragflow路径: {ragflow_path}")

project_root = r"E:\project_git\ai-center-zwx\ai-center"
sys.path.insert(0, project_root)

def test_component_class_logic():
    """
    测试component_class方法的逻辑
    """
    print("\n" + "=" * 60)
    print("测试 component_class 方法逻辑")
    print("=" * 60)
    
    component_dir = Path(r"E:\project_git\ai-center-zwx\ai-center\app\core\agent\component")
    project_root = component_dir.parent.parent.parent.parent  # 回到项目根目录
    
    test_components = ["Begin", "Generate", "Answer", "Categorize"]
    
    for class_name in test_components:
        print(f"\n查找组件: {class_name}")
        found = False
        
        for root, dirs, files in os.walk(component_dir):
            for file in files:
                if file.endswith('.py') and file != '__init__.py':
                    file_path = Path(root) / file
                    rel_path = file_path.relative_to(project_root)
                    module_name = str(rel_path.with_suffix('')).replace(os.sep, '.')
                    
                    try:
                        module = importlib.import_module(module_name)
                        
                        if hasattr(module, class_name):
                            obj = getattr(module, class_name)
                            if inspect.isclass(obj):
                                print(f"  ✓ 在模块 {module_name} 中找到类 {class_name}")
                                print(f"    - 类对象: {obj}")
                                found = True
                                break
                    except Exception as e:
                        if class_name in ["Begin", "Generate"]:
                            print(f"  ! 导入模块 {module_name} 失败: {str(e)}")
                        continue
            
            if found:
                break
        
        if not found:
            print(f"  ✗ 未找到组件: {class_name}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_component_class_logic()
