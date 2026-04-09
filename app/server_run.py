"""
FastAPI应用主入口
"""

import asyncio
import subprocess
import sys
import os
from contextlib import asynccontextmanager

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.configs.config import config
from app.database.models import create_tables
from app.api import router
from app.core.exceptions import (
    BaseServiceError,
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)
from app.utils.response import ResponseUtil, ResponseCode

print("=" * 80)
print("AI Center 后端服务启动中...")
print("=" * 80)

print("\n[1/3] 初始化数据库...")
create_tables()

print("\n[2/3] 运行数据库迁移...")
try:
    from app.database.database import db
    
    if db.is_closed():
        db.connect()
    
    cursor = db.execute_sql("SHOW TABLES;")
    tables = cursor.fetchall()
    table_names = [table[0] for table in tables]
    
    print(f"发现以下表: {table_names}")
    
    for table_name in table_names:
        print(f"\n处理表: {table_name}")
        
        cursor = db.execute_sql(f"DESCRIBE {table_name};")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'deleted' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted TINYINT DEFAULT 0")
                print(f"  成功添加deleted字段")
            except Exception as e:
                print(f"  添加deleted字段失败: {e}")
        else:
            print(f"  deleted字段已存在，跳过")
        
        if 'deleted_at' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_at DATETIME DEFAULT NULL")
                print(f"  成功添加deleted_at字段")
            except Exception as e:
                print(f"  添加deleted_at字段失败: {e}")
        else:
            print(f"  deleted_at字段已存在，跳过")
        
        if 'deleted_user_id' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_user_id VARCHAR(36) DEFAULT NULL")
                print(f"  成功添加deleted_user_id字段")
            except Exception as e:
                print(f"  添加deleted_user_id字段失败: {e}")
        else:
            print(f"  deleted_user_id字段已存在，跳过")
    
    print("\n移除chatbot表中code字段的唯一约束...")
    try:
        cursor = db.execute_sql("SHOW INDEX FROM chatbot;")
        indexes = cursor.fetchall()
        
        has_unique_index = False
        for index in indexes:
            if index[4] == 'code' and index[2] == 'UNI':
                has_unique_index = True
                break
        
        if has_unique_index:
            db.execute_sql("ALTER TABLE chatbot DROP INDEX code;")
            print("  成功移除chatbot表中code字段的唯一约束")
        else:
            print("  chatbot表中code字段没有唯一约束，跳过移除")
    except Exception as e:
        print(f"  移除chatbot表中code字段的唯一约束失败: {e}")
    
    print("\n为mcp_category表添加is_default字段...")
    try:
        cursor = db.execute_sql("DESCRIBE mcp_category;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'is_default' not in columns:
            db.execute_sql("ALTER TABLE mcp_category ADD COLUMN is_default TINYINT DEFAULT 0")
            print("  成功添加is_default字段")
        else:
            print("  is_default字段已存在，跳过")
    except Exception as e:
        print(f"  添加is_default字段失败: {e}")
    
    print("\n为mcp_tool表添加title和extra_config字段...")
    try:
        cursor = db.execute_sql("DESCRIBE mcp_tool;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'title' not in columns:
            db.execute_sql("ALTER TABLE mcp_tool ADD COLUMN title VARCHAR(255) DEFAULT NULL")
            print("  成功添加title字段")
        else:
            print("  title字段已存在，跳过")
        
        if 'extra_config' not in columns:
            db.execute_sql("ALTER TABLE mcp_tool ADD COLUMN extra_config TEXT DEFAULT NULL")
            print("  成功添加extra_config字段")
        else:
            print("  extra_config字段已存在，跳过")
    except Exception as e:
        print(f"  添加字段失败: {e}")
    
    print("\n为llm_model表添加category_id、tags、config、status字段...")
    try:
        cursor = db.execute_sql("DESCRIBE llm_model;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN category_id VARCHAR(40) DEFAULT NULL")
            print("  成功添加category_id字段")
        else:
            print("  category_id字段已存在，跳过")
        
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN tags TEXT DEFAULT NULL")
            print("  成功添加tags字段")
        else:
            print("  tags字段已存在，跳过")
        
        if 'config' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN config TEXT DEFAULT NULL")
            print("  成功添加config字段")
        else:
            print("  config字段已存在，跳过")
        
        if 'status' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN status TINYINT DEFAULT 1")
            print("  成功添加status字段")
        else:
            print("  status字段已存在，跳过")
        
        if 'provider' in columns:
            # 将provider字段改为可空
            db.execute_sql("ALTER TABLE llm_model MODIFY COLUMN provider VARCHAR(255) DEFAULT NULL")
            print("  成功修改provider字段为可空")
    except Exception as e:
        print(f"  添加字段失败: {e}")
    
    # 创建 prompt_category 表
    print("\n创建 prompt_category 表...")
    try:
        if 'prompt_category' not in table_names:
            db.execute_sql("""
                CREATE TABLE prompt_category (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    parent_id CHAR(36),
                    sort_order INT DEFAULT 0,
                    is_default TINYINT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    INDEX idx_parent_id (parent_id),
                    INDEX idx_sort_order (sort_order),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("  成功创建 prompt_category 表")
        else:
            print("  prompt_category 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE prompt_category;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN is_default TINYINT DEFAULT 0")
                print("  成功添加 is_default 字段")
            else:
                print("  is_default 字段已存在")
            
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                print("  成功添加 create_user_id 字段")
            else:
                print("  create_user_id 字段已存在")
            
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                print("  成功添加 update_user_id 字段")
            else:
                print("  update_user_id 字段已存在")
    except Exception as e:
        print(f"  创建 prompt_category 表失败: {e}")
    
    # 修改 prompt 表结构
    print("\n修改 prompt 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE prompt;")
        columns = [column[0] for column in cursor.fetchall()]
        
        # 添加 category_id 字段
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN category_id VARCHAR(40) DEFAULT NULL")
            print("  成功添加 category_id 字段")
        else:
            print("  category_id 字段已存在")
        
        # 添加 tags 字段
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN tags TEXT DEFAULT NULL")
            print("  成功添加 tags 字段")
        else:
            print("  tags 字段已存在")
        
        # 添加 status 字段
        if 'status' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN status TINYINT DEFAULT 1")
            print("  成功添加 status 字段")
        else:
            print("  status 字段已存在")
        
        # 添加 description 字段
        if 'description' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN description TEXT DEFAULT NULL")
            print("  成功添加 description 字段")
        else:
            print("  description 字段已存在")
        
        # 删除 category 字段
        if 'category' in columns:
            db.execute_sql("ALTER TABLE prompt DROP COLUMN category")
            print("  成功删除 category 字段")
        else:
            print("  category 字段不存在，无需删除")
    except Exception as e:
        print(f"  修改 prompt 表结构失败: {e}")
    
    # 修改 llm_model 表结构
    print("\n修改 llm_model 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE llm_model;")
        columns = [column[0] for column in cursor.fetchall()]
        
        # 添加 support_image 字段
        if 'support_image' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN support_image TINYINT DEFAULT 0")
            print("  成功添加 support_image 字段")
        else:
            print("  support_image 字段已存在")
    except Exception as e:
        print(f"  修改 llm_model 表结构失败: {e}")
    
    # 为 chatbot_model 表添加 config 字段
    print("\n为 chatbot_model 表添加 config 字段...")
    try:
        if 'chatbot_model' in table_names:
            cursor = db.execute_sql("DESCRIBE chatbot_model;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'config' not in columns:
                db.execute_sql("ALTER TABLE chatbot_model ADD COLUMN config TEXT DEFAULT NULL")
                print("  成功添加 config 字段")
            else:
                print("  config 字段已存在，跳过")
        else:
            print("  chatbot_model 表不存在，跳过")
    except Exception as e:
        print(f"  添加 config 字段失败: {e}")
    
    # 创建 chatbot_prompt 表
    print("\n创建 chatbot_prompt 表...")
    try:
        if 'chatbot_prompt' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_prompt (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    chatbot_id VARCHAR(40) NOT NULL,
                    prompt_id VARCHAR(40) DEFAULT NULL,
                    prompt_type VARCHAR(50) NOT NULL,
                    prompt_source VARCHAR(50) NOT NULL,
                    prompt_name VARCHAR(255) DEFAULT NULL,
                    prompt_content TEXT DEFAULT NULL,
                    sort_order INT DEFAULT 0,
                    INDEX idx_chatbot_id (chatbot_id),
                    INDEX idx_prompt_id (prompt_id),
                    INDEX idx_prompt_type (prompt_type),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("  成功创建 chatbot_prompt 表")
        else:
            print("  chatbot_prompt 表已存在，跳过")
    except Exception as e:
        print(f"  创建 chatbot_prompt 表失败: {e}")
    
    # 修改 chat 表结构
    print("\n修改 chat 表结构...")
    try:
        if 'chat' in table_names:
            cursor = db.execute_sql("DESCRIBE chat;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 添加 title 字段
            if 'title' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN title VARCHAR(255) DEFAULT NULL")
                print("  成功添加 title 字段")
            else:
                print("  title 字段已存在")
            
            # 添加 model_id 字段
            if 'model_id' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN model_id VARCHAR(40) DEFAULT NULL")
                print("  成功添加 model_id 字段")
            else:
                print("  model_id 字段已存在")
            
            # 添加 config 字段
            if 'config' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN config TEXT DEFAULT NULL")
                print("  成功添加 config 字段")
            else:
                print("  config 字段已存在")
            
            # 添加 sort_order 字段
            if 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN sort_order INT DEFAULT 0")
                print("  成功添加 sort_order 字段")
            else:
                print("  sort_order 字段已存在")
            
            # 添加 is_top 字段
            if 'is_top' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN is_top TINYINT DEFAULT 0")
                print("  成功添加 is_top 字段")
            else:
                print("  is_top 字段已存在")
            
            # 添加 system_prompt 字段
            if 'system_prompt' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN system_prompt TEXT DEFAULT NULL")
                print("  成功添加 system_prompt 字段")
            else:
                print("  system_prompt 字段已存在")
            
            # 添加 messages 字段
            if 'messages' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN messages TEXT DEFAULT NULL")
                print("  成功添加 messages 字段")
            else:
                print("  messages 字段已存在")
            
            # 删除 message 字段
            if 'message' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN message")
                print("  成功删除 message 字段")
            
            # 删除 response 字段
            if 'response' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN response")
                print("  成功删除 response 字段")
        else:
            print("  chat 表不存在，跳过")
    except Exception as e:
        print(f"  修改 chat 表结构失败: {e}")
    
    # 创建 chat_message 表
    print("\n创建 chat_message 表...")
    try:
        if 'chat_message' not in table_names:
            db.execute_sql("""
                CREATE TABLE chat_message (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    message_id VARCHAR(40) NOT NULL,
                    chat_id VARCHAR(40) NOT NULL,
                    config TEXT DEFAULT NULL,
                    messages TEXT DEFAULT NULL,
                    role VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    model_id VARCHAR(40) DEFAULT NULL,
                    chatbot_id VARCHAR(40) DEFAULT NULL,
                    INDEX idx_message_id (message_id),
                    INDEX idx_chat_id (chat_id),
                    INDEX idx_model_id (model_id),
                    INDEX idx_chatbot_id (chatbot_id),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("  成功创建 chat_message 表")
        else:
            print("  chat_message 表已存在，跳过")
    except Exception as e:
        print(f"  创建 chat_message 表失败: {e}")

    # 创建 knowledgebase_category 表
    print("\n创建 knowledgebase_category 表...")
    try:
        if 'knowledgebase_category' not in table_names:
            db.execute_sql("""
                CREATE TABLE knowledgebase_category (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    parent_id CHAR(36),
                    sort_order INT DEFAULT 0,
                    is_default TINYINT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    INDEX idx_name (name),
                    INDEX idx_parent_id (parent_id),
                    INDEX idx_sort_order (sort_order),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("  成功创建 knowledgebase_category 表")
        else:
            print("  knowledgebase_category 表已存在，跳过")
    except Exception as e:
        print(f"  创建 knowledgebase_category 表失败: {e}")

    # 修改/创建 knowledgebase 表（原knowledge表重命名并修改结构）
    print("\n处理 knowledgebase 表...")
    try:
        if 'knowledge' in table_names and 'knowledgebase' not in table_names:
            db.execute_sql("RENAME TABLE knowledge TO knowledgebase;")
            print("  成功将 knowledge 表重命名为 knowledgebase")
            table_names.append('knowledgebase')

        if 'knowledgebase' in table_names:
            cursor = db.execute_sql("DESCRIBE knowledgebase;")
            columns = [column[0] for column in cursor.fetchall()]

            if 'code' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN code VARCHAR(100) UNIQUE AFTER name")
                print("  成功添加 code 字段")

            if 'avatar' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN avatar TEXT DEFAULT NULL AFTER description")
                print("  成功添加 avatar 字段")

            if 'category_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN category_id VARCHAR(40) DEFAULT NULL AFTER avatar")
                print("  成功添加 category_id 字段")

            if 'embedding_model_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN embedding_model_id VARCHAR(40) DEFAULT NULL AFTER category_id")
                print("  成功添加 embedding_model_id 字段")

            if 'rerank_model_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN rerank_model_id VARCHAR(40) DEFAULT NULL AFTER embedding_model_id")
                print("  成功添加 rerank_model_id 字段")

            if 'doc_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN doc_num INT DEFAULT 0 AFTER embedding_model_id")
                print("  成功添加 doc_num 字段")

            if 'token_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN token_num INT DEFAULT 0 AFTER doc_num")
                print("  成功添加 token_num 字段")

            if 'chunk_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN chunk_num INT DEFAULT 0 AFTER token_num")
                print("  成功添加 chunk_num 字段")

            if 'retrieval_config' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN retrieval_config TEXT DEFAULT NULL AFTER chunk_num")
                print("  成功添加 retrieval_config 字段")

            if 'file_path' in columns:
                db.execute_sql("ALTER TABLE knowledgebase DROP COLUMN file_path")
                print("  成功删除 file_path 字段")

            if 'status' in columns:
                db.execute_sql("ALTER TABLE knowledgebase DROP COLUMN status")
                print("  成功删除 status 字段")

            if 'description' in columns:
                db.execute_sql("ALTER TABLE knowledgebase MODIFY COLUMN description TEXT DEFAULT NULL")
                print("  成功修改 description 字段为可空")
        else:
            print("  knowledgebase 表不存在，将在create_tables中创建")
    except Exception as e:
        print(f"  处理 knowledgebase 表失败: {e}")

    # 创建/更新 knowledgebase_document 表
    print("\n处理 knowledgebase_document 表...")
    try:
        if 'knowledgebase_document' not in table_names:
            db.execute_sql("""
                CREATE TABLE knowledgebase_document (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    kb_id VARCHAR(40) NOT NULL,
                    chunk_method VARCHAR(50) NOT NULL,
                    chunk_config TEXT DEFAULT NULL,
                    token_num INT DEFAULT 0,
                    chunk_num INT DEFAULT 0,
                    file_type VARCHAR(50) DEFAULT NULL,
                    file_name VARCHAR(255) DEFAULT NULL,
                    location VARCHAR(512) DEFAULT NULL,
                    file_size BIGINT DEFAULT 0,
                    running_status VARCHAR(50) DEFAULT 'pending',
                    task_progress FLOAT DEFAULT 0,
                    task_begin_at DATETIME DEFAULT NULL,
                    task_end_at DATETIME DEFAULT NULL,
                    task_duration INT DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    INDEX idx_kb_id (kb_id),
                    INDEX idx_chunk_method (chunk_method),
                    INDEX idx_running_status (running_status),
                    INDEX idx_created_at (created_at),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("  成功创建 knowledgebase_document 表")
        else:
            print("  knowledgebase_document 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
            columns = [column[0] for column in cursor.fetchall()]

            if 'chunk_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN chunk_num INT DEFAULT 0 AFTER token_num")
                print("  成功添加 chunk_num 字段")

            if 'file_type' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_type VARCHAR(50) DEFAULT NULL AFTER chunk_num")
                print("  成功添加 file_type 字段")

            if 'file_name' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER file_type")
                print("  成功添加 file_name 字段")

            if 'location' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN location VARCHAR(512) DEFAULT NULL AFTER file_name")
                print("  成功添加 location 字段")

            if 'file_size' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_size BIGINT DEFAULT 0 AFTER location")
                print("  成功添加 file_size 字段")

            if 'running_status' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN running_status VARCHAR(50) DEFAULT 'pending' AFTER file_size")
                print("  成功添加 running_status 字段")

            if 'task_progress' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_progress FLOAT DEFAULT 0 AFTER running_status")
                print("  成功添加 task_progress 字段")

            if 'task_begin_at' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_begin_at DATETIME DEFAULT NULL AFTER task_progress")
                print("  成功添加 task_begin_at 字段")

            if 'task_end_at' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_end_at DATETIME DEFAULT NULL AFTER task_begin_at")
                print("  成功添加 task_end_at 字段")

            if 'task_duration' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_duration INT DEFAULT 0 AFTER task_end_at")
                print("  成功添加 task_duration 字段")

            print("  knowledgebase_document 表字段检查完成")
    except Exception as e:
        print(f"  处理 knowledgebase_document 表失败: {e}")

    print("\n数据库迁移完成")
except Exception as e:
    print(f"数据库迁移失败: {e}")

mcp_enabled = config.config.get('mcp', {}).get('enabled', False)
mcp_process = None

if mcp_enabled:
    print("\n[3/3] 启动MCP服务...")
    mcp_host = config.config.get('mcp', {}).get('host', '127.0.0.1')
    mcp_port = config.config.get('mcp', {}).get('port', 8082)
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mcp_process = subprocess.Popen(
        [sys.executable, "-m", "app.mcp_server"],
        cwd=project_root
    )
    print(f"MCP服务已启动: http://{mcp_host}:{mcp_port}/mcp")
else:
    print("\n[3/3] MCP服务未启用（配置文件中mcp.enabled=false）")

print("\n" + "=" * 80)
print("AI Center 服务启动成功！")
print("=" * 80)
print(f"\n服务地址:")
print(f"  - 后端API:     http://{config.server['host']}:{config.server['http_port']}")
print(f"  - Swagger文档: http://{config.server['host']}:{config.server['http_port']}/docs")
print(f"  - ReDoc文档:   http://{config.server['host']}:{config.server['http_port']}/redoc")

if mcp_enabled:
    mcp_host = config.config.get('mcp', {}).get('host', '127.0.0.1')
    mcp_port = config.config.get('mcp', {}).get('port', 8082)
    print(f"  - MCP服务:     http://{mcp_host}:{mcp_port}/mcp")
else:
    print(f"  - MCP服务:     未启用")

print(f"\n数据库连接:")
print(f"  - 主机: {config.mysql['host']}:{config.mysql['port']}")
print(f"  - 数据库: {config.mysql['name']}")
print(f"  - 用户: {config.mysql['user']}")
print("\n" + "=" * 80)

app = FastAPI(
    title="AI Center API",
    description="AI服务中心后端API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def base_service_error_handler(request: Request, exc: BaseServiceError):
    """
    处理所有Service层异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=exc.message,
        data={"error_type": exc.__class__.__name__, "detail": exc.detail}
    )
    return JSONResponse(content=response.model_dump(), status_code=ResponseCode.INTERNAL_ERROR)

async def resource_not_found_error_handler(request: Request, exc: ResourceNotFoundError):
    """
    处理资源未找到异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.not_found(
        message=exc.message
    )
    return JSONResponse(content=response.model_dump(), status_code=ResponseCode.NOT_FOUND)

async def duplicate_resource_error_handler(request: Request, exc: DuplicateResourceError):
    """
    处理资源重复异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.DUPLICATE_RESOURCE,
        message=exc.message
    )
    return JSONResponse(content=response.model_dump(), status_code=ResponseCode.DUPLICATE_RESOURCE)

async def database_operation_error_handler(request: Request, exc: DatabaseOperationError):
    """
    处理数据库操作异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.DATABASE_ERROR,
        message=exc.message
    )
    return JSONResponse(content=response.model_dump(), status_code=ResponseCode.DATABASE_ERROR)

app.add_exception_handler(BaseServiceError, base_service_error_handler)
app.add_exception_handler(ResourceNotFoundError, resource_not_found_error_handler)
app.add_exception_handler(DuplicateResourceError, duplicate_resource_error_handler)
app.add_exception_handler(DatabaseOperationError, database_operation_error_handler)

# 添加ValueError异常处理器
async def value_error_handler(request: Request, exc: ValueError):
    """
    处理ValueError异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.BAD_REQUEST,
        message=str(exc)
    )
    return JSONResponse(content=response.model_dump(), status_code=400)

# 添加通用异常处理器
async def general_exception_handler(request: Request, exc: Exception):
    """
    处理所有未捕获的异常
    
    Args:
        request: 请求对象
        exc: 异常对象
        
    Returns:
        JSONResponse: 统一格式的响应
    """
    response = ResponseUtil.error(
        code=ResponseCode.INTERNAL_ERROR,
        message=f"服务器内部错误: {str(exc)}"
    )
    return JSONResponse(content=response.model_dump(), status_code=500)

app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(router, prefix="/aicenter/v1")

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(
            app,
            host=config.server['host'],
            port=config.server['http_port']
        )
    finally:
        if mcp_process:
            mcp_process.terminate()
            mcp_process.wait()
