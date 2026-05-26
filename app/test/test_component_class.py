"""
测试component_class方法

验证component_class方法能够正确从core/agent/component目录及子目录下获取组件类
"""
import sys
import os

ragflow_path = r"F:\project\ragflow-0.22.1"
if os.path.exists(ragflow_path):
    sys.path.insert(0, ragflow_path)
    print(f"添加ragflow路径: {ragflow_path}")
else:
    print(f"警告: ragflow路径不存在: {ragflow_path}")

project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, project_root)

from app.core.agent.component import component_class

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("测试 component_class 方法")
    print("=" * 50)
    
    test_components = [
        "Begin",
        "Generate",
        "Answer",
        "Categorize",
        "KnowledgeSearch",
        "CodeExecutor",
        "NonExistentComponent"
    ]
    
    for component_name in test_components:
        print(f"\n查找组件: {component_name}")
        component = component_class(component_name)
        
        if component:
            print(f"  ✓ 找到组件类: {component}")
            print(f"    - 组件名称: {getattr(component, 'component_name', 'N/A')}")
            print(f"    - 组件标题: {getattr(component, 'component_title', 'N/A')}")
        else:
            print(f"  ✗ 未找到组件: {component_name}")
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)
