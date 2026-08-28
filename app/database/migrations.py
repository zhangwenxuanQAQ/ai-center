"""
数据库迁移模块
"""

import logging

logger = logging.getLogger(__name__)


def run_database_migrations(db):
    """
    执行所有数据库迁移操作
    """
    logger.info("\n[MIGRATION] 正在执行数据库迁移...")
    
    try:
        if db.is_closed():
            db.connect()
        
        _migrate_deleted_columns(db)
        _migrate_chatbot_code_unique(db)
        _migrate_knowledgebase_code_unique(db)
        _migrate_mcp_category(db)
        _migrate_mcp_tool(db)
        _migrate_llm_model(db)
        _migrate_prompt_category(db)
        _migrate_prompt(db)
        _migrate_llm_model_additions(db)
        _migrate_chatbot_model(db)
        _migrate_chatbot_prompt(db)
        _migrate_chat(db)
        _migrate_chat_message(db)
        _migrate_knowledgebase_category(db)
        _migrate_knowledgebase(db)
        _migrate_knowledgebase_document(db)
        _migrate_knowledgebase_document_category(db)
        _migrate_knowledgebase_document_fields(db)
        _migrate_knowledgebase_document_status(db)
        _migrate_knowledgebase_document_location(db)
        _migrate_knowledgebase_document_more_fields(db)
        _migrate_collate(db)
        _migrate_messages_longtext(db)
        _migrate_chat_message_avatar(db)
        _migrate_knowledgebase_document_metadatas(db)
        _migrate_agent_category(db)
        _migrate_agent_instance(db)
        _migrate_agent_component(db)
        _migrate_knowledgebase_document_title(db)
        _migrate_chatbot_knowledgebase(db)
        _migrate_chatbot_integration(db)
        _migrate_chatbot_chat(db)
        _migrate_chatbot_chat_message(db)
        _migrate_chatbot_tool(db)
        _migrate_task_info_source_fields(db)
        _migrate_task_info_description_field(db)

        logger.info("\n[MIGRATION] ✅ 数据库迁移完成")
    except Exception as e:
        logger.error(f"\n[MIGRATION] ❌ 数据库迁移失败: {e}")
        raise


def _get_table_names(db):
    cursor = db.execute_sql("SHOW TABLES;")
    tables = cursor.fetchall()
    return [table[0] for table in tables]


def _migrate_deleted_columns(db):
    """添加deleted相关字段"""
    table_names = _get_table_names(db)
    
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


def _migrate_chatbot_code_unique(db):
    """移除chatbot表中code字段的唯一约束"""
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


def _migrate_knowledgebase_code_unique(db):
    """移除knowledgebase表中code字段的唯一约束"""
    logger.info("\n[MIGRATION] 移除knowledgebase表中code字段的唯一约束...")
    try:
        cursor = db.execute_sql("SHOW INDEX FROM knowledgebase;")
        indexes = cursor.fetchall()
        
        unique_index_name = None
        for index in indexes:
            if index[4] == 'code' and index[1] == 0:
                unique_index_name = index[2]
                break
        
        if unique_index_name:
            db.execute_sql(f"ALTER TABLE knowledgebase DROP INDEX {unique_index_name};")
            logger.info("[MIGRATION]   成功移除knowledgebase表中code字段的唯一约束")
        else:
            logger.info("[MIGRATION]   knowledgebase表中code字段没有唯一约束，跳过移除")
    except Exception as e:
        logger.error(f"[MIGRATION]   移除knowledgebase表中code字段的唯一约束失败: {e}")


def _migrate_mcp_category(db):
    """为mcp_category表添加is_default字段"""
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


def _migrate_mcp_tool(db):
    """为mcp_tool表添加title和extra_config字段"""
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


def _migrate_llm_model(db):
    """为llm_model表添加category_id、tags、config、status字段"""
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
            db.execute_sql("ALTER TABLE llm_model MODIFY COLUMN provider VARCHAR(255) DEFAULT NULL")
            logger.info("  成功修改provider字段为可空")
    except Exception as e:
        logger.info(f"  添加字段失败: {e}")


