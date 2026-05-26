"""
测试组件注册功能

该脚本用于测试组件注册方法是否正常工作
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

from app.core.agent.component import register_components

if __name__ == "__main__":
    print("开始测试组件注册功能...")
    
    try:
        result = register_components()
        
        print("\n" + "=" * 50)
        print("组件注册测试结果:")
        print("=" * 50)
        print(f"新增组件数量: {result['added']}")
        print(f"更新组件数量: {result['updated']}")
        print(f"失败组件数量: {result['failed']}")
        print(f"扫描组件总数: {result['total']}")
        print("=" * 50)
        
        if result['failed'] > 0:
            print("\n警告: 有部分组件注册失败，请查看日志了解详情")
        else:
            print("\n成功: 所有组件注册完成")
            
    except Exception as e:
        print(f"\n错误: 组件注册测试失败 - {str(e)}")
        import traceback
        traceback.print_exc()
