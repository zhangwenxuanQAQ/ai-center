"""
为chatbot_category表添加parent_id和sort_order字段
"""

from app.database.database import db
from app.database.models import ChatbotCategory


def add_parent_and_sort_fields():
    """
    为chatbot_category表添加parent_id和sort_order字段
    """
    with db.atomic():
        # 检查字段是否存在（MySQL语法）
        cursor = db.execute_sql("DESCRIBE chatbot_category;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'parent_id' not in columns:
            # 添加parent_id字段
            db.execute_sql("ALTER TABLE chatbot_category ADD COLUMN parent_id CHAR(36) NULL;")
            # 添加外键约束
            db.execute_sql("ALTER TABLE chatbot_category ADD FOREIGN KEY (parent_id) REFERENCES chatbot_category(id);")
        
        if 'sort_order' not in columns:
            # 添加sort_order字段
            db.execute_sql("ALTER TABLE chatbot_category ADD COLUMN sort_order INTEGER DEFAULT 0;")
        
        # 为现有记录设置默认排序值
        db.execute_sql("UPDATE chatbot_category SET sort_order = 0 WHERE sort_order IS NULL;")


if __name__ == "__main__":
    add_parent_and_sort_fields()
    print("成功为chatbot_category表添加parent_id和sort_order字段")