def _migrate_prompt_category(db):
    """创建prompt_category表"""
    logger.info("\n创建 prompt_category 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_prompt(db):
    """修改prompt表结构"""
    logger.info("\n修改 prompt 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE prompt;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'category_id' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN category_id VARCHAR(40) DEFAULT NULL")
            logger.info("  成功添加 category_id 字段")
        else:
            logger.info("  category_id 字段已存在")
        
        if 'tags' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN tags TEXT DEFAULT NULL")
            logger.info("  成功添加 tags 字段")
        else:
            logger.info("  tags 字段已存在")
        
        if 'status' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN status TINYINT DEFAULT 1")
            logger.info("  成功添加 status 字段")
        else:
            logger.info("  status 字段已存在")
        
        if 'description' not in columns:
            db.execute_sql("ALTER TABLE prompt ADD COLUMN description TEXT DEFAULT NULL")
            logger.info("  成功添加 description 字段")
        else:
            logger.info("  description 字段已存在")
        
        if 'category' in columns:
            db.execute_sql("ALTER TABLE prompt DROP COLUMN category")
            logger.info("  成功删除 category 字段")
        else:
            logger.info("  category 字段不存在，无需删除")
    except Exception as e:
        logger.info(f"  修改 prompt 表结构失败: {e}")


def _migrate_llm_model_additions(db):
    """修改llm_model表结构（添加support_image等）"""
    logger.info("\n修改 llm_model 表结构...")
    try:
        cursor = db.execute_sql("DESCRIBE llm_model;")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'support_image' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN support_image TINYINT DEFAULT 0")
            logger.info("  成功添加 support_image 字段")
        else:
            logger.info("  support_image 字段已存在")
        
        if 'is_default' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN is_default TINYINT DEFAULT 0")
            logger.info("  成功添加 is_default 字段")
        else:
            logger.info("  is_default 字段已存在")
        
        if 'connection_status' not in columns:
            db.execute_sql("ALTER TABLE llm_model ADD COLUMN connection_status TINYINT DEFAULT -1")
            logger.info("  成功添加 connection_status 字段")
        else:
            logger.info("  connection_status 字段已存在，跳过")
    except Exception as e:
        logger.info(f"  修改 llm_model 表结构失败: {e}")


def _migrate_chatbot_model(db):
    """为chatbot_model表添加config字段"""
    logger.info("\n为 chatbot_model 表添加 config 字段...")
    try:
        table_names = _get_table_names(db)
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


def _migrate_chatbot_prompt(db):
    """创建chatbot_prompt表"""
    logger.info("\n创建 chatbot_prompt 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_chat(db):
    """修改chat表结构"""
    logger.info("\n修改 chat 表结构...")
    try:
        table_names = _get_table_names(db)
        
        if 'chat' in table_names:
            cursor = db.execute_sql("DESCRIBE chat;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'title' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN title VARCHAR(255) DEFAULT NULL")
                logger.info("  成功添加 title 字段")
            else:
                logger.info("  title 字段已存在")
            
            if 'model_id' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN model_id VARCHAR(40) DEFAULT NULL")
                logger.info("  成功添加 model_id 字段")
            else:
                logger.info("  model_id 字段已存在")
            
            if 'config' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN config TEXT DEFAULT NULL")
                logger.info("  成功添加 config 字段")
            else:
                logger.info("  config 字段已存在")
            
            if 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN sort_order INT DEFAULT 0")
                logger.info("  成功添加 sort_order 字段")
            else:
                logger.info("  sort_order 字段已存在")
            
            if 'is_top' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN is_top TINYINT DEFAULT 0")
                logger.info("  成功添加 is_top 字段")
            else:
                logger.info("  is_top 字段已存在")
            
            if 'system_prompt' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN system_prompt TEXT DEFAULT NULL")
                logger.info("  成功添加 system_prompt 字段")
            else:
                logger.info("  system_prompt 字段已存在")
            
            if 'messages' not in columns:
                db.execute_sql("ALTER TABLE chat ADD COLUMN messages TEXT DEFAULT NULL")
                logger.info("  成功添加 messages 字段")
            else:
                logger.info("  messages 字段已存在")
            
            if 'message' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN message")
                logger.info("  成功删除 message 字段")
            
            if 'response' in columns:
                db.execute_sql("ALTER TABLE chat DROP COLUMN response")
                logger.info("  成功删除 response 字段")
        else:
            logger.info("  chat 表不存在，跳过")
    except Exception as e:
        logger.info(f"  修改 chat 表结构失败: {e}")


def _migrate_chat_message(db):
    """创建chat_message表"""
    logger.info("\n创建 chat_message 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_knowledgebase_category(db):
    """创建knowledgebase_category表"""
    logger.info("\n创建 knowledgebase_category 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_knowledgebase(db):
    """处理knowledgebase表"""
    logger.info("\n处理 knowledgebase 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_knowledgebase_document(db):
    """处理knowledgebase_document表"""
    logger.info("\n处理 knowledgebase_document 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_knowledgebase_document_category(db):
    """处理knowledgebase_document_category表"""
    logger.info("\n处理 knowledgebase_document_category 表...")
    try:
        table_names = _get_table_names(db)
        
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


def _migrate_knowledgebase_document_fields(db):
    """为knowledgebase_document表添加category_id、title、tags和document_config字段"""
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


def _migrate_knowledgebase_document_status(db):
    """将knowledgebase_document表的status字段从字符串类型改为布尔类型"""
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
                db.execute_sql("ALTER TABLE knowledgebase_document ADD COLUMN status_temp BOOLEAN DEFAULT TRUE;")
                db.execute_sql("UPDATE knowledgebase_document SET status_temp = CASE WHEN status = 'inactive' THEN FALSE ELSE TRUE END;")
                db.execute_sql("ALTER TABLE knowledgebase_document DROP COLUMN status;")
                db.execute_sql("ALTER TABLE knowledgebase_document CHANGE COLUMN status_temp status BOOLEAN DEFAULT TRUE;")
                logger.info("  成功将 status 字段从字符串类型改为布尔类型")
            else:
                logger.info("  status 字段已经是布尔类型，跳过")
        else:
            logger.info("  status 字段不存在，跳过")
    except Exception as e:
        logger.info(f"  修改 knowledgebase_document 表的 status 字段类型失败: {e}")


def _migrate_knowledgebase_document_location(db):
    """更新knowledgebase_document表的location和file_name字段"""
    logger.info("\n更新 knowledgebase_document 表的 location 和 file_name 字段...")
    try:
        cursor = db.execute_sql("DESCRIBE knowledgebase_document;")
        columns = cursor.fetchall()
        
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


def _migrate_knowledgebase_document_more_fields(db):
    """为knowledgebase_document表添加task_progress_message等字段"""
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
            cursor = db.execute_sql("DESCRIBE knowledgebase_document thumbnail;")
            result = cursor.fetchone()
            if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                db.execute_sql("ALTER TABLE knowledgebase_document MODIFY COLUMN thumbnail LONGTEXT DEFAULT NULL")
                logger.info("  成功将 thumbnail 字段类型修改为 LONGTEXT")
            else:
                logger.info("  thumbnail 字段已存在且类型正确，跳过")
    except Exception as e:
        logger.info(f"  为 knowledgebase_document 表添加字段失败: {e}")


def _migrate_collate(db):
    """统一所有表的COLLATE字符集为utf8mb4_0900_ai_ci"""
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


def _migrate_messages_longtext(db):
    """修改messages字段类型为LONGTEXT"""
    logger.info("\n修改messages字段类型为LONGTEXT...")
    try:
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

        logger.info("  强制修改chat_message表的extra_content字段...")
        try:
            cursor = db.execute_sql("""
                SELECT column_name, data_type, column_type
                FROM information_schema.columns
                WHERE table_name = 'chat_message'
                AND column_name = 'extra_content'
            """)
            result = cursor.fetchone()
            
            if result:
                logger.info(f"  当前字段类型: {result[1]}, {result[2]}")
                db.execute_sql("ALTER TABLE chat_message MODIFY COLUMN extra_content LONGTEXT")
                logger.info("  字段 extra_content 已成功修改为 LONGTEXT 类型")
            else:
                logger.info("  字段 extra_content 不存在")
        except Exception as e:
            logger.info(f"  修改extra_content字段失败: {e}")

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


def _migrate_chat_message_avatar(db):
    """修改chat_message表的avatar字段类型为TEXT"""
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


def _migrate_knowledgebase_document_metadatas(db):
    """为knowledgebase_document表添加metadatas字段"""
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


def _migrate_agent_category(db):
    """更新agent_category表结构"""
    logger.info("\n[MIGRATION] 更新 agent_category 表结构...")
    try:
        table_names = _get_table_names(db)
        
        if 'agent_category' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_category;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'create_date' in columns and 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_category CHANGE COLUMN create_date created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功将 create_date 字段重命名为 created_at")
            
            if 'sort' in columns and 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE agent_category CHANGE COLUMN sort sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功将 sort 字段重命名为 sort_order")
            
            if 'id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category id;")
                result = cursor.fetchone()
                if result and '32' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN id VARCHAR(40) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 id 字段长度为 VARCHAR(40)")
            
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category name;")
                result = cursor.fetchone()
                if result and '200' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN name VARCHAR(255) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 name 字段长度为 VARCHAR(255)")
            
            if 'description' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category description;")
                result = cursor.fetchone()
                if result and 'varchar' in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN description TEXT")
                    logger.info("[MIGRATION]   成功修改 description 字段类型为 TEXT")
            
            if 'sort_order' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category sort_order;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 sort_order 字段为 NOT NULL")
            
            if 'is_default' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category is_default;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 is_default 字段为 NOT NULL")
            
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功修改 deleted 字段为 NOT NULL")
            
            if 'deleted_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_category deleted_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_category MODIFY COLUMN deleted_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功修改 deleted_user_id 字段长度为 VARCHAR(40)")
            
            if 'parent_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN parent_id VARCHAR(40) DEFAULT NULL")
                db.execute_sql("ALTER TABLE agent_category ADD INDEX idx_agent_category_parent_id (parent_id)")
                logger.info("[MIGRATION]   成功添加 parent_id 字段")
            else:
                logger.info("[MIGRATION]   parent_id 字段已存在，跳过")
            
            if 'is_default' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_default 字段")
            else:
                logger.info("[MIGRATION]   is_default 字段已存在，跳过")
            
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_category ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
            
            if 'create_time' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN create_time")
                logger.info("[MIGRATION]   成功删除 create_time 字段")
            
            if 'update_time' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN update_time")
                logger.info("[MIGRATION]   成功删除 update_time 字段")
            
            if 'update_date' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN update_date")
                logger.info("[MIGRATION]   成功删除 update_date 字段")
            
            if 'icon' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN icon")
                logger.info("[MIGRATION]   成功删除 icon 字段")
            
            if 'tenant_id' in columns:
                db.execute_sql("ALTER TABLE agent_category DROP COLUMN tenant_id")
                logger.info("[MIGRATION]   成功删除 tenant_id 字段")
            
            try:
                db.execute_sql("ALTER TABLE agent_category ADD INDEX idx_agent_category_parent_sort (parent_id, sort_order)")
                logger.info("[MIGRATION]   成功添加联合索引 (parent_id, sort_order)")
            except:
                logger.info("[MIGRATION]   联合索引已存在，跳过")
            
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


def _migrate_agent_instance(db):
    """更新agent_instance表结构"""
    logger.info("\n[MIGRATION] 更新 agent_instance 表结构...")
    try:
        table_names = _get_table_names(db)
        
        if 'agent_instance' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_instance;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance id;")
                result = cursor.fetchone()
                if result and '32' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN id VARCHAR(40) NOT NULL")
                    logger.info("[MIGRATION]   成功修改 id 字段长度为 VARCHAR(40)")
            
            if 'title' in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN title name VARCHAR(255) DEFAULT NULL")
                logger.info("[MIGRATION]   成功将 title 字段重命名为 name")
            
            if 'dsl' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance dsl;")
                result = cursor.fetchone()
                if result and 'text' in result[1].lower() and 'longtext' not in result[1].lower():
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN dsl LONGTEXT DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 dsl 字段类型修改为 LONGTEXT")
            
            if 'create_date' in columns and 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN create_date created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功将 create_date 字段重命名为 created_at")
            
            if 'update_date' in columns and 'updated_at' not in columns:
                db.execute_sql("ALTER TABLE agent_instance CHANGE COLUMN update_date updated_at DATETIME DEFAULT NULL")
                logger.info("[MIGRATION]   成功将 update_date 字段重命名为 updated_at")
            
            if 'created_at' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance created_at;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                    logger.info("[MIGRATION]   成功将 created_at 字段修改为 NOT NULL")
            
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
            
            if 'create_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance create_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 create_user_id 字段长度修改为 VARCHAR(40)")
            
            if 'update_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance update_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 update_user_id 字段长度修改为 VARCHAR(40)")
            
            if 'create_time' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN create_time")
                logger.info("[MIGRATION]   成功删除 create_time 字段")
            
            if 'update_time' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN update_time")
                logger.info("[MIGRATION]   成功删除 update_time 字段")
            
            if 'user_id' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN user_id")
                logger.info("[MIGRATION]   成功删除 user_id 字段")
            
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
            
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance name;")
                result = cursor.fetchone()
                if result and '255' not in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN name VARCHAR(255) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 name 字段长度修改为 VARCHAR(255)")
            
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted TINYINT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功将 deleted 字段修改为 NOT NULL")
            
            if 'deleted_user_id' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted_user_id;")
                result = cursor.fetchone()
                if result and '36' in result[1]:
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted_user_id VARCHAR(40) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 deleted_user_id 字段长度修改为 VARCHAR(40)")
            
            if 'canvas_type' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN canvas_type")
                logger.info("[MIGRATION]   成功删除 canvas_type 字段")
            
            if 'permission' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN permission")
                logger.info("[MIGRATION]   成功删除 permission 字段")
            
            if 'created_at' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance created_at;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                    logger.info("[MIGRATION]   成功将 created_at 字段修改为 NOT NULL")
            
            if 'name' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance name;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'NO':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN name VARCHAR(255) DEFAULT NULL")
                    logger.info("[MIGRATION]   成功将 name 字段修改为 DEFAULT NULL")
            
            if 'deleted' in columns:
                cursor = db.execute_sql("DESCRIBE agent_instance deleted;")
                result = cursor.fetchone()
                if result and result[2].upper() == 'YES':
                    db.execute_sql("ALTER TABLE agent_instance MODIFY COLUMN deleted TINYINT NOT NULL DEFAULT 0")
                    logger.info("[MIGRATION]   成功将 deleted 字段修改为 NOT NULL")
            
            if 'version' in columns:
                db.execute_sql("ALTER TABLE agent_instance DROP COLUMN version")
                logger.info("[MIGRATION]   成功删除 version 字段")
            
            if 'status' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN status TINYINT NOT NULL DEFAULT 1")
                logger.info("[MIGRATION]   成功添加 status 字段")
            else:
                logger.info("[MIGRATION]   status 字段已存在，跳过")
            
            if 'is_template' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN is_template TINYINT NOT NULL DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 is_template 字段")
            else:
                logger.info("[MIGRATION]   is_template 字段已存在，跳过")
            
            if 'tags' not in columns:
                db.execute_sql("ALTER TABLE agent_instance ADD COLUMN tags TEXT")
                logger.info("[MIGRATION]   成功添加 tags 字段")
            else:
                logger.info("[MIGRATION]   tags 字段已存在，跳过")
        else:
            logger.info("[MIGRATION]   agent_instance 表不存在，将在 create_tables 中创建")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 agent_instance 表失败: {e}")


def _migrate_agent_component(db):
    """更新agent_component表结构"""
    logger.info("\n[MIGRATION] 更新 agent_component 表结构...")
    try:
        table_names = _get_table_names(db)
        
        if 'agent_component' in table_names:
            cursor = db.execute_sql("DESCRIBE agent_component;")
            columns = [column[0] for column in cursor.fetchall()]
            
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
            
            if 'sort' in columns and 'sort_order' in columns:
                db.execute_sql("UPDATE agent_component SET sort_order = sort WHERE sort IS NOT NULL")
                logger.info("[MIGRATION]   成功将 sort 字段的值复制到 sort_order")
                db.execute_sql("ALTER TABLE agent_component DROP COLUMN sort")
                logger.info("[MIGRATION]   成功删除 sort 字段")
            elif 'sort' in columns and 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE agent_component CHANGE COLUMN sort sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功将 sort 字段重命名为 sort_order")
            elif 'sort_order' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN sort_order INT DEFAULT 0")
                logger.info("[MIGRATION]   成功添加 sort_order 字段")
            else:
                logger.info("[MIGRATION]   sort_order 字段已存在，跳过")
            
            if 'component_title' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN component_title VARCHAR(255) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 component_title 字段")
            else:
                logger.info("[MIGRATION]   component_title 字段已存在，跳过")
            
            if 'created_at' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                logger.info("[MIGRATION]   成功添加 created_at 字段")
            else:
                logger.info("[MIGRATION]   created_at 字段已存在，跳过")
            
            if 'updated_at' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN updated_at DATETIME DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 updated_at 字段")
            else:
                logger.info("[MIGRATION]   updated_at 字段已存在，跳过")
            
            if 'create_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN create_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 create_user_id 字段")
            else:
                logger.info("[MIGRATION]   create_user_id 字段已存在，跳过")
            
            if 'update_user_id' not in columns:
                db.execute_sql("ALTER TABLE agent_component ADD COLUMN update_user_id VARCHAR(40) DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 update_user_id 字段")
            else:
                logger.info("[MIGRATION]   update_user_id 字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   更新 agent_component 表失败: {e}")


def _migrate_knowledgebase_document_title(db):
    """更新knowledgebase_document表的title字段"""
    logger.info("\n[MIGRATION] 检查 knowledgebase_document 表 title 字段...")
    try:
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


def _migrate_chatbot_knowledgebase(db):
    """创建chatbot_knowledgebase表"""
    logger.info("\n[MIGRATION] 创建 chatbot_knowledgebase 表...")
    try:
        table_names = _get_table_names(db)
        
        if 'chatbot_knowledgebase' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_knowledgebase (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("[MIGRATION]   成功创建 chatbot_knowledgebase 表")
        else:
            logger.info("[MIGRATION]   chatbot_knowledgebase 表已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建 chatbot_knowledgebase 表失败: {e}")


def _migrate_chatbot_integration(db):
    """创建chatbot_integration表"""
    logger.info("\n[MIGRATION] 创建 chatbot_integration 表...")
    try:
        table_names = _get_table_names(db)
        
        if 'chatbot_integration' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_integration (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    chatbot_id VARCHAR(40) NOT NULL,
                    integration_type VARCHAR(50) NOT NULL,
                    config TEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    create_user_id VARCHAR(40) DEFAULT NULL,
                    update_user_id VARCHAR(40) DEFAULT NULL,
                    deleted TINYINT DEFAULT 0,
                    deleted_at DATETIME DEFAULT NULL,
                    deleted_user_id VARCHAR(36) DEFAULT NULL,
                    INDEX idx_chatbot_id (chatbot_id),
                    INDEX idx_integration_type (integration_type),
                    INDEX idx_deleted (deleted)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("[MIGRATION]   成功创建 chatbot_integration 表")
        else:
            logger.info("[MIGRATION]   chatbot_integration 表已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建 chatbot_integration 表失败: {e}")


def _migrate_chatbot_chat(db):
    """创建/更新chatbot_chat表"""
    logger.info("\n[MIGRATION] 创建/更新 chatbot_chat 表...")
    try:
        table_names = _get_table_names(db)
        
        if 'chatbot_chat' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_chat (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    integration_id VARCHAR(40) NOT NULL,
                    chatbot_id VARCHAR(40) NOT NULL,
                    title VARCHAR(200) DEFAULT NULL,
                    messages LONGTEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_integration_id (integration_id),
                    INDEX idx_chatbot_id (chatbot_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("[MIGRATION]   成功创建 chatbot_chat 表")
        else:
            logger.info("[MIGRATION]   chatbot_chat 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE chatbot_chat;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'integration_id' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat ADD COLUMN integration_id VARCHAR(40) NOT NULL AFTER id")
                db.execute_sql("ALTER TABLE chatbot_chat ADD INDEX idx_integration_id (integration_id)")
                logger.info("[MIGRATION]   成功添加 integration_id 字段")
            else:
                logger.info("[MIGRATION]   integration_id 字段已存在，跳过")
            
            if 'title' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat ADD COLUMN title VARCHAR(200) DEFAULT NULL AFTER chatbot_id")
                logger.info("[MIGRATION]   成功添加 title 字段")
            else:
                logger.info("[MIGRATION]   title 字段已存在，跳过")
            
            if 'messages' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat ADD COLUMN messages LONGTEXT DEFAULT NULL AFTER title")
                logger.info("[MIGRATION]   成功添加 messages 字段")
            else:
                logger.info("[MIGRATION]   messages 字段已存在，跳过")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建/更新 chatbot_chat 表失败: {e}")


def _migrate_chatbot_chat_message(db):
    """创建/更新chatbot_chat_message表"""
    logger.info("\n[MIGRATION] 创建/更新 chatbot_chat_message 表...")
    try:
        table_names = _get_table_names(db)
        
        if 'chatbot_chat_message' not in table_names:
            db.execute_sql("""
                CREATE TABLE chatbot_chat_message (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    chatbot_id VARCHAR(40) NOT NULL,
                    chat_id VARCHAR(40) NOT NULL,
                    message_id VARCHAR(40) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    content LONGTEXT NOT NULL,
                    extra_content LONGTEXT DEFAULT NULL,
                    reasoning_content LONGTEXT DEFAULT NULL,
                    reasoning_time INT DEFAULT NULL,
                    model_id VARCHAR(40) DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_chatbot_id (chatbot_id),
                    INDEX idx_chat_id (chat_id),
                    INDEX idx_message_id (message_id),
                    INDEX idx_model_id (model_id),
                    INDEX idx_chat_created (chat_id, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)
            logger.info("[MIGRATION]   成功创建 chatbot_chat_message 表")
        else:
            logger.info("[MIGRATION]   chatbot_chat_message 表已存在，检查字段...")
            cursor = db.execute_sql("DESCRIBE chatbot_chat_message;")
            columns = [column[0] for column in cursor.fetchall()]
            
            if 'chatbot_id' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN chatbot_id VARCHAR(40) NOT NULL")
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD INDEX idx_chatbot_id (chatbot_id)")
                logger.info("[MIGRATION]   成功添加 chatbot_id 字段")
            
            if 'chat_id' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN chat_id VARCHAR(40) NOT NULL")
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD INDEX idx_chat_id (chat_id)")
                logger.info("[MIGRATION]   成功添加 chat_id 字段")
            
            if 'message_id' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN message_id VARCHAR(40) NOT NULL")
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD INDEX idx_message_id (message_id)")
                logger.info("[MIGRATION]   成功添加 message_id 字段")
            
            if 'role' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN role VARCHAR(20) NOT NULL")
                logger.info("[MIGRATION]   成功添加 role 字段")
            
            if 'content' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN content LONGTEXT NOT NULL")
                logger.info("[MIGRATION]   成功添加 content 字段")
            
            if 'extra_content' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN extra_content LONGTEXT DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 extra_content 字段")
            
            if 'reasoning_content' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN reasoning_content LONGTEXT DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 reasoning_content 字段")
            
            if 'reasoning_time' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN reasoning_time INT DEFAULT NULL")
                logger.info("[MIGRATION]   成功添加 reasoning_time 字段")
            
            if 'model_id' not in columns:
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD COLUMN model_id VARCHAR(40) DEFAULT NULL")
                db.execute_sql("ALTER TABLE chatbot_chat_message ADD INDEX idx_model_id (model_id)")
                logger.info("[MIGRATION]   成功添加 model_id 字段")
    except Exception as e:
        logger.error(f"[MIGRATION]   创建/更新 chatbot_chat_message 表失败: {e}")


def _migrate_chatbot_tool(db):
    """
    迁移 chatbot_tool 表结构：
    删除 mcp_tool_id/mcp_server_id 字段，新增 tool_type/configs 字段。
    已有记录按 mcp_server_id 分组，组装为 configs={server_id, tool_ids} 的新记录，
    旧记录删除。如果已经更新过表结构则跳过。
    支持从中断的中间状态（tool_type已加但旧列仍在）恢复。
    """
    logger.info("\n[MIGRATION] 迁移 chatbot_tool 表结构...")
    try:
        import json
        import uuid
        table_names = _get_table_names(db)

        if 'chatbot_tool' not in table_names:
            logger.info("[MIGRATION]   chatbot_tool 表不存在，将在create_tables中创建")
            return

        cursor = db.execute_sql("DESCRIBE chatbot_tool;")
        columns = [column[0] for column in cursor.fetchall()]

        # 删除旧的 (chatbot_id, mcp_tool_id) 唯一索引（若存在）
        def _drop_old_indexes():
            try:
                idx_cursor = db.execute_sql(
                    "SELECT INDEX_NAME FROM information_schema.statistics "
                    "WHERE table_name = 'chatbot_tool' AND column_name = 'mcp_tool_id' "
                    "GROUP BY INDEX_NAME;"
                )
                for idx_row in idx_cursor.fetchall():
                    idx_name = idx_row[0]
                    db.execute_sql(f"ALTER TABLE chatbot_tool DROP INDEX `{idx_name}`")
                    logger.info(f"[MIGRATION]   已删除索引 {idx_name}")
            except Exception as e:
                logger.info(f"[MIGRATION]   删除旧索引时跳过: {e}")

        def _drop_old_columns(cols):
            if 'mcp_tool_id' in cols:
                db.execute_sql("ALTER TABLE chatbot_tool DROP COLUMN mcp_tool_id")
                logger.info("[MIGRATION]   已删除 mcp_tool_id 字段")
            if 'mcp_server_id' in cols:
                db.execute_sql("ALTER TABLE chatbot_tool DROP COLUMN mcp_server_id")
                logger.info("[MIGRATION]   已删除 mcp_server_id 字段")

        # 情况A：tool_type 已存在（新表或已完成/中断的迁移）
        if 'tool_type' in columns:
            # 确保 configs 字段存在
            if 'configs' not in columns:
                db.execute_sql("ALTER TABLE chatbot_tool ADD COLUMN configs TEXT DEFAULT NULL")
                logger.info("[MIGRATION]   成功补充 configs 字段")
            # 清理可能残留的旧列（中断恢复）
            if 'mcp_tool_id' in columns or 'mcp_server_id' in columns:
                logger.info("[MIGRATION]   检测到残留旧字段，清理 mcp_tool_id/mcp_server_id")
                _drop_old_indexes()
                _drop_old_columns(columns)
            else:
                logger.info("[MIGRATION]   chatbot_tool 已是最新结构，跳过迁移")
            return

        # 情况B：旧表结构，开始完整迁移
        logger.info("[MIGRATION]   检测到旧表结构，开始迁移 mcp_tool_id/mcp_server_id -> tool_type/configs")

        # 1. 新增字段
        db.execute_sql("ALTER TABLE chatbot_tool ADD COLUMN tool_type VARCHAR(50) DEFAULT NULL")
        db.execute_sql("ALTER TABLE chatbot_tool ADD COLUMN configs TEXT DEFAULT NULL")
        logger.info("[MIGRATION]   成功新增 tool_type/configs 字段")

        # 2. 先删除旧唯一索引，避免新记录插入时 (chatbot_id, mcp_tool_id) 冲突
        _drop_old_indexes()

        # 3. 读取旧记录，按 (chatbot_id, mcp_server_id) 分组
        cursor = db.execute_sql(
            "SELECT id, chatbot_id, mcp_server_id, mcp_tool_id, deleted, deleted_at, deleted_user_id, "
            "created_at, updated_at, create_user_id, update_user_id FROM chatbot_tool;"
        )
        old_rows = cursor.fetchall()

        grouped = {}  # key: (chatbot_id, mcp_server_id) -> {"tool_ids": [], "deleted": bool, ...}
        for row in old_rows:
            (rid, chatbot_id, mcp_server_id, mcp_tool_id,
             deleted, deleted_at, deleted_user_id,
             created_at, updated_at, create_user_id, update_user_id) = row
            key = (chatbot_id, mcp_server_id)
            if key not in grouped:
                grouped[key] = {
                    "chatbot_id": chatbot_id,
                    "server_id": mcp_server_id,
                    "tool_ids": [],
                    "deleted": bool(deleted),
                    "deleted_at": deleted_at,
                    "deleted_user_id": deleted_user_id,
                    "created_at": created_at,
                    "updated_at": updated_at,
                    "create_user_id": create_user_id,
                    "update_user_id": update_user_id,
                }
            if mcp_tool_id:
                grouped[key]["tool_ids"].append(str(mcp_tool_id))

        # 4. 删除所有旧记录
        db.execute_sql("DELETE FROM chatbot_tool;")
        logger.info(f"[MIGRATION]   已清空旧记录 {len(old_rows)} 条")

        # 5. 删除旧字段（此时索引已删，可安全删列）
        _drop_old_columns(columns)

        # 6. 按分组写入新记录
        new_count = 0
        for key, info in grouped.items():
            configs = json.dumps({
                "server_id": info["server_id"],
                "tool_ids": info["tool_ids"],
            }, ensure_ascii=False)
            new_id = uuid.uuid4().hex
            db.execute_sql(
                "INSERT INTO chatbot_tool "
                "(id, chatbot_id, tool_type, configs, deleted, deleted_at, deleted_user_id, "
                "created_at, updated_at, create_user_id, update_user_id) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (new_id, info["chatbot_id"], "mcp", configs,
                 1 if info["deleted"] else 0, info["deleted_at"], info["deleted_user_id"],
                 info["created_at"], info["updated_at"], info["create_user_id"], info["update_user_id"])
            )
            new_count += 1

        logger.info(f"[MIGRATION]   已生成新记录 {new_count} 条")

        # 7. 添加新索引
        try:
            db.execute_sql("ALTER TABLE chatbot_tool ADD INDEX idx_chatbot_tool_chatbot_id_tool_type (chatbot_id, tool_type)")
            logger.info("[MIGRATION]   已添加 (chatbot_id, tool_type) 索引")
        except Exception as e:
            logger.info(f"[MIGRATION]   添加索引跳过: {e}")

        logger.info("[MIGRATION]   chatbot_tool 表迁移完成")
    except Exception as e:
        logger.error(f"[MIGRATION]   迁移 chatbot_tool 表失败: {e}")


def _migrate_task_info_source_fields(db):
    """
    迁移 task_info 表结构：
    新增 source_type/source_id 字段（关联业务模块源记录，供task_info_hook同步使用）。
    如果已经更新过表结构则跳过。
    """
    logger.info("\n[MIGRATION] 迁移 task_info 表结构...")
    try:
        table_names = _get_table_names(db)

        if 'task_info' not in table_names:
            logger.info("[MIGRATION]   task_info 表不存在，将在create_tables中创建")
            return

        cursor = db.execute_sql("DESCRIBE task_info;")
        columns = [column[0] for column in cursor.fetchall()]

        if 'source_type' not in columns:
            db.execute_sql(
                "ALTER TABLE task_info ADD COLUMN source_type VARCHAR(50) DEFAULT NULL "
                "COMMENT '来源类型：ontology_task/knowledgebase_document'"
            )
            logger.info("[MIGRATION]   成功添加 source_type 字段")
        else:
            logger.info("[MIGRATION]   source_type 字段已存在，跳过")

        if 'source_id' not in columns:
            db.execute_sql(
                "ALTER TABLE task_info ADD COLUMN source_id VARCHAR(40) DEFAULT NULL "
                "COMMENT '来源记录ID'"
            )
            logger.info("[MIGRATION]   成功添加 source_id 字段")
        else:
            logger.info("[MIGRATION]   source_id 字段已存在，跳过")

        # 添加 (source_type, source_id) 组合索引
        try:
            db.execute_sql(
                "ALTER TABLE task_info ADD INDEX idx_task_info_source (source_type, source_id)"
            )
            logger.info("[MIGRATION]   已添加 (source_type, source_id) 索引")
        except Exception as e:
            logger.info(f"[MIGRATION]   添加索引跳过: {e}")

        logger.info("[MIGRATION]   task_info 表迁移完成")
    except Exception as e:
        logger.error(f"[MIGRATION]   迁移 task_info 表失败: {e}")


def _migrate_task_info_description_field(db):
    """
    迁移 task_info 表结构：
    新增 description 字段（任务描述）。
    如果已经更新过表结构则跳过。
    """
    logger.info("\n[MIGRATION] 迁移 task_info 表 description 字段...")
    try:
        table_names = _get_table_names(db)

        if 'task_info' not in table_names:
            logger.info("[MIGRATION]   task_info 表不存在，将在create_tables中创建")
            return

        cursor = db.execute_sql("DESCRIBE task_info;")
        columns = [column[0] for column in cursor.fetchall()]

        if 'description' not in columns:
            db.execute_sql(
                "ALTER TABLE task_info ADD COLUMN description TEXT DEFAULT NULL "
                "COMMENT '任务描述'"
            )
            logger.info("[MIGRATION]   成功添加 description 字段")
        else:
            logger.info("[MIGRATION]   description 字段已存在，跳过")

        logger.info("[MIGRATION]   task_info 表 description 字段迁移完成")
    except Exception as e:
        logger.error(f"[MIGRATION]   迁移 task_info 表 description 字段失败: {e}")


def _migrate_task_output_field(db):
    """
    迁移 task_info / task_log 表结构：
    新增 task_output 字段（任务输出结果JSON）。
    如果已经更新过表结构则跳过。
    """
    logger.info("\n[MIGRATION] 迁移 task_info / task_log 表 task_output 字段...")
    for table_name in ('task_info', 'task_log'):
        try:
            table_names = _get_table_names(db)

            if table_name not in table_names:
                logger.info(f"[MIGRATION]   {table_name} 表不存在，将在create_tables中创建")
                continue

            cursor = db.execute_sql(f"DESCRIBE {table_name};")
            columns = [column[0] for column in cursor.fetchall()]

            if 'task_output' not in columns:
                db.execute_sql(
                    f"ALTER TABLE {table_name} ADD COLUMN task_output TEXT DEFAULT NULL "
                    f"COMMENT '任务输出结果JSON'"
                )
                logger.info(f"[MIGRATION]   成功在 {table_name} 表添加 task_output 字段")
            else:
                logger.info(f"[MIGRATION]   {table_name} 表 task_output 字段已存在，跳过")
        except Exception as e:
            logger.error(f"[MIGRATION]   迁移 {table_name} 表 task_output 字段失败: {e}")
    logger.info("[MIGRATION]   task_output 字段迁移完成")