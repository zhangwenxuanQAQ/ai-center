#!/usr/bin/env python
# 查询用户提到的数据库记录

import sys
sys.path.append('.')

from app.database.database import db
from app.database.models import ChatMessage

# 连接数据库
if not db.is_closed():
    print("Database connection already open")
else:
    db.connect()
    print("Database connection opened")

# 查询用户提到的记录
user_record = ChatMessage.get_or_none(
    (ChatMessage.id == '68e8726259d54f97b9b8f979e5007ce0') | 
    (ChatMessage.message_id == '68e8726259d54f97b9b8f979e5007ce0')
)

if user_record:
    print(f"Found record: {user_record.id}")
    print(f"message_id: {user_record.message_id}")
    print(f"chat_id: {user_record.chat_id}")
    print(f"extra_content: {user_record.extra_content}")
    print(f"extra_content type: {type(user_record.extra_content)}")
    print(f"content: {user_record.content}")
else:
    print("Record not found")

# 关闭数据库连接
if not db.is_closed():
    db.close()
    print("Database connection closed")