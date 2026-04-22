import sqlite3

conn = sqlite3.connect('ai_center.db')
cursor = conn.cursor()

# 检查表是否存在
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_model'")
table_exists = cursor.fetchone()

if table_exists:
    print("llm_model table exists")
    # 检查列结构
    cursor.execute("PRAGMA table_info(llm_model)")
    columns = cursor.fetchall()
    print("\nTable structure:")
    for col in columns:
        print(f"  {col[1]}: {col[2]}")
else:
    print("llm_model table does not exist")

conn.close()