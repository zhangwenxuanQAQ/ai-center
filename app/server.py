"""
FastAPI应用主入口
"""

import asyncio
import subprocess
import sys
import os
import logging
from contextlib import asynccontextmanager

# 主进程检测机制
# 使用环境变量来标识主进程，确保MCP服务和任务执行器只在主进程启动
def is_main_process():
    """
    检测当前进程是否为主进程
    通过环境变量MAIN_PROCESS来标识
    """
    return os.environ.get("MAIN_PROCESS", "0") == "1"

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 先导入配置
from app.configs.config import config

# 从配置文件读取日志配置
log_level = config.logging.get('level', 'INFO').upper()
log_format = config.logging.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')

logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format=log_format,
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database.models import create_tables
from app.api import router
from app.core.exceptions import (
    BaseServiceError,
    ResourceNotFoundError,
    DuplicateResourceError,
    DatabaseOperationError
)
from app.utils.response import ResponseUtil, ResponseCode

logger.info("=" * 80)
logger.info("AI Center 后端服务启动中...")
logger.info("=" * 80)

logger.info("\n" + "=" * 80)
logger.info("[阶段1/4] 数据库连接与初始化")
logger.info("=" * 80)

logger.info(f"\n[DB] 配置信息:")
logger.info(f"  - 主机: {config.mysql['host']}:{config.mysql['port']}")
logger.info(f"  - 数据库: {config.mysql['name']}")
logger.info(f"  - 用户: {config.mysql['user']}")

logger.info("\n[DB] 正在连接数据库...")
try:
    from app.database.database import db, create_database_if_not_exists
    
    logger.info("[DB] 检查数据库是否存在...")
    create_database_if_not_exists()
    logger.info("[DB] 数据库检查完成")
    
    logger.info("[DB] 正在建立数据库连接...")
    if db.is_closed():
        db.connect()
    
    if not db.is_closed():
        logger.info("[DB] ✅ 数据库连接成功")
    else:
        logger.error("[DB] ❌ 数据库连接失败")
        raise Exception("数据库连接失败")
    
    logger.info("\n[DB] 正在初始化数据表...")
    create_tables()
    logger.info("[DB] ✅ 数据表初始化完成")
    
except Exception as e:
    logger.error(f"[DB] ❌ 数据库初始化失败: {e}")
    raise

logger.info("\n" + "=" * 80)
logger.info("[阶段2/4] 数据库迁移")
logger.info("=" * 80)

