"""
对比数据库表结构和models.py定义
"""

数据库表结构 = {
    'chat': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id', 
             'user_id', 'chatbot_id', 'message', 'response', 
             'deleted', 'deleted_at', 'deleted_user_id'],
    
    'chatbot': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                'code', 'name', 'description', 'model_id', 'category_id', 
                'avatar', 'greeting', 'prompt_id', 'knowledge_id', 
                'source_type', 'source_config', 
                'deleted', 'deleted_at', 'deleted_user_id'],
    
    'chatbot_category': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                         'name', 'description', 'is_default', 
                         'deleted', 'deleted_at', 'deleted_user_id', 
                         'parent_id', 'sort_order'],
    
    'chatbot_mcp': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                    'deleted', 'deleted_at', 'deleted_user_id',
                    'chatbot_id', 'mcp_server_id'],
    
    'knowledge': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                  'name', 'description', 'file_path', 'status',
                  'deleted', 'deleted_at', 'deleted_user_id'],
    
    'llm_model': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                  'name', 'provider', 'api_key', 'endpoint', 'model_type',
                  'deleted', 'deleted_at', 'deleted_user_id'],
    
    'mcp_category': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                     'deleted', 'deleted_at', 'deleted_user_id',
                     'name', 'description', 'parent_id', 'sort_order'],
    
    'mcp_server': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                   'code', 'deleted', 'deleted_at', 'deleted_user_id',
                   'name', 'description', 'url', 'avatar', 
                   'transport_type', 'source_type', 'category_id', 'config'],
    
    'mcp_tool': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
                 'deleted', 'deleted_at', 'deleted_user_id',
                 'name', 'description', 'tool_type', 'server_id', 'config', 'status'],
    
    'prompt': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
               'name', 'content', 'category',
               'deleted', 'deleted_at', 'deleted_user_id'],
    
    'user': ['id', 'created_at', 'updated_at', 'create_user_id', 'update_user_id',
             'username', 'password', 'email', 'is_admin',
             'deleted', 'deleted_at', 'deleted_user_id']
}

print("=" * 100)
print("数据库表结构分析报告")
print("=" * 100)

print("\n缺失的模型:")
print("-" * 100)
print("1. Chat - 聊天记录表（数据库存在，模型缺失）")

print("\n所有表字段数量统计:")
print("-" * 100)
for table, fields in sorted(数据库表结构.items()):
    print(f"{table:<20} {len(fields)} 个字段")

print("\n需要添加的Chat模型字段:")
print("-" * 100)
for field in 数据库表结构['chat']:
    print(f"  - {field}")
