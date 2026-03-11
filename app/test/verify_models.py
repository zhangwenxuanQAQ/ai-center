"""
验证数据库模型脚本
"""
from app.database.models import (
    User, ChatbotCategory, Knowledge, LLMModel, Prompt,
    Chatbot, MCPCategory, MCPServer, MCPTool, ChatbotMCP
)

print("数据库模型导入成功！")
print("\n模型列表:")
print(f"1. User - 表名: {User._meta.table_name}")
print(f"2. ChatbotCategory - 表名: {ChatbotCategory._meta.table_name}")
print(f"3. Knowledge - 表名: {Knowledge._meta.table_name}")
print(f"4. LLMModel - 表名: {LLMModel._meta.table_name}")
print(f"5. Prompt - 表名: {Prompt._meta.table_name}")
print(f"6. Chatbot - 表名: {Chatbot._meta.table_name}")
print(f"7. MCPCategory - 表名: {MCPCategory._meta.table_name}")
print(f"8. MCPServer - 表名: {MCPServer._meta.table_name}")
print(f"9. MCPTool - 表名: {MCPTool._meta.table_name}")
print(f"10. ChatbotMCP - 表名: {ChatbotMCP._meta.table_name}")

print("\n验证模型字段:")
for model_class in [User, ChatbotCategory, Knowledge, LLMModel, Prompt, Chatbot, MCPCategory, MCPServer, MCPTool, ChatbotMCP]:
    print(f"\n{model_class.__name__} 字段:")
    for field_name, field_obj in model_class._meta.fields.items():
        print(f"  - {field_name}: {field_obj.__class__.__name__}")

print("\n数据库模型验证完成！")
