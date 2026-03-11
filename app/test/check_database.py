"""
数据库连接和模型测试脚本
"""

import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.abspath('.'))

from app.database.database import db
from app.database.models import Chatbot, LLMModel, User, create_tables

# 尝试连接数据库
print("尝试连接数据库...")
try:
    db.connect()
    print("数据库连接成功!")
    
    # 检查是否存在chatbot表
    print("\n检查chatbot表结构...")
    cursor = db.execute_sql("DESCRIBE chatbot;")
    for row in cursor.fetchall():
        print(row)
    
    # 尝试创建测试数据
    print("\n尝试创建测试数据...")
    
    # 先创建LLM模型
    test_llm = LLMModel(
        name="测试模型",
        provider="openai",
        api_key="test-api-key",
        endpoint="https://api.openai.com/v1",
        model_type="gpt-3.5-turbo"
    )
    test_llm.save(force_insert=True)
    print(f"LLM模型创建成功，ID: {test_llm.id}")
    
    # 创建聊天机器人
    test_chatbot = Chatbot(
        name="测试机器人",
        description="这是一个测试机器人",
        model_id=test_llm.id
    )
    test_chatbot.save(force_insert=True)
    print(f"聊天机器人创建成功，ID: {test_chatbot.id}")
    
    # 尝试查询数据
    print("\n尝试查询数据...")
    chatbots = list(Chatbot.select())
    print(f"查询到 {len(chatbots)} 条聊天机器人数据")
    for chatbot in chatbots:
        print(f"ID: {chatbot.id}, Name: {chatbot.name}, Description: {chatbot.description}")
    
    # 尝试删除测试数据
    print("\n尝试删除测试数据...")
    test_chatbot.delete_instance()
    test_llm.delete_instance()
    print("删除成功")
    
    # 再次查询数据
    print("\n再次查询数据...")
    chatbots = list(Chatbot.select())
    print(f"查询到 {len(chatbots)} 条数据")
    
finally:
    if db.is_closed() is False:
        db.close()
        print("\n数据库连接已关闭")