logger.info("\n[MIGRATION] 正在执行数据库迁移...")
try:
    from app.database.database import db
    
    if db.is_closed():
        db.connect()
    
    cursor = db.execute_sql("SHOW TABLES;")
    tables = cursor.fetchall()
    table_names = [table[0] for table in tables]
    
    logger.info(f"[MIGRATION] 发现以下表: {table_names}")
    
    for table_name in table_names:
        logger.info(f"\n[MIGRATION] 处理表: {table_name}")
        
        cursor = db.execute_sql(f"DESCRIBE {table_name};")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'deleted' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted TINYINT DEFAULT 0")
                logger.info(f"[MIGRATION]   成功添加deleted字段")
            except Exception as e:
                logger.error(f"[MIGRATION]   添加deleted字段失败: {e}")
        else:
            logger.info(f"[MIGRATION]   deleted字段已存在，跳过")
        
        if 'deleted_at' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_at DATETIME DEFAULT NULL")
                logger.info(f"[MIGRATION]   成功添加deleted_at字段")
            except Exception as e:
                logger.error(f"[MIGRATION]   添加deleted_at字段失败: {e}")
        else:
            logger.info(f"[MIGRATION]   deleted_at字段已存在，跳过")
        
        if 'deleted_user_id' not in columns:
            try:
                db.execute_sql(f"ALTER TABLE {table_name} ADD COLUMN deleted_user_id VARCHAR(36) DEFAULT NULL")
                logger.info(f"[MIGRATION]   成功添加deleted_user_id字段")
            except Exception as e:
                logger.error(f"[MIGRATION]   添加deleted_user_id字段失败: {e}")
        else:
            logger.info(f"[MIGRATION]   deleted_user_id字段已存在，跳过")
    
    logger.info("\n[MIGRATION] 移除chatbot表中code字段的唯一约束...")
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
            logger.info("[MIGRATION]   成功移除chatbot表中code字段的唯一约束")
        else:
            logger.info("[MIGRATION]   chatbot表中code字段没有唯一约束，跳过移除")
    except Exception as e:
        logger.error(f"[MIGRATION]   移除chatbot表中code字段的唯一约束失败: {e}")
    
    logger.info("\n[MIGRATION] 移除knowledgebase表中code字段的唯一约束...")
    try:
        cursor = db.execute_sql("SHOW INDEX FROM knowledgebase;")
        indexes = cursor.fetchall()
        
        unique_index_name = None
        for index in indexes:
            if index[4] == 'code' and index[1] == 0:  # Non_unique = 0 means unique index
                unique_index_name = index[2]
                break
        
        if unique_index_name:
            db.execute_sql(f"ALTER TABLE knowledgebase DROP INDEX {unique_index_name};")
            logger.info("[MIGRATION]   成功移除knowledgebase表中code字段的唯一约束")
        else:
            logger.info("[MIGRATION]   knowledgebase表中code字段没有唯一约束，跳过移除")
    except Exception as e:
        logger.error(f"[MIGRATION]   移除knowledgebase表中code字段的唯一约束失败: {e}")
    
    logger.info("\n[MIGRATION] 为mcp_category表添加is_default字段...")
    try:
        cursor = db.execute_sql("DESCRIBE mcp_category;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'is_default' not in columns:
            db.execute_sql("ALTER TABLE mcp_category ADD COLUMN is_default TINYINT DEFAULT 0")
            logger.info("[MIGRATION]   成功添加is_default字段")
        else:
            logger.info("[MIGRATION]   is_default字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   添加is_default字段失败: {e}")
    
    logger.info("\n[MIGRATION] 为mcp_tool表添加title和extra_config字段...")
    try:
        cursor = db.execute_sql("DESCRIBE mcp_tool;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'title' not in columns:
            db.execute_sql("ALTER TABLE mcp_tool ADD COLUMN title VARCHAR(255) DEFAULT NULL")
            logger.info("[MIGRATION]   成功添加title字段")
        else:
            logger.info("[MIGRATION]   title字段已存在，跳过")
        
        if 'extra_config' not in columns:
            db.execute_sql("ALTER TABLE mcp_tool ADD COLUMN extra_config TEXT DEFAULT NULL")
            logger.info("[MIGRATION]   成功添加extra_config字段")
        else:
            logger.info("  extra_config字段已存在，跳过")
    except Exception as e:
        logger.info(f"  添加字段失败: {e}")
    
    logger.info("\n为llm_model表添加category_id、tags、config、status字段...")
    try:
        cursor = db.execute_sql("DESCRIBE llm_model;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN category_id VARCHAR(40) DEFAULT NULL")
            logger.info("  成功添加category_id字段")
        else:
            logger.info("  category_id字段已存在，跳过")
        
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN tags TEXT DEFAULT NULL")
            logger.info("  成功添加tags字段")
        else:
            logger.info("  tags字段已存在，跳过")
        
        if 'config' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN config TEXT DEFAULT NULL")
            logger.info("  成功添加config字段")
        else:
            logger.info("  config字段已存在，跳过")
        
        if 'status' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN status TINYINT DEFAULT 1")
            logger.info("  成功添加status字段")
        else:
            logger.info("  status字段已存在，跳过")
        
        if 'provider' in columns:
            # 将provider字段改为可空
            db.execute_sql("ALTER TABLE llm_model MODIFY COLUMN provider VARCHAR(255) DEFAULT NULL")
            logger.info("  成功修改provider字段为可空")
    except Exception as e:
        logger.info(f"  添加字段失败: {e}")
    
    # 创建 prompt_category 表
    logger.info("\n创建 prompt_category 表...")
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 prompt_category 表")
        else:
            logger.info("  prompt_category 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE prompt_category;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN is_default TINYINT DEFAULT 0")
                logger.info("  成功添加 is_default 字段")
            else:
                logger.info("  is_default 字段已存在")
            
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("  成功添加 create_user_id 字段")
            else:
                logger.info("  create_user_id 字段已存在")
            
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE prompt_category ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("  成功添加 update_user_id 字段")
            else:
                logger.info("  update_user_id 字段已存在")
    except Exception as e:
        logger.info(f"  创建 prompt_category 表失败: {e}")
    
    # 修改 prompt 表结构
    logger.info("\n修改 prompt 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE prompt;")
        columns = [column[0] for column in cursor.fetchall()]
        
        # 添加 category_id 字段
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN category_id VARCHAR(40) DEFAULT NULL")
            logger.info("  成功添加 category_id 字段")
        else:
            logger.info("  category_id 字段已存在")
        
        # 添加 tags 字段
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN tags TEXT DEFAULT NULL")
            logger.info("  成功添加 tags 字段")
        else:
            logger.info("  tags 字段已存在")
        
        # 添加 status 字段
        if 'status' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN status TINYINT DEFAULT 1")
            logger.info("  成功添加 status 字段")
        else:
            logger.info("  status 字段已存在")
        
        # 添加 description 字段
        if 'description' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN description TEXT DEFAULT NULL")
            logger.info("  成功添加 description 字段")
        else:
            logger.info("  description 字段已存在")
        
        # 删除 category 字段
        if 'category' in columns:
            db.execute_sql("ALTER TABLE prompt DROP COLUMN category")
            logger.info("  成功删除 category 字段")
        else:
            logger.info("  category 字段不存在，无需删除")
    except Exception as e:
        logger.info(f"  修改 prompt 表结构失败: {e}")
    
    # 修改 llm_model 表结构
    logger.info("\n修改 llm_model 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE llm_model;")
        columns = [column[0] for column in cursor.fetchall()]
        
        # 添加 support_image 字段
        if 'support_image' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN support_image TINYINT DEFAULT 0")
            logger.info("  成功添加 support_image 字段")
        else:
            logger.info("  support_image 字段已存在")
        
        # 添加 is_default 字段
        if 'is_default' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN is_default TINYINT DEFAULT 0")
            logger.info("  成功添加 is_default 字段")
        else:
            logger.info("  is_default 字段已存在")
        
        # 添加 connection_status 字段
        if 'connection_status' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN connection_status TINYINT DEFAULT -1")
            logger.info("  成功添加 connection_status 字段")
        else:
            logger.info("  connection_status 字段已存在，跳过")
    except Exception as e:
        logger.info(f"  修改 llm_model 表结构失败: {e}")
    
    # 为 chatbot_model 表添加 config 字段
    logger.info("\n为 chatbot_model 表添加 config 字段...")
    try:
        if 'chatbot_model' in table_names:
            cursor = db.execute_sql("DESCRIBE chatbot_model;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'config' not in columns:
                db.execute_sql("ALTER TABLE chatbot_model ADD COLUMN config TEXT DEFAULT NULL")
                logger.info("  成功添加 config 字段")
            else:
                logger.info("  config 字段已存在，跳过")
        else:
            logger.info("  chatbot_model 表不存在，跳过")
    except Exception as e:
        logger.info(f"  添加 config 字段失败: {e}")
    
    # 创建 chatbot_prompt 表
    logger.info("\n创建 chatbot_prompt 表...")
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 chatbot_prompt 表")
        else:
            logger.info("  chatbot_prompt 表已存在，跳过")
    except Exception as e:
        logger.info(f"  创建 chatbot_prompt 表失败: {e}")
    
    # 修改 chat 表结构
    logger.info("\n修改 chat 表结构...")
    try:
        if 'chat' in table_names:
            cursor = db.execute_sql("DESCRIBE chat;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 添加 title 字段
            if 'title' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN title VARCHAR(255) DEFAULT NULL")
                logger.info("  成功添加 title 字段")
            else:
                logger.info("  title 字段已存在")
            
            # 添加 model_id 字段
            if 'model_id' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN model_id VARCHAR(40) DEFAULT NULL")
                logger.info("  成功添加 model_id 字段")
            else:
                logger.info("  model_id 字段已存在")
            
            # 添加 config 字段
            if 'config' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN config TEXT DEFAULT NULL")
                logger.info("  成功添加 config 字段")
            else:
                logger.info("  config 字段已存在")
            
            # 添加 sort_order 字段
            if 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN sort_order INT DEFAULT 0")
                logger.info("  成功添加 sort_order 字段")
            else:
                logger.info("  sort_order 字段已存在")
            
            # 添加 is_top 字段
            if 'is_top' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN is_top TINYINT DEFAULT 0")
                logger.info("  成功添加 is_top 字段")
            else:
                logger.info("  is_top 字段已存在")
            
            # 添加 system_prompt 字段
            if 'system_prompt' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN system_prompt TEXT DEFAULT NULL")
                logger.info("  成功添加 system_prompt 字段")
            else:
                logger.info("  system_prompt 字段已存在")
            
            # 添加 messages 字段
            if 'messages' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN messages TEXT DEFAULT NULL")
                logger.info("  成功添加 messages 字段")
            else:
                logger.info("  messages 字段已存在")
            
            # 删除 message 字段
            if 'message' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN message")
                logger.info("  成功删除 message 字段")
            
            # 删除 response 字段
            if 'response' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN response")
                logger.info("  成功删除 response 字段")
        else:
            logger.info("  chat 表不存在，跳过")
    except Exception as e:
        logger.info(f"  修改 chat 表结构失败: {e}")
    
    # 创建 chat_message 表
    logger.info("\n创建 chat_message 表...")
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 chat_message 表")
        else:
            logger.info("  chat_message 表已存在，跳过")
    except Exception as e:
        logger.info(f"  创建 chat_message 表失败: {e}")

    # 创建 knowledgebase_category 表
    logger.info("\n创建 knowledgebase_category 表...")
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 knowledgebase_category 表")
        else:
            logger.info("  knowledgebase_category 表已存在，跳过")
    except Exception as e:
        logger.info(f"  创建 knowledgebase_category 表失败: {e}")

    # 修改/创建 knowledgebase 表（原knowledge表重命名并修改结构）
    logger.info("\n处理 knowledgebase 表...")
    try:
        if 'knowledge' in table_names and 'knowledgebase' not in table_names:
            db.execute_sql("RENAME TABLE knowledge TO knowledgebase;")
            logger.info("  成功将 knowledge 表重命名为 knowledgebase")
            table_names.append('knowledgebase')

        if 'knowledgebase' in table_names:
            cursor = db.execute_sql("DESCRIBE knowledgebase;")
            columns = [column[0] for column in cursor.fetchall()]

            if 'code' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN code VARCHAR(100) UNIQUE AFTER name")
                logger.info("  成功添加 code 字段")

            if 'avatar' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN avatar TEXT DEFAULT NULL AFTER description")
                logger.info("  成功添加 avatar 字段")

            if 'category_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN category_id VARCHAR(40) DEFAULT NULL AFTER avatar")
                logger.info("  成功添加 category_id 字段")

            if 'embedding_model_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN embedding_model_id VARCHAR(40) DEFAULT NULL AFTER category_id")
                logger.info("  成功添加 embedding_model_id 字段")

            if 'rerank_model_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN rerank_model_id VARCHAR(40) DEFAULT NULL AFTER embedding_model_id")
                logger.info("  成功添加 rerank_model_id 字段")

            if 'doc_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN doc_num INT DEFAULT 0 AFTER embedding_model_id")
                logger.info("  成功添加 doc_num 字段")

            if 'token_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN token_num INT DEFAULT 0 AFTER doc_num")
                logger.info("  成功添加 token_num 字段")

            if 'chunk_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN chunk_num INT DEFAULT 0 AFTER token_num")
                logger.info("  成功添加 chunk_num 字段")

            if 'retrieval_config' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN retrieval_config TEXT DEFAULT NULL AFTER chunk_num")
                logger.info("  成功添加 retrieval_config 字段")

            if 'file_path' in columns:
                db.execute_sql("ALTER TABLE knowledgebase DROP COLUMN file_path")
                logger.info("  成功删除 file_path 字段")

            if 'status' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase ADD COLUMN status TINYINT DEFAULT 1")
                logger.info("  成功添加 status 字段")

            if 'description' in columns:
                db.execute_sql("ALTER TABLE knowledgebase MODIFY COLUMN description TEXT DEFAULT NULL")
                logger.info("  成功修改 description 字段为可空")
        else:
            logger.info("  knowledgebase 表不存在，将在create_tables中创建")
    except Exception as e:
        logger.info(f"  处理 knowledgebase 表失败: {e}")

    # 创建/更新 knowledgebase_document 表
    logger.info("\n处理 knowledgebase_document 表...")
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 knowledgebase_document 表")
        else:
            logger.info("  knowledgebase_document 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
            columns = [column[0] for column in cursor.fetchall()]

            if 'chunk_num' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN chunk_num INT DEFAULT 0 AFTER token_num")
                logger.info("  成功添加 chunk_num 字段")

            if 'file_type' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_type VARCHAR(50) DEFAULT NULL AFTER chunk_num")
                logger.info("  成功添加 file_type 字段")

            if 'file_name' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER file_type")
                logger.info("  成功添加 file_name 字段")

            if 'location' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN location VARCHAR(512) DEFAULT NULL AFTER file_name")
                logger.info("  成功添加 location 字段")

            if 'file_size' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN file_size BIGINT DEFAULT 0 AFTER location")
                logger.info("  成功添加 file_size 字段")

            if 'running_status' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN running_status VARCHAR(50) DEFAULT 'pending' AFTER file_size")
                logger.info("  成功添加 running_status 字段")

            if 'task_progress' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_progress FLOAT DEFAULT 0 AFTER running_status")
                logger.info("  成功添加 task_progress 字段")

            if 'task_begin_at' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_begin_at DATETIME DEFAULT NULL AFTER task_progress")
                logger.info("  成功添加 task_begin_at 字段")

            if 'task_end_at' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_end_at DATETIME DEFAULT NULL AFTER task_begin_at")
                logger.info("  成功添加 task_end_at 字段")

            if 'task_duration' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_duration INT DEFAULT 0 AFTER task_end_at")
                logger.info("  成功添加 task_duration 字段")

            logger.info("  knowledgebase_document 表字段检查完成")
    except Exception as e:
        logger.info(f"  处理 knowledgebase_document 表失败: {e}")

    # 创建/更新 knowledgebase_document_category 表
    logger.info("\n处理 knowledgebase_document_category 表...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        if 'knowledgebase_document_category' not in table_names:
            db.execute_sql("""
                CREATE TABLE knowledgebase_document_category (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    kb_id VARCHAR(40) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    parent_id CHAR(36),
                    sort_order INT DEFAULT 0,
                    is_default TINYINT DEFAULT 0,
                    document_config LONGTEXT DEFAULT NULL,
                    chunk_method VARCHAR(50) DEFAULT NULL,
                    chunk_config TEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    INDEX idx_kb_id (kb_id),
                    INDEX idx_parent_id (parent_id),
                    INDEX idx_sort_order (sort_order),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("  成功创建 knowledgebase_document_category 表")
        else:
            logger.info("  knowledgebase_document_category 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE knowledgebase_document_category;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 更新字段名：knowledgebase_id -> kb_id
            if 'knowledgebase_id' in columns and 'kb_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category CHANGE COLUMN knowledgebase_id kb_id VARCHAR(40) NOT NULL")
                logger.info("  成功将 knowledgebase_id 字段重命名为 kb_id")
            
            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category ADD COLUMN is_default TINYINT DEFAULT 0")
                logger.info("  成功添加 is_default 字段")
            else:
                logger.info("  is_default 字段已存在，跳过")
            
            if 'document_config' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category ADD COLUMN document_config LONGTEXT DEFAULT NULL")
                logger.info("  成功添加 document_config 字段")
            else:
                cursor = db.execute_sql("DESCRIBE knowledgebase_document_category document_config;")
                result = cursor.fetchone()
                if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                    db.execute_sql("ALTER TABLE knowledgebase_document_category MODIFY COLUMN document_config LONGTEXT DEFAULT NULL")
                    logger.info("  成功将 document_config 字段类型修改为 LONGTEXT")
                else:
                    logger.info("  document_config 字段已存在且类型正确，跳过")
            
            if 'chunk_method' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category ADD COLUMN chunk_method VARCHAR(50) DEFAULT NULL")
                logger.info("  成功添加 chunk_method 字段")
            else:
                logger.info("  chunk_method 字段已存在，跳过")
            
            if 'chunk_config' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category ADD COLUMN chunk_config TEXT DEFAULT NULL")
                logger.info("  成功添加 chunk_config 字段")
            else:
                logger.info("  chunk_config 字段已存在，跳过")
            
            if 'kb_id' not in columns:
                db.execute_sql("ALTER TABLE knowledgebase_document_category ADD COLUMN kb_id VARCHAR(40) NOT NULL")
                logger.info("  成功添加 kb_id 字段")
    except Exception as e:
        logger.info(f"  处理 knowledgebase_document_category 表失败: {e}")
    
    # 为 knowledgebase_document 表添加 category_id、title、tags 和 document_config 字段
    logger.info("\n为 knowledgebase_document 表添加 category_id、title、tags 和 document_config 字段...")
    try:
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN category_id VARCHAR(36) DEFAULT NULL")
            logger.info("  category_id 字段已添加")
        else:
            logger.info("  category_id 字段已存在，跳过")
        
        if 'title' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN title VARCHAR(255) DEFAULT NULL AFTER category_id")
            logger.info("  title 字段已添加")
        else:
            logger.info("  title 字段已存在，跳过")
        
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN tags TEXT DEFAULT NULL")
            logger.info("  tags 字段已添加")
        else:
            logger.info("  tags 字段已存在，跳过")
        
        if 'document_config' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN document_config LONGTEXT DEFAULT NULL")
            logger.info("  document_config 字段已添加")
        else:
            cursor_type = db.execute_sql("DESCRIBE knowledgebase_document document_config;")
            result = cursor_type.fetchone()
            if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                db.execute_sql("ALTER TABLE knowledgebase_document MODIFY COLUMN document_config LONGTEXT DEFAULT NULL")
                logger.info("  成功将 document_config 字段类型修改为 LONGTEXT")
            else:
                logger.info("  document_config 字段已存在且类型正确，跳过")
    except Exception as e:
        logger.info(f"  为 knowledgebase_document 表添加字段失败: {e}")

    logger.info("\n将 knowledgebase_document 表的 status 字段从字符串类型改为布尔类型...")
    try:
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = cursor.fetchall()
        status_column = None
        for column in columns:
            if column[0] == 'status':
                status_column = column
                break
        
        if status_column:
            if status_column[1].upper() != 'BOOLEAN':
                # 添加临时字段
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN status_temp BOOLEAN DEFAULT TRUE;")
                # 更新临时字段值：只有明确为'inactive'时才设为FALSE，其他情况都设为TRUE
                db.execute_sql("UPDATE knowledgebase_document SET status_temp = CASE WHEN status = 'inactive' THEN FALSE ELSE TRUE END;")
                # 删除原字段
                db.execute_sql("ALTER TABLE knowledgebase_document DROP COLUMN status;")
                # 重命名临时字段
                db.execute_sql("ALTER TABLE knowledgebase_document CHANGE COLUMN status_temp status BOOLEAN DEFAULT TRUE;")
                logger.info("  成功将 status 字段从字符串类型改为布尔类型")
            else:
                logger.info("  status 字段已经是布尔类型，跳过")
        else:
            logger.info("  status 字段不存在，跳过")
    except Exception as e:
        logger.info(f"  修改 knowledgebase_document 表的 status 字段类型失败: {e}")

    # 更新 knowledgebase_document 表的 location 和 file_name 字段
    logger.info("\n更新 knowledgebase_document 表的 location 和 file_name 字段...")
    try:
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = cursor.fetchall()
        
        # 更新 location 字段从 VARCHAR(512) 改为 TEXT
        location_column = None
        for column in columns:
            if column[0] == 'location':
                location_column = column
                break
        
        if location_column:
            if 'varchar' in location_column[1].lower():
                db.execute_sql("ALTER TABLE knowledgebase_document MODIFY COLUMN location TEXT DEFAULT NULL;")
                logger.info("  成功将 location 字段类型改为 TEXT")
            else:
                logger.info("  location 字段已经是 TEXT 类型，跳过")
        else:
            logger.info("  location 字段不存在，跳过")
        
        # 更新 file_name 字段长度从 VARCHAR(255) 改为 VARCHAR(2000)
        file_name_column = None
        for column in columns:
            if column[0] == 'file_name':
                file_name_column = column
                break
        
        if file_name_column:
            if 'varchar(255)' in file_name_column[1].lower():
                db.execute_sql("ALTER TABLE knowledgebase_document MODIFY COLUMN file_name VARCHAR(2000) DEFAULT NULL;")
                logger.info("  成功将 file_name 字段长度改为 2000")
            else:
                logger.info("  file_name 字段长度已经是 2000，跳过")
        else:
            logger.info("  file_name 字段不存在，跳过")
    except Exception as e:
        logger.info(f"  更新 knowledgebase_document 表字段失败: {e}")

    # 为 knowledgebase_document 表添加 task_progress_message 字段
    logger.info("\n为 knowledgebase_document 表添加 task_progress_message 字段...")
    try:
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = [column[0] for column in cursor.fetchall()]

        if 'task_progress_message' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN task_progress_message VARCHAR(500) DEFAULT NULL AFTER task_progress")
            logger.info("  task_progress_message 字段已添加")
        else:
            logger.info("  task_progress_message 字段已存在，跳过")

        if 'mime_type' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN mime_type VARCHAR(100) DEFAULT NULL AFTER file_size")
            logger.info("  mime_type 字段已添加")
        else:
            logger.info("  mime_type 字段已存在，跳过")

        if 'source_type' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN source_type VARCHAR(50) DEFAULT NULL AFTER mime_type")
            logger.info("  source_type 字段已添加")
        else:
            logger.info("  source_type 字段已存在，跳过")

        if 'source_config' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN source_config TEXT DEFAULT NULL AFTER source_type")
            logger.info("  source_config 字段已添加")
        else:
            logger.info("  source_config 字段已存在，跳过")

        if 'thumbnail' not in columns:
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN thumbnail TEXT DEFAULT NULL AFTER source_config")
            logger.info("  thumbnail 字段已添加")
        else:
            # 检查 thumbnail 字段类型，如果不是 LONGTEXT 则修改为 LONGTEXT
            cursor = db.execute_sql("DESCRIBE knowledgebase_document thumbnail;")
            result = cursor.fetchone()
            if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                db.execute_sql("ALTER TABLE knowledgebase_document MODIFY COLUMN thumbnail LONGTEXT DEFAULT NULL")
                logger.info("  成功将 thumbnail 字段类型修改为 LONGTEXT")
            else:
                logger.info("  thumbnail 字段已存在且类型正确，跳过")
    except Exception as e:
        logger.info(f"  为 knowledgebase_document 表添加字段失败: {e}")

    # 统一所有表的COLLATE为utf8mb4_0900_ai_ci
    logger.info("\n统一所有表的COLLATE字符集为utf8mb4_0900_ai_ci...")
    try:
        tables_to_update = [
            'prompt_category',
            'chatbot_prompt',
            'chat_message',
            'knowledgebase_category',
            'knowledgebase_document',
            'knowledgebase_document_category'
        ]
        
        for table_name in tables_to_update:
            try:
                cursor = db.execute_sql(f"SHOW TABLES LIKE '{table_name}';")
                if cursor.fetchone():
                    db.execute_sql(f"ALTER TABLE {table_name} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;")
                    logger.info(f"  成功修改 {table_name} 表的COLLATE")
            except Exception as e:
                logger.info(f"  修改 {table_name} 表的COLLATE失败: {e}")
    except Exception as e:
        logger.info(f"  统一表COLLATE失败: {e}")

    # 修改messages字段类型为LONGTEXT
    logger.info("\n修改messages字段类型为LONGTEXT...")
    try:
        # 检查并修改chat表的messages字段
        cursor = db.execute_sql("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'chat'
            AND column_name = 'messages'
            AND data_type = 'text'
        """)
        result = cursor.fetchone()

        if result[0] > 0:
            db.execute_sql("ALTER TABLE chat MODIFY COLUMN messages LONGTEXT")
            logger.info("  字段 chat.messages 已成功修改为 LONGTEXT 类型")
        else:
            logger.info("  字段 chat.messages 不是 TEXT 类型或已修改，跳过")

        # 检查并修改chat_message表的messages字段
        cursor = db.execute_sql("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'messages'
            AND data_type = 'text'
        """)
        result = cursor.fetchone()

        if result[0] > 0:
            db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN messages LONGTEXT")
            logger.info("  字段 chat_message.messages 已成功修改为 LONGTEXT 类型")
        else:
            logger.info("  字段 chat_message.messages 不是 TEXT 类型或已修改，跳过")

        # 检查并修改chat_message表的content字段
        cursor = db.execute_sql("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'content'
            AND data_type = 'text'
        """)
        result = cursor.fetchone()

        if result[0] > 0:
            db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN content LONGTEXT")
            logger.info("  字段 chat_message.content 已成功修改为 LONGTEXT 类型")
        else:
            logger.info("  字段 chat_message.content 不是 TEXT 类型或已修改，跳过")

        # 检查并修改chat_message表的extra_content字段
        # 强制修改为 LONGTEXT，不管当前是什么类型
        logger.info("  强制修改chat_message表的extra_content字段...")
        try:
            # 先查看当前字段类型
            cursor = db.execute_sql("""
                SELECT column_name, data_type, column_type
                FROM information_schema.columns
                WHERE table_name = 'chat_message'
                AND column_name = 'extra_content'
            """)
            result = cursor.fetchone()
            
            if result:
                logger.info(f"  当前字段类型: {result[1]}, {result[2]}")
                
                # 强制修改为 LONGTEXT
                db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN extra_content LONGTEXT")
                logger.info("  字段 extra_content 已成功修改为 LONGTEXT 类型")
                
                # 再次验证
                cursor = db.execute_sql("""
                    SELECT column_name, data_type, column_type
                    FROM information_schema.columns
                    WHERE table_name = 'chat_message'
                    AND column_name = 'extra_content'
                """)
                result = cursor.fetchone()
                logger.info(f"  修改后字段类型: {result[1]}, {result[2]}")
            else:
                logger.info("  字段 extra_content 不存在")
        except Exception as e:
            logger.info(f"  修改extra_content字段失败: {e}")

        # 检查并修改chat_message表的reasoning_content字段
        cursor = db.execute_sql("""
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'reasoning_content'
            AND data_type = 'text'
        """)
        result = cursor.fetchone()

        if result[0] > 0:
            db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN reasoning_content LONGTEXT")
            logger.info("[MIGRATION]     字段 chat_message.reasoning_content 已成功修改为 LONGTEXT 类型")
        else:
            logger.info("[MIGRATION]     字段 chat_message.reasoning_content 不是 TEXT 类型或已修改，跳过")

    except Exception as e:
        logger.error(f"[MIGRATION]   修改messages字段类型失败: {e}")

    # 修改chat_message表的avatar字段类型为TEXT
    logger.info("\n[MIGRATION] 修改chat_message表的avatar字段类型为TEXT...")
    try:
        cursor = db.execute_sql("""
            SELECT column_name, data_type, column_type
            FROM information_schema.columns
            WHERE table_name = 'chat_message'
            AND column_name = 'avatar'
        """)
        result = cursor.fetchone()
        
        if result:
            logger.info(f"[MIGRATION]   当前avatar字段类型: {result[1]}, {result[2]}")
            
            if 'varchar' in result[1].lower():
                db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN avatar TEXT DEFAULT NULL")
                logger.info("[MIGRATION]   成功将avatar字段类型修改为TEXT")
            else:
                logger.info("[MIGRATION]   avatar字段已经是TEXT类型或其他非VARCHAR类型，跳过")
        else:
            logger.info("[MIGRATION]   avatar字段不存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   修改avatar字段类型失败: {e}")

    # 为knowledgebase_document表添加metadatas字段
    logger.info("\n[MIGRATION] 为knowledgebase_document表添加metadatas字段...")
    try:
        cursor = db.execute_sql("SHOW COLUMNS FROM knowledgebase_document LIKE 'metadatas'")
        if not cursor.fetchone():
            db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN metadatas LONGTEXT DEFAULT NULL")
            logger.info("[MIGRATION]   成功添加metadatas字段")
        else:
            logger.info("[MIGRATION]   metadatas字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   添加metadatas字段失败: {e}")

    # 更新 agent_category 表结构，与 knowledgebase_category 保持一致
    logger.info("\n[MIGRATION] 更新 agent_category 表结构...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        if 'agent_category' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_category;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 修改字段名: create_date -> created_at
            if 'create_date' in columns and 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_category CHANGE COLUMN create_date created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功将 create_date 字段重命名为 created_at")
            
            # 修改字段名: sort -> sort_order
            if 'sort' in columns and 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE agent_category CHANGE COLUMN sort sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功将 sort 字段重命名为 sort_order")
            
            # 修改 id 字段长度从 varchar(32) -> varchar(40)
            if 'id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category id;")
                result = cursor.fetchone()
                if result and '32' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN id VARCHAR(40) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 id 字段长度为 VARCHAR(40)")
            
            # 修改 name 字段长度从 varchar(200) -> varchar(255)
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category name;")
                result = cursor.fetchone()
                if result and '200' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN name VARCHAR(255) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 name 字段长度为 VARCHAR(255)")
            
            # 修改 description 字段类型从 varchar(2000) -> text
            if 'description' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category description;")
                result = cursor.fetchone()
                if result and 'varchar' in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN description TEXT")
                    logger.info("[MIGRATION]   成功修改 description 字段类型为 TEXT")
            
            # 修改 sort_order 字段为 NOT NULL
            if 'sort_order' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category sort_order;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 sort_order 字段为 NOT NULL")
            
            # 修改 is_default 字段为 NOT NULL
            if 'is_default' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category is_default;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 is_default 字段为 NOT NULL")
            
            # 修改 deleted 字段为 NOT NULL
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 deleted 字段为 NOT NULL")
            
            # 修改 deleted_user_id 字段长度从 varchar(36) -> varchar(40)
            if 'deleted_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category deleted_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN deleted_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功修改 deleted_user_id 字段长度为 VARCHAR(40)")
            
            # 新增 parent_id 字段
            if 'parent_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN parent_id VARCHAR(40) DEFAULT NULL")
                db.execute_sql("ALTER TABLE agent_category ADD INDEX idx_agent_category_parent_id (parent_id)")
                logger.info("[MIGRATION]   成功添加 parent_id 字段")
            else:
                logger.info("[MIGRATION]   parent_id 字段已存在，跳过")
            
            # 新增 is_default 字段
            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_default 字段")
            else:
                logger.info("[MIGRATION]   is_default 字段已存在，跳过")
            
            # 新增 create_user_id 字段
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            # 新增 update_user_id 字段
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
            
            # 删除 create_time 字段
            if 'create_time' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN create_time")
                logger.info("[MIGRATION]   成功删除 create_time 字段")
            
            # 删除 update_time 字段
            if 'update_time' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN update_time")
                logger.info("[MIGRATION]   成功删除 update_time 字段")
            
            # 删除 update_date 字段
            if 'update_date' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN update_date")
                logger.info("[MIGRATION]   成功删除 update_date 字段")
            
            # 删除 icon 字段
            if 'icon' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN icon")
                logger.info("[MIGRATION]   成功删除 icon 字段")
            
            # 删除 tenant_id 字段
            if 'tenant_id' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN tenant_id")
                logger.info("[MIGRATION]   成功删除 tenant_id 字段")
            
            # 添加联合索引 (parent_id, sort_order)
            try:
                db.execute_sql("ALTER TABLE agent_category ADD INDEX idx_agent_category_parent_sort (parent_id, sort_order)")
                logger.info("[MIGRATION]   成功添加联合索引 (parent_id, sort_order)")
            except:
                logger.info("[MIGRATION]   联合索引已存在，跳过")
            
            # 添加 is_default_select 字段
            if 'is_default_select' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN is_default_select TINYINT(1) NOT NULL DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_default_select 字段")
            else:
                cursor = db.execute_sql("DESCRIBE agent_category is_default_select;")
                result = cursor.fetchone()
                if result and 'tinyint(1)' not in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN is_default_select TINYINT(1) NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 is_default_select 字段类型为 TINYINT(1)")
        else:
            logger.info("[MIGRATION]   agent_category 表不存在，将在 create_tables 中创建")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 agent_category 表失败: {e}")

    # 更新 agent_instance 表结构
    logger.info("\n[MIGRATION] 更新 agent_instance 表结构...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        if 'agent_instance' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_instance;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 修改 id 字段长度从 varchar(32) -> varchar(40)
            if 'id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance id;")
                result = cursor.fetchone()
                if result and '32' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN id VARCHAR(40) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 id 字段长度为 VARCHAR(40)")
            
            # 修改 title 字段为 name
            if 'title' in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN title name VARCHAR(255) DEFAULT NULL")
                logger.info("[MIGRATION]   成功将 title 字段重命名为 name")
            
            # 修改 dsl 字段类型为 LONGTEXT（如果还不是 LONGTEXT）
            if 'dsl' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance dsl;")
                result = cursor.fetchone()
                if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN dsl LONGTEXT DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 dsl 字段类型修改为 LONGTEXT")
            
            # 重命名 create_date -> created_at
            if 'create_date' in columns and 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN create_date created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功将 create_date 字段重命名为 created_at")
            
            # 重命名 update_date -> updated_at
            if 'update_date' in columns and 'updated_at' not in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN update_date updated_at DATETIME DEFAULT NULL")
                logger.info("[MIGRATION]   成功将 update_date 字段重命名为 updated_at")
            
            # 修改 created_at 字段为 NOT NULL（如果存在且可空）
            if 'created_at' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance created_at;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                    logger.info("[MIGRATION]   成功将 created_at 字段修改为 NOT NULL")
            
            # 新增 create_user_id 字段
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            # 新增 update_user_id 字段
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
            
            # 修改 create_user_id 字段长度（如果存在）
            if 'create_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance create_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 create_user_id 字段长度修改为 VARCHAR(40)")
            
            # 修改 update_user_id 字段长度（如果存在）
            if 'update_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance update_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 update_user_id 字段长度修改为 VARCHAR(40)")
            
            # 删除 create_time 字段
            if 'create_time' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN create_time")
                logger.info("[MIGRATION]   成功删除 create_time 字段")
            
            # 删除 update_time 字段
            if 'update_time' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN update_time")
                logger.info("[MIGRATION]   成功删除 update_time 字段")
            
            # 删除 user_id 字段
            if 'user_id' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN user_id")
                logger.info("[MIGRATION]   成功删除 user_id 字段")
            
            # 确保 code 字段存在且类型正确
            if 'code' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN code VARCHAR(100) DEFAULT NULL")
                db.execute_sql("ALTER TABLE agent_instance ADD INDEX idx_agent_instance_code (code)")
                logger.info("[MIGRATION]   成功添加 code 字段")
            else:
                cursor = db.execute_sql("DESCRIBE agent_instance code;")
                result = cursor.fetchone()
                if result and '100' not in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN code VARCHAR(100) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 code 字段长度修改为 VARCHAR(100)")
            
            # 修改 name 字段长度（如果存在且不是 255）
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance name;")
                result = cursor.fetchone()
                if result and '255' not in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN name VARCHAR(255) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 name 字段长度修改为 VARCHAR(255)")
            
            # 修改 deleted 字段为 NOT NULL
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted TINYINT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功将 deleted 字段修改为 NOT NULL")
            
            # 修改 deleted_user_id 字段长度（如果存在）
            if 'deleted_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 deleted_user_id 字段长度修改为 VARCHAR(40)")
            
            # 删除 canvas_type 字段（如果存在）
            if 'canvas_type' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN canvas_type")
                logger.info("[MIGRATION]   成功删除 canvas_type 字段")
            
            # 删除 permission 字段（如果存在）
            if 'permission' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN permission")
                logger.info("[MIGRATION]   成功删除 permission 字段")
            
            # 修改 created_at 字段为 NOT NULL
            if 'created_at' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance created_at;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                    logger.info("[MIGRATION]   成功将 created_at 字段修改为 NOT NULL")
            
            # 修改 name 字段为 DEFAULT NULL（如果当前是 NOT NULL）
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance name;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'NO':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN name VARCHAR(255) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 name 字段修改为 DEFAULT NULL")
            
            # 修改 deleted 字段为 NOT NULL
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted TINYINT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功将 deleted 字段修改为 NOT NULL")
            
            # 删除 version 字段（如果存在）
            if 'version' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN version")
                logger.info("[MIGRATION]   成功删除 version 字段")
            
            # 新增 status 字段（如果不存在）
            if 'status' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN status TINYINT NOT NULL DEFAULT 1")
                logger.info("[MIGRATION]   成功添加 status 字段")
            else:
                logger.info("[MIGRATION]   status 字段已存在，跳过")
            
            # 新增 is_template 字段（如果不存在）
            if 'is_template' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN is_template TINYINT NOT NULL DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_template 字段")
            else:
                logger.info("[MIGRATION]   is_template 字段已存在，跳过")
            
            # 新增 tags 字段（如果不存在）
            if 'tags' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN tags TEXT")
                logger.info("[MIGRATION]   成功添加 tags 字段")
            else:
                logger.info("[MIGRATION]   tags 字段已存在，跳过")
        else:
            logger.info("[MIGRATION]   agent_instance 表不存在，将在 create_tables 中创建")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 agent_instance 表失败: {e}")

    # 更新 agent_component 表结构
    logger.info("\n[MIGRATION] 更新 agent_component 表结构...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        if 'agent_component' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_component;")
            columns = [column[0] for column in cursor.fetchall()]
            
            # 修改 status 字段类型为 INT（从 BOOLEAN 改为 INT）
            if 'status' in columns:
                cursor = db.execute_sql("DESCRIBE agent_component status;")
                result = cursor.fetchone()
                if result and 'tinyint' not in result[1].lower() and 'int' not in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_component MODIFY COLUMN status INT DEFAULT 1")
                    logger.info("[MIGRATION]   成功将 status 字段类型修改为 INT")
                else:
                    logger.info("[MIGRATION]   status 字段已经是 INT 类型，跳过")
            else:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN status INT DEFAULT 1")
                logger.info("[MIGRATION]   成功添加 status 字段")
            
            # 如果同时存在 sort 和 sort_order 字段，将 sort 的值复制到 sort_order，然后删除 sort
            if 'sort' in columns and 'sort_order' in columns:
                db.execute_sql("UPDATE agent_component SET sort_order = sort WHERE sort IS NOT NULL")
                logger.info("[MIGRATION]   成功将 sort 字段的值复制到 sort_order")
                db.execute_sql("ALTER TABLE agent_component DROP COLUMN sort")
                logger.info("[MIGRATION]   成功删除 sort 字段")
            # 如果只存在 sort 字段，直接重命名为 sort_order
            elif 'sort' in columns and 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE agent_component CHANGE COLUMN sort sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功将 sort 字段重命名为 sort_order")
            elif 'sort_order' not in columns:
                # 新增 sort_order 字段（如果不存在）
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 sort_order 字段")
            else:
                logger.info("[MIGRATION]   sort_order 字段已存在，跳过")
            
            # 新增 component_title 字段（如果不存在）
            if 'component_title' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN component_title VARCHAR(255) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 component_title 字段")
            else:
                logger.info("[MIGRATION]   component_title 字段已存在，跳过")
            
            # 新增 created_at 字段（如果不存在）
            if 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功添加 created_at 字段")
            else:
                logger.info("[MIGRATION]   created_at 字段已存在，跳过")
            
            # 新增 updated_at 字段（如果不存在）
            if 'updated_at' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN updated_at DATETIME DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 updated_at 字段")
            else:
                logger.info("[MIGRATION]   updated_at 字段已存在，跳过")
            
            # 新增 create_user_id 字段（如果不存在）
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            # 新增 update_user_id 字段（如果不存在）
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 agent_component 表失败: {e}")

    # 更新 knowledgebase_document 表中 title 为空的记录
    try:
        logger.info("\n[MIGRATION] 检查 knowledgebase_document 表 title 字段...")
        cursor = db.execute_sql("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'knowledgebase_document' 
            AND COLUMN_NAME = 'title';
        """)
        if cursor.fetchone():
            cursor = db.execute_sql("""
                UPDATE knowledgebase_document 
                SET title = file_name 
                WHERE title IS NULL OR title = '';
            """)
            affected_rows = cursor.rowcount
            logger.info(f"[MIGRATION]   成功更新 {affected_rows} 条记录的 title 字段")
        else:
            logger.info("[MIGRATION]   title 字段不存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 knowledgebase_document 表 title 字段失败: {e}")

    # 创建 chatbot_knowledgebase 表（机器人知识库关联表）
    logger.info("\n[MIGRATION] 创建 chatbot_knowledgebase 表...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        if 'chatbot_knowledgebase' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_knowledgebase (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    created_user_id CHAR(36) DEFAULT NULL,
                    updated_user_id CHAR(36) DEFAULT NULL,
                    deleted TINYINT(1) DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id CHAR(36) DEFAULT NULL,
                    chatbot_id CHAR(36) NOT NULL,
                    knowledgebase_id CHAR(36) NOT NULL,
                    INDEX idx_chatbot_id (chatbot_id),
                    INDEX idx_knowledgebase_id (knowledgebase_id),
                    UNIQUE KEY uk_chatbot_knowledgebase (chatbot_id, knowledgebase_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
            logger.info("[MIGRATION]   chatbot_knowledgebase 表创建成功")
        else:
            logger.info("[MIGRATION]   chatbot_knowledgebase 表已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建 chatbot_knowledgebase 表失败: {e}")

    # 创建/更新 chatbot_chat 表（添加 title 字段）
    logger.info("\n[MIGRATION] 检查 chatbot_chat 表 title 字段...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]
        
        if 'chatbot_chat' in table_names:
            cursor = db.execute_sql("DESCRIBE chatbot_chat;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'title' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat ADD COLUMN title VARCHAR(200) DEFAULT NULL AFTER chatbot_id")
                logger.info("[MIGRATION]   成功添加 title 字段")
            else:
                logger.info("[MIGRATION]   title 字段已存在，跳过")
        else:
            logger.info("[MIGRATION]   chatbot_chat 表不存在，将在 create_tables 中创建")
    except Exception as e:
        logger.error(f"[MIGRATION]   检查 chatbot_chat 表 title 字段失败: {e}")

    # 创建 toolkit_category 表（工具箱分类表）
    logger.info("\n[MIGRATION] 创建 toolkit_category 表...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]

        if 'toolkit_category' not in table_names:
            db.execute_sql("""
                CREATE TABLE toolkit_category (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    type VARCHAR(50) DEFAULT NULL,
                    parent_id CHAR(36) DEFAULT NULL,
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
                    INDEX idx_type (type),
                    INDEX idx_parent_id (parent_id),
                    INDEX idx_sort_order (sort_order),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("[MIGRATION]   成功创建 toolkit_category 表")
        else:
            logger.info("[MIGRATION]   toolkit_category 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE toolkit_category;")
            columns = [column[0] for column in cursor.fetchall()]

            if 'type' not in columns:
                db.execute_sql("ALTER TABLE toolkit_category ADD COLUMN type VARCHAR(50) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 type 字段")
            else:
                logger.info("[MIGRATION]   type 字段已存在，跳过")

            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE toolkit_category ADD COLUMN is_default TINYINT DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_default 字段")
            else:
                logger.info("[MIGRATION]   is_default 字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建 toolkit_category 表失败: {e}")

    # 初始化工具箱默认分类
    logger.info("\n[MIGRATION] 初始化工具箱默认分类...")
    try:
        from app.services.toolkit.service import ToolkitCategoryService
        ToolkitCategoryService.init_default_categories()
        logger.info("[MIGRATION]   工具箱默认分类初始化完成")
    except Exception as e:
        logger.error(f"[MIGRATION]   初始化工具箱默认分类失败: {e}")

    # 删除 skill 表（不再使用数据库存储SKILL技能）
    logger.info("\n[MIGRATION] 删除 skill 表...")
    try:
        cursor = db.execute_sql("SHOW TABLES;")
        tables = cursor.fetchall()
        table_names = [table[0] for table in tables]

        if 'skill' in table_names:
            db.execute_sql("DROP TABLE IF EXISTS skill;")
            logger.info("[MIGRATION]   成功删除 skill 表")
        else:
            logger.info("[MIGRATION]   skill 表不存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   删除 skill 表失败: {e}")

    # 清空 mcp_server 表中的 category_id 字段（弃用 mcp_category 分类）
    logger.info("\n[MIGRATION] 清空 mcp_server 表的 category_id 字段...")
    try:
        db.execute_sql("UPDATE mcp_server SET category_id = NULL WHERE category_id IS NOT NULL;")
        affected = cursor.rowcount if hasattr(cursor, 'rowcount') else 0
        logger.info("[MIGRATION]   已清空 mcp_server.category_id 字段")
    except Exception as e:
        logger.error(f"[MIGRATION]   清空 mcp_server.category_id 字段失败: {e}")

    logger.info("\n[MIGRATION] ✅ 数据库迁移完成")
except Exception as e:
    logger.error(f"\n[MIGRATION] ❌ 数据库迁移失败: {e}")
    raise

logger.info("\n" + "=" * 80)
logger.info("[阶段3/4] 注册智能体组件")
logger.info("=" * 80)

logger.info("\n[COMPONENT] 正在注册智能体组件...")
try:
    from app.core.agent.component import register_components
    
    result = register_components()
    logger.info(f"[COMPONENT] 组件注册完成:")
    logger.info(f"  - 新增组件: {result['added']} 个")
    logger.info(f"  - 更新组件: {result['updated']} 个")
    logger.info(f"  - 失败组件: {result['failed']} 个")
    logger.info(f"  - 扫描组件总数: {result['total']} 个")
    logger.info("[COMPONENT] ✅ 智能体组件注册成功")
except Exception as e:
    logger.error(f"[COMPONENT] ❌ 智能体组件注册失败: {e}")

# MCP服务和文档切片任务执行器将由启动脚本启动
mcp_enabled = config.config.get('mcp', {}).get('enabled', False)
mcp_process = None

# 打印系统Banner（在FastAPI应用创建之前）
try:
    from app import get_banner, get_system_name, get_system_version, get_system_description
    print(get_banner())
    logger.info(f"{get_system_name()} FastAPI应用初始化中...")
    logger.info(f"版本: {get_system_version()}")
    logger.info(f"描述: {get_system_description()}")
except Exception as e:
    logger.warning(f"无法打印Banner: {e}")

# 聊天生命周期管理
@asynccontextmanager
async def chat_event_lifespan(app: FastAPI):
    """
    聊天生命周期管理

    应用启动时恢复待澄清消息，应用关闭时无需特殊处理。
    不再使用事件总线消费者模式。
    """
    from app.services.chat.service import ChatMessageService
    from app.core.chat.stream_buffer import ChatStreamBuffer

    # 清理上次服务运行遗留的流式缓冲区数据
    try:
        ChatStreamBuffer.cleanup_all()
    except Exception as e:
        logger.warning(f"[CHAT] 清理流式缓冲区失败: {e}")

    # 恢复服务重启前处于等待澄清状态的消息
    try:
        recovered = ChatMessageService.recover_pending_clarify_messages()
        if recovered > 0:
            logger.info(f"[CHAT] 恢复了 {recovered} 条待澄清消息")
    except Exception as e:
        logger.warning(f"[CHAT] 恢复待澄清消息失败: {e}")

    # 恢复插件集成待澄清消息
    try:
        from app.core.integration.api_chat import IntegrationChatCoreService
        integration_recovered = IntegrationChatCoreService.recover_pending_clarify_messages()
        if integration_recovered > 0:
            logger.info(f"[CHAT] 恢复了 {integration_recovered} 条插件待澄清消息")
    except Exception as e:
        logger.warning(f"[CHAT] 恢复插件待澄清消息失败: {e}")

    yield

    logger.info("[CHAT] 应用关闭")


# 创建FastAPI应用，禁用默认的docs以使用本地静态资源
app = FastAPI(
    title="AI Center API",
    description="AI服务中心后端API",
    version="1.0.0",
    docs_url=None,  # 禁用默认docs，使用本地静态资源
    redoc_url=None,  # 禁用默认redoc，使用本地静态资源
    lifespan=chat_event_lifespan,
)

# 配置静态文件目录，用于提供Swagger UI和ReDoc的静态资源
from fastapi.staticfiles import StaticFiles
import os

# 检查静态资源目录是否存在
swagger_static_dir = os.path.join(os.path.dirname(__file__), '..', 'web', 'src', 'assets', 'swagger-ui')
if os.path.exists(swagger_static_dir):
    # 挂载静态文件目录到 /static/swagger-ui
    app.mount("/static/swagger-ui", StaticFiles(directory=swagger_static_dir), name="swagger_ui_static")
    logger.info(f"[STATIC] Swagger UI静态资源目录已挂载: {swagger_static_dir}")
else:
    logger.warning(f"[STATIC] Swagger UI静态资源目录不存在: {swagger_static_dir}")

# 自定义Swagger UI路径，使用本地静态资源
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """
    自定义Swagger UI文档页面
    使用本地静态资源加载，不依赖外网CDN
    """
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        # 使用本地静态资源路径
        swagger_js_url="/static/swagger-ui/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui/swagger-ui.css",
    )

# 自定义OAuth2重定向路径
@app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect():
    """
    Swagger UI OAuth2重定向处理
    """
    from fastapi.openapi.docs import get_swagger_ui_oauth2_redirect_html
    return get_swagger_ui_oauth2_redirect_html()

# 自定义ReDoc路径，使用本地静态资源
@app.get("/redoc", include_in_schema=False)
async def custom_redoc_html():
    """
    自定义ReDoc文档页面
    使用本地静态资源加载，不依赖外网CDN
    """
    from fastapi.openapi.docs import get_redoc_html
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=app.title + " - ReDoc",
        # 使用本地静态资源路径
        redoc_js_url="/static/swagger-ui/redoc.standalone.js",
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def database_connection_middleware(request: Request, call_next):
    """
    数据库连接管理中间件
    
    在每次HTTP请求开始时获取数据库连接，在请求结束时（无论成功或异常）
    将连接归还到连接池，避免连接泄露导致"Exceeded maximum connections"错误。
    
    Args:
        request: 请求对象
        call_next: 下一个中间件或路由处理函数
        
    Returns:
        Response: 响应对象
    """
    from app.database.database import get_db_connection, close_db_connection
    
    try:
        get_db_connection()
        response = await call_next(request)
        return response
    finally:
        close_db_connection()

@app.middleware("http")
async def performance_monitoring_middleware(request: Request, call_next):
    """
    请求性能监控中间件
    
    Args:
        request: 请求对象
        call_next: 下一个中间件或路由处理函数
        
    Returns:
        Response: 响应对象
    """
    import time
    
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    process_time_ms = process_time * 1000
    
    response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"
    
    if process_time > 1.0:
        logger.warning(
            f"[慢请求] {request.method} {request.url.path} "
            f"耗时: {process_time:.2f}s ({process_time_ms:.2f}ms) "
            f"客户端: {request.client.host if request.client else 'unknown'}"
        )
    elif process_time > 0.5:
        logger.info(
            f"[中等请求] {request.method} {request.url.path} "
            f"耗时: {process_time:.2f}s ({process_time_ms:.2f}ms)"
        )
    else:
        logger.debug(
            f"[正常请求] {request.method} {request.url.path} "
            f"耗时: {process_time_ms:.2f}ms"
        )
    
    return response

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

# 注册主路由（前缀/aicenter/v1）
app.include_router(router, prefix="/aicenter/v1")

# 单独注册integration API路由（前缀/aicenter/api，用于OpenAI兼容的对外API）
from app.api import integration_api_router
app.include_router(integration_api_router, prefix="/aicenter/api", tags=["integration_api"])

if __name__ == "__main__":
    # 此文件不再直接启动服务
    # 请使用 python -m app.start_server 来启动服务
    print("请使用以下命令启动服务:")
    print("  python -m app.start_server")
    print("或:")
    print("  .venv\\Scripts\\python.exe -m app.start_server")
