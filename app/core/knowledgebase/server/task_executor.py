"""
文档切片任务调度器和执行器
参考RAGFLOW的task_executor.py实现

功能:
1. 从Redis队列获取待执行任务
2. 从RustFS读取文档二进制数据
3. 执行文档切片（根据文档类型选择切片策略）
4. 对切片结果进行Embedding向量化
5. 将切片和向量存储到Elasticsearch
6. 更新数据库中的任务状态和进度
7. 心跳检测和状态报告
8. 任务取消支持
"""

import json
import logging
import os
import threading
import time
import uuid
import base64
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List

from app.database.redis_utils import redis_utils
from app.database.es_utils import es_utils
from app.database.models import KnowledgebaseDocument, Knowledgebase, LLMModel
from app.database.storage.rustfs_utils import rustfs_utils
from app.core.llm_model.factory import LLMFactory
from app.constants.knowledgebase_document_constants import RunningStatus

logger = logging.getLogger(__name__)

BATCH_SIZE = 64

MAPPING_JSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )))),
    "configs", "mapping.json"
)


from app.constants.knowledgebase_document_constants import RunningStatus


class TaskCanceledException(Exception):
    """任务取消异常"""
    pass


class DocumentTask:
    """文档切片任务类"""

    def __init__(
        self,
        task_id: str,
        doc: Optional[KnowledgebaseDocument] = None,
        binary: Optional[bytes] = None,
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
        embedding_model_id: Optional[str] = None,
        text_model_id: Optional[str] = None,
        metadatas: Optional[Dict[str, Any]] = None,
    ):
        self.task_id = task_id
        self.doc = doc
        self.binary = binary
        self.lang = lang
        self.parser_config = parser_config or {}
        self.embedding_model_id = embedding_model_id
        self.text_model_id = text_model_id
        self.metadatas = metadatas or {}
        self.status = RunningStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.error: Optional[str] = None
        self.result: Optional[List[Dict[str, Any]]] = None
        self.progress: float = 0.0
        self.progress_message: str = ""

    @property
    def doc_id(self) -> str:
        return self.doc.id if self.doc else ""

    @property
    def kb_id(self) -> str:
        return self.doc.kb_id if self.doc else ""

    @property
    def filename(self) -> str:
        return self._filename if hasattr(self, '_filename') and self._filename else (self.doc.file_name if self.doc else "")

    @filename.setter
    def filename(self, value: str):
        self._filename = value

    @property
    def parse_type(self) -> str:
        return self.doc.chunk_method if self.doc else "naive"


class TaskExecutor:
    """文档切片任务执行器"""

    QUEUE_NAME = "document_chunk_queue"
    GROUP_NAME = "chunk_workers"
    CONSUMER_NAME = f"chunk_worker_{uuid.uuid4().hex[:8]}"
    TASK_KEY_PREFIX = "chunk_task:"
    CANCEL_KEY_PREFIX = "chunk_cancel:"
    HEARTBEAT_KEY = "chunk_executor_heartbeat"
    MAX_CONCURRENT_TASKS = int(os.environ.get('MAX_CONCURRENT_TASKS', '5'))

    def __init__(self):
        self._running = False
        self._shutdown_event = threading.Event()
        self._tasks: Dict[str, DocumentTask] = {}
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._worker_thread: Optional[threading.Thread] = None
        self._task_limiter = threading.Semaphore(self.MAX_CONCURRENT_TASKS)
        self._active_tasks: set = set()
        self._active_tasks_lock = threading.Lock()
        self._mapping_config: Optional[Dict[str, Any]] = None
        # 创建线程池，大小为最大并发任务数
        self._thread_pool = ThreadPoolExecutor(max_workers=self.MAX_CONCURRENT_TASKS, thread_name_prefix="task_worker")

    def start(self):
        """启动任务调度器"""
        if self._running:
            logger.warning("任务调度器已在运行")
            return

        if not redis_utils.is_available:
            logger.error("Redis不可用，无法启动任务调度器")
            return

        logger.info("=" * 60)
        logger.info("       文档切片任务调度器启动")
        logger.info("=" * 60)
        logger.info(f"  队列名称: {self.QUEUE_NAME}")
        logger.info(f"  消费者组: {self.GROUP_NAME}")
        logger.info(f"  消费者ID: {self.CONSUMER_NAME}")
        logger.info(f"  最大并发任务: {self.MAX_CONCURRENT_TASKS}")
        logger.info("=" * 60)

        self._running = True
        self._shutdown_event.clear()
        self._load_mapping_config()

        self._clear_queue_on_startup()

        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True
        )
        self._worker_thread.start()

        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True
        )
        self._heartbeat_thread.start()

        self._recover_pending_tasks()

        logger.info("任务调度器已启动")

    def _clear_queue_on_startup(self):
        """启动时清空Redis队列，包括pending消息和消费者组信息"""
        logger.info("启动时清空Redis队列...")
        if not redis_utils.is_available:
            return

        try:
            client = redis_utils.client
            queue_name = self.QUEUE_NAME
            group_name = self.GROUP_NAME

            try:
                client.delete(queue_name)
                logger.info(f"已删除队列: {queue_name}")
            except Exception as e:
                logger.warning(f"删除队列失败: {e}")

            try:
                client.xgroup_create(queue_name, group_name, id="0", mkstream=True)
                logger.info(f"已创建消费者组: {group_name}")
            except Exception as e:
                if "BUSYGROUP" in str(e):
                    logger.info(f"消费者组已存在: {group_name}")
                else:
                    logger.warning(f"创建消费者组失败: {e}")

        except Exception as e:
            logger.error(f"清空队列时发生异常: {e}")

    def _recover_pending_tasks(self):
        """服务重启时恢复未完成的任务"""
        logger.info("开始恢复未完成的任务...")
        try:
            pending_docs = KnowledgebaseDocument.select().where(
                (KnowledgebaseDocument.running_status == RunningStatus.RUNNING) |
                (KnowledgebaseDocument.running_status == RunningStatus.WAITING)
            )
            
            pending_count = pending_docs.count()
            if pending_count == 0:
                logger.info("没有需要恢复的任务")
                return

            logger.info(f"发现 {pending_count} 个未完成的任务，正在重新提交...")
            
            recovered_count = 0
            failed_count = 0
            
            # 批量获取知识库信息，减少数据库查询
            kb_ids = set()
            kb_cache = {}
            
            for doc in pending_docs:
                kb_ids.add(doc.kb_id)
            
            # 一次性查询所有知识库的模型信息
            for kb in Knowledgebase.select().where(Knowledgebase.id << kb_ids):
                kb_cache[kb.id] = {
                    'embedding_model_id': kb.embedding_model_id,
                    'text_model_id': kb.text_model_id
                }
            
            for doc in pending_docs:
                try:
                    logger.info(f"恢复任务: doc_id={doc.id}, filename={doc.file_name}")
                    
                    old_token_num = doc.token_num or 0
                    old_chunk_num = doc.chunk_num or 0
                    if old_token_num > 0 or old_chunk_num > 0:
                        self._update_kb_stats(doc.kb_id, -old_token_num, -old_chunk_num)

                    doc.running_status = RunningStatus.WAITING
                    doc.task_progress = 0
                    doc.task_progress_message = "任务恢复中..."
                    doc.task_begin_at = None
                    doc.task_end_at = None
                    doc.task_duration = 0
                    doc.token_num = 0
                    doc.chunk_num = 0
                    doc.save()
                    
                    self._publish_doc_event(doc.kb_id, {
                        "doc_id": doc.id,
                        "running_status": doc.running_status,
                        "task_progress": 0,
                        "task_progress_message": "任务恢复中...",
                        "chunk_num": 0,
                        "token_num": 0,
                    })

                    metadatas = {}
                    if doc.metadatas:
                        try:
                            metadatas = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                        except (json.JSONDecodeError, TypeError):
                            pass

                    # 从缓存获取知识库模型信息
                    kb_info = kb_cache.get(doc.kb_id, {})
                    
                    task = self.submit_task(
                        doc=doc,
                        lang="Chinese",
                        parser_config=self._get_doc_parser_config(doc),
                        embedding_model_id=kb_info.get('embedding_model_id'),
                        text_model_id=kb_info.get('text_model_id'),
                        metadatas=metadatas,
                    )
                    
                    if task:
                        recovered_count += 1
                        logger.info(f"任务恢复成功: {doc.id}")
                    else:
                        failed_count += 1
                        logger.error(f"任务恢复失败: {doc.id}")
                        
                except Exception as e:
                    failed_count += 1
                    logger.error(f"恢复任务 {doc.id} 时发生异常: {e}")
            
            logger.info(f"任务恢复完成: 成功 {recovered_count} 个, 失败 {failed_count} 个")
            
        except Exception as e:
            logger.error(f"任务恢复过程发生异常: {e}")

    def _get_doc_parser_config(self, doc):
        """获取文档的解析配置"""
        if doc.chunk_config:
            try:
                return json.loads(doc.chunk_config) if isinstance(doc.chunk_config, str) else doc.chunk_config
            except (json.JSONDecodeError, TypeError):
                pass
        return {}

    def _get_kb_embedding_model_id(self, kb_id):
        """获取知识库的嵌入模型ID"""
        try:
            kb = Knowledgebase.get(Knowledgebase.id == kb_id)
            return kb.embedding_model_id
        except Exception:
            return None

    def _get_kb_text_model_id(self, kb_id):
        """获取知识库的文本模型ID"""
        try:
            kb = Knowledgebase.get(Knowledgebase.id == kb_id)
            return kb.text_model_id
        except Exception:
            return None

    def stop(self):
        """停止任务调度器（优雅关闭）"""
        if not self._running:
            return

        logger.info("正在关闭任务调度器...")
        self._running = False
        self._shutdown_event.set()

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=10)

        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=5)

        if self._thread_pool:
            logger.info("正在关闭线程池...")
            self._thread_pool.shutdown(wait=False, cancel_futures=True)
            logger.info("线程池已关闭")

        logger.info("任务调度器已停止")

    def _load_mapping_config(self):
        """加载ES索引映射配置"""
        try:
            if os.path.exists(MAPPING_JSON_PATH):
                with open(MAPPING_JSON_PATH, 'r', encoding='utf-8') as f:
                    self._mapping_config = json.load(f)
                logger.info(f"成功加载ES映射配置: {MAPPING_JSON_PATH}")
            else:
                logger.warning(f"ES映射配置文件不存在: {MAPPING_JSON_PATH}")
                self._mapping_config = None
        except Exception as e:
            logger.error(f"加载ES映射配置失败: {e}")
            self._mapping_config = None

    def _init_kb_index(self, kb_id: str, vector_size: int = 1024, custom_field_mappings: Dict[str, Any] = None):
        """初始化知识库ES索引，索引名为知识库ID
        
        Args:
            kb_id: 知识库ID
            vector_size: 向量大小
            custom_field_mappings: 自定义字段映射，用于添加keyword类型的索引字段
        """
        if not es_utils.is_available:
            logger.warning("ES不可用，跳过索引初始化")
            return False

        try:
            index_name = kb_id
            if es_utils.client.indices.exists(index=index_name):
                logger.info(f"ES索引已存在: {index_name}")
                # 如果索引已存在，需要更新映射以添加自定义字段
                if custom_field_mappings:
                    try:
                        es_utils.client.indices.put_mapping(
                            index=index_name,
                            body={"properties": custom_field_mappings}
                        )
                        logger.info(f"成功更新ES索引映射，添加自定义字段: {list(custom_field_mappings.keys())}")
                    except Exception as e:
                        logger.warning(f"更新ES索引映射失败: {e}")
                return True

            mappings = None
            if self._mapping_config:
                mappings = self._mapping_config.get("mappings", {})
                settings = self._mapping_config.get("settings", {})
                
                # 添加自定义字段映射
                if custom_field_mappings:
                    if "properties" not in mappings:
                        mappings["properties"] = {}
                    mappings["properties"].update(custom_field_mappings)
                
                body = {"settings": settings, "mappings": mappings}
                es_utils.client.indices.create(index=index_name, body=body)
                logger.info(f"成功使用mapping.json创建ES索引: {index_name}")
                if custom_field_mappings:
                    logger.info(f"已添加自定义字段映射: {list(custom_field_mappings.keys())}")
            else:
                es_utils.create_index(index_name)
                # 如果使用默认创建，也需要添加自定义字段映射
                if custom_field_mappings:
                    try:
                        es_utils.client.indices.put_mapping(
                            index=index_name,
                            body={"properties": custom_field_mappings}
                        )
                        logger.info(f"成功更新ES索引映射，添加自定义字段: {list(custom_field_mappings.keys())}")
                    except Exception as e:
                        logger.warning(f"更新ES索引映射失败: {e}")

            return True
        except Exception as e:
            logger.error(f"初始化ES索引失败 {kb_id}: {e}")
            return False

    def submit_task(
        self,
        doc: Optional[KnowledgebaseDocument] = None,
        task_id: Optional[str] = None,
        kb_id: Optional[str] = None,
        filename: Optional[str] = None,
        parse_type: str = "naive",
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
        embedding_model_id: Optional[str] = None,
        text_model_id: Optional[str] = None,
        metadatas: Optional[Dict[str, Any]] = None,
    ) -> DocumentTask:
        """
        提交任务到队列

        支持两种调用方式:
        1. 传入文档对象: submit_task(doc=doc, lang="Chinese", ...)
        2. 传入参数: submit_task(task_id="xxx", filename="xxx", parse_type="naive", ...)

        Args:
            doc: 文档对象（新方式）
            task_id: 任务ID（旧方式）
            kb_id: 知识库ID（旧方式）
            filename: 文件名（旧方式）
            parse_type: 解析类型
            lang: 语言
            parser_config: 解析配置
            embedding_model_id: Embedding模型ID
            text_model_id: Text模型ID
            metadatas: 文档元数据

        Returns:
            DocumentTask: 任务对象
        """
        if doc is not None:
            task_id = doc.id
            kb_id = doc.kb_id
            filename = doc.location or doc.file_name
            parse_type = doc.chunk_method
        
        if task_id is None:
            task_id = str(uuid.uuid4())

        self._tasks.pop(task_id, None)

        task = DocumentTask(
            task_id=task_id,
            doc=doc,
            lang=lang,
            parser_config=parser_config,
            embedding_model_id=embedding_model_id,
            text_model_id=text_model_id,
            metadatas=metadatas,
        )

        self._tasks[task_id] = task
        task.status = RunningStatus.WAITING
        logger.info(f"新任务已创建: task_id={task_id}, status={task.status}")

        message = {
            "task_id": task_id,
            "doc_id": task_id,
            "kb_id": kb_id,
            "filename": filename,
            "parse_type": parse_type,
            "lang": lang,
            "parser_config": parser_config,
            "embedding_model_id": embedding_model_id,
            "text_model_id": text_model_id,
            "metadatas": metadatas,
            "timestamp": datetime.now().isoformat(),
        }

        if redis_utils.queue_product(self.QUEUE_NAME, message):
            logger.info(f"任务已提交到队列: {task_id}, 文档: {filename}")
        else:
            logger.error(f"任务提交到队列失败: {task_id}")
            task.status = RunningStatus.FAIL
            task.error = "Failed to enqueue task"
            self._update_document_status(task)

        return task

    def _clear_pending_messages(self, task_id: str):
        """清理Redis Stream中指定任务的所有消息（包括pending和未认领的）"""
        if not redis_utils.is_available:
            return

        try:
            client = redis_utils.client
            queue_name = self.QUEUE_NAME
            group_name = self.GROUP_NAME

            # 1. 清理 pending 消息
            try:
                pending = client.xpending_range(queue_name, group_name, "-", "+", 100)
            except Exception:
                pending = []

            for msg in pending:
                msg_id = msg.get("message_id")
                if not msg_id:
                    continue

                try:
                    msg_data = client.xrange(queue_name, msg_id, msg_id)
                    if msg_data:
                        _, payload = msg_data[0]
                        msg_str = payload.get("message", "{}")
                        try:
                            msg_json = json.loads(msg_str)
                            if msg_json.get("task_id") == task_id:
                                client.xack(queue_name, group_name, msg_id)
                                client.xdel(queue_name, msg_id)
                                logger.info(f"已清理pending消息: task_id={task_id}, msg_id={msg_id}")
                        except (json.JSONDecodeError, TypeError):
                            pass
                except Exception as e:
                    logger.warning(f"清理pending消息失败: {e}")

            # 2. 清理队列中所有未认领的旧消息（包括已ack但还没delete的）
            try:
                all_messages = client.xrange(queue_name, "-", "+", count=100)
                for msg_id, payload in all_messages:
                    msg_str = payload.get("message", "{}")
                    try:
                        msg_json = json.loads(msg_str)
                        if msg_json.get("task_id") == task_id:
                            client.xdel(queue_name, msg_id)
                            logger.info(f"已删除旧消息: task_id={task_id}, msg_id={msg_id}")
                    except (json.JSONDecodeError, TypeError):
                        pass
            except Exception as e:
                logger.warning(f"清理旧消息失败: {e}")

        except Exception as e:
            logger.warning(f"清理消息异常: {e}")

    def _get_task(self, task_id: str) -> Optional[DocumentTask]:
        """从数据库获取任务信息"""
        # 不使用缓存，每次都从数据库获取最新状态
        # if task_id in self._tasks:
        #     return self._tasks[task_id]

        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == task_id)
            if doc.deleted:
                return None

            kb = Knowledgebase.get(Knowledgebase.id == doc.kb_id)

            parser_config = {}
            if doc.chunk_config:
                try:
                    parser_config = json.loads(doc.chunk_config) if isinstance(doc.chunk_config, str) else doc.chunk_config
                except (json.JSONDecodeError, TypeError):
                    pass

            metadatas = {}
            if doc.metadatas:
                try:
                    metadatas = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                except (json.JSONDecodeError, TypeError):
                    pass

            task = DocumentTask(
                task_id=task_id,
                doc=doc,
                lang="Chinese",
                parser_config=parser_config,
                embedding_model_id=kb.embedding_model_id if kb else None,
                text_model_id=kb.text_model_id if kb else None,
                metadatas=metadatas,
            )

            if doc.running_status in (RunningStatus.WAITING, RunningStatus.RUNNING):
                task.status = doc.running_status
                task.progress = doc.task_progress or 0
                task.progress_message = doc.task_progress_message or ""
                task.started_at = doc.task_begin_at
                task.completed_at = doc.task_end_at
                logger.debug(f"从数据库恢复任务状态: task_id={task_id}, status={task.status}, progress={task.progress}")
            else:
                logger.debug(f"任务不在执行状态，使用默认状态: task_id={task_id}, db_status={doc.running_status}")

            self._tasks[task_id] = task
            return task

        except KnowledgebaseDocument.DoesNotExist:
            logger.warning(f"文档不存在: {task_id}")
            return None
        except Exception as e:
            logger.error(f"从数据库获取任务失败: {e}")
            return None

    def _has_canceled(self, task_id: str) -> bool:
        """检查任务是否被取消"""
        return redis_utils.exists(f"{self.CANCEL_KEY_PREFIX}{task_id}")

    def _add_active_task(self, task_id: str):
        """添加活跃任务"""
        with self._active_tasks_lock:
            self._active_tasks.add(task_id)

    def _remove_active_task(self, task_id: str):
        """移除活跃任务"""
        with self._active_tasks_lock:
            self._active_tasks.discard(task_id)

    def _get_active_task_count(self) -> int:
        """获取活跃任务数量"""
        with self._active_tasks_lock:
            return len(self._active_tasks)

    def _update_document_status(self, task: DocumentTask):
        """更新数据库中的文档状态"""
        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == task.doc_id)
            if doc.deleted:
                return

            doc.running_status = task.status
            doc.task_progress = task.progress
            doc.task_progress_message = task.progress_message

            if task.started_at:
                doc.task_begin_at = task.started_at
            if task.completed_at:
                doc.task_end_at = task.completed_at
                if task.started_at:
                    delta = task.completed_at - task.started_at
                    doc.task_duration = int(delta.total_seconds() * 1000)

            if task.status == RunningStatus.DONE and task.result:
                doc.chunk_num = len(task.result)
                # token_count = sum(
                #     chunk.get("tk_nums", 0) for chunk in task.result
                # )
                doc.token_num = task.token_num
                self._update_kb_stats(task.kb_id, task.token_num, len(task.result))

            doc.save()
            
            self._publish_doc_event(task.kb_id, {
                "doc_id": task.doc_id,
                "running_status": doc.running_status,
                "task_progress": task.progress,
                "task_progress_message": task.progress_message,
                "chunk_num": doc.chunk_num,
                "token_num": doc.token_num,
            })
        except KnowledgebaseDocument.DoesNotExist:
            logger.warning(f"文档不存在: {task.doc_id}")
        except Exception as e:
            logger.error(f"更新文档状态失败: {e}")

    def _update_kb_stats(self, kb_id: str, token_count: int, chunk_count: int):
        """更新知识库统计信息"""
        try:
            kb = Knowledgebase.get(Knowledgebase.id == kb_id)
            kb.token_num = (kb.token_num or 0) + token_count
            kb.chunk_num = (kb.chunk_num or 0) + chunk_count
            kb.save()
        except Exception as e:
            logger.error(f"更新知识库统计失败: {e}")

    def _publish_doc_event(self, kb_id: str, event_data: Dict[str, Any]):
        """推送文档事件到Redis频道"""
        try:
            channel = f"kb:{kb_id}:doc_events"
            redis_utils.publish(channel, event_data)
        except Exception as e:
            logger.warning(f"推送文档事件失败: {e}")

    def _set_progress(self, task: DocumentTask, prog: float = None, msg: str = "Processing...", append: bool = True):
        """设置任务进度并更新数据库
        
        Args:
            task: 任务对象
            prog: 进度值 (0.0 ~ 1.0)
            msg: 进度消息
            append: 是否追加消息，默认为True；设为False则更新最后一条同类型消息
        """
        try:
            # 先检查是否已取消，避免更新已取消任务的进度
            if self._has_canceled(task.task_id):
                raise TaskCanceledException(msg or "任务已取消")
                
            if prog is not None and prog < 0:
                msg = "[ERROR]" + msg

            if prog is not None:
                new_progress = min(max(prog, 0), 1.0)
                if new_progress < task.progress:
                    logger.debug(f"进度未更新: 当前进度 {task.progress:.2%}, 新进度 {new_progress:.2%}")
                else:
                    task.progress = new_progress
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            new_msg = f"[{timestamp}] {msg}"
            
            if append:
                if task.progress_message:
                    task.progress_message = f"{task.progress_message}\n{new_msg}"
                else:
                    task.progress_message = new_msg
            else:
                if task.progress_message:
                    lines = task.progress_message.split('\n')
                    new_lines = []
                    replaced = False
                    for line in lines:
                        if '合并文本块进度:' in line and '合并文本块进度:' in new_msg:
                            new_lines.append(new_msg)
                            replaced = True
                        else:
                            new_lines.append(line)
                    if not replaced:
                        new_lines.append(new_msg)
                    task.progress_message = '\n'.join(new_lines)
                else:
                    task.progress_message = new_msg

            # 再次检查是否取消，然后才更新数据库
            if self._has_canceled(task.task_id):
                raise TaskCanceledException(msg)
                
            self._update_document_status(task)
                
        except TaskCanceledException:
            raise
        except Exception as e:
            logger.exception(f"set_progress异常: {e}")

    def _get_embedding_model(self, embedding_model_id: str) -> Optional[Any]:
        """获取Embedding模型实例"""
        try:
            llm_model = LLMModel.get(LLMModel.id == embedding_model_id)
            if not llm_model or llm_model.deleted:
                logger.error(f"Embedding模型不存在或已删除: {embedding_model_id}")
                return None

            model_config = {
                "api_key": llm_model.api_key,
                "endpoint": llm_model.endpoint,
                "name": llm_model.name,
                "provider": llm_model.provider,
            }

            if llm_model.config:
                try:
                    extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                    model_config.update(extra_config)
                except (json.JSONDecodeError, TypeError):
                    pass

            return LLMFactory.create_model("embedding", model_config)
        except LLMModel.DoesNotExist:
            logger.error(f"Embedding模型不存在: {embedding_model_id}")
            return None
        except Exception as e:
            logger.error(f"获取Embedding模型失败: {e}")
            return None

    def _get_text_model(self, text_model_id: str) -> Optional[Any]:
        """获取Text模型实例（用于关键词提取等）"""
        try:
            llm_model = LLMModel.get(LLMModel.id == text_model_id)
            if not llm_model or llm_model.deleted:
                logger.error(f"Text模型不存在或已删除: {text_model_id}")
                return None

            model_config = {
                "api_key": llm_model.api_key,
                "endpoint": llm_model.endpoint,
                "name": llm_model.name,
                "provider": llm_model.provider,
            }

            if llm_model.config:
                try:
                    extra_config = json.loads(llm_model.config) if isinstance(llm_model.config, str) else llm_model.config
                    model_config.update(extra_config)
                except (json.JSONDecodeError, TypeError):
                    pass

            return LLMFactory.create_model("text", model_config)
        except LLMModel.DoesNotExist:
            logger.error(f"Text模型不存在: {text_model_id}")
            return None
        except Exception as e:
            logger.error(f"获取Text模型失败: {e}")
            return None

    def _get_vector_size(self, embedding_model_id: str, embedding_model: Any = None) -> int:
        """根据Embedding模型获取向量维度"""
        model_name = ""
        try:
            llm_model = LLMModel.get(LLMModel.id == embedding_model_id)
            model_name = llm_model.name.lower() if llm_model else ""
        except Exception:
            pass

        if "1536" in model_name:
            return 1536
        elif "768" in model_name:
            return 768
        elif "512" in model_name:
            return 512
        
        if embedding_model:
            try:
                vect, _ = embedding_model.encode(["test"])
                return len(vect[0])
            except Exception as e:
                logger.warning(f"通过encode方法获取向量维度失败: {e}")
        
        return 1024

    def _build_chunks(self, task: DocumentTask) -> List[Dict[str, Any]]:
        """执行文档切片（含关键词提取）

        进度范围: 0.05 ~ 0.60
          - 切片: 0.05 ~ 0.50
          - 关键词提取: 0.50 ~ 0.60
        """
        from app.core.knowledgebase.rag.app import CHUNK_STRATEGIES

        self._set_progress(task, 0.05, "开始切片...")

        chunk_func = CHUNK_STRATEGIES.get(task.parse_type)
        if not chunk_func:
            raise ValueError(f"不支持的切片策略: {task.parse_type}")

        result = chunk_func(
            filename=task.filename,
            binary=task.binary,
            lang=task.lang,
            parser_config=task.parser_config,
            callback=lambda prog=None, msg="", append=True: self._set_progress(
                task,
                prog=0.05 + 0.45 * prog if prog else None,
                msg=msg,
                append=append
            )
        )

        self._set_progress(task, 0.50, f"切片完成，共 {len(result)} 个切片")

        auto_keywords = task.parser_config.get("auto_keywords", 1)
        text_model_id = getattr(task, "text_model_id", None)
        if auto_keywords > 0 and text_model_id:
            self._extract_keywords(task, result, auto_keywords)
        else:
            self._set_progress(task, 0.60, "跳过关键词提取")

        return result

    def _extract_keywords(self, task: DocumentTask, chunks: List[Dict[str, Any]], topn: int):
        """提取切片关键词

        进度范围: 0.50 ~ 0.60
        """
        import asyncio
        from app.core.knowledgebase.rag.prompts.generator import keyword_extraction
        from app.core.knowledgebase.rag.utils.common_utils import get_llm_cache, set_llm_cache
        from app.core.knowledgebase.rag.nlp import rag_tokenizer

        self._set_progress(task, 0.50, "开始提取关键词...")

        text_model_id = getattr(task, "text_model_id", None)
        if not text_model_id:
            logger.warning(f"没有配置文本模型，跳过关键词提取")
            return

        text_model = self._get_text_model(text_model_id)
        if not text_model:
            logger.warning(f"文本模型获取失败，跳过关键词提取: {text_model_id}")
            return

        model_name = text_model.model_name
        total = len(chunks)
        processed = 0

        async def extract_chunk_keywords_async(i: int, chunk: Dict[str, Any]) -> tuple:
            """异步提取单个切片的关键词"""
            content = chunk.get("content_with_weight", chunk.get("content", ""))
            if not content or not content.strip():
                return i, chunk, None

            gen_conf = {"topn": topn}
            cached = get_llm_cache(model_name, content, "keywords", gen_conf)
            if cached:
                return i, chunk, cached

            try:
                kwd = await keyword_extraction(text_model, content, topn)
                if kwd and kwd.find("**ERROR**") < 0:
                    set_llm_cache(model_name, content, kwd, "keywords", gen_conf, exp=60)
                    return i, chunk, kwd
                return i, chunk, None
            except Exception as e:
                logger.warning(f"切片 {i} 关键词提取异常: {e}")
                return i, chunk, None

        async def process_all_chunks():
            """异步处理所有切片"""
            nonlocal processed
            tasks = [extract_chunk_keywords_async(i, chunk) for i, chunk in enumerate(chunks)]
            for future in asyncio.as_completed(tasks):
                i, chunk, keywords = await future
                if keywords:
                    chunk["important_kwd"] = [k.strip() for k in keywords.split(",") if k.strip()]
                    chunk["important_tks"] = rag_tokenizer.tokenize(" ".join(chunk["important_kwd"]))
                processed += 1

                if processed % 10 == 0 or processed == total:
                    progress = 0.50 + 0.10 * (processed / total)
                    self._set_progress(task, progress, f"关键词提取进度: {processed}/{total}")

        asyncio.run(process_all_chunks())

        self._set_progress(task, 0.60, f"关键词提取完成，共处理 {total} 个切片")

    def _embedding_chunks(
        self,
        chunks: List[Dict[str, Any]],
        embedding_model: Any,
        task: DocumentTask,
    ) -> List[Dict[str, Any]]:
        """对切片进行Embedding向量化（参考RAGFLOW实现）

        进度范围: 0.60 ~ 0.85
        """
        import re
        import numpy as np
        
        self._set_progress(task, 0.60, "开始向量化...")
        
        parser_config = task.parser_config or {}
        filename_embd_weight = parser_config.get("filename_embd_weight", 0.1) or 0.1
        
        titles = []
        contents = []
        for chunk in chunks:
            title = chunk.get("docnm_kwd", task.filename or "Title")
            titles.append(title)
            
            content = "\n".join(chunk.get("question_kwd", []))
            if not content:
                content = chunk.get("content_with_weight", chunk.get("content", ""))
            content = re.sub(r"</?(table|td|caption|tr|th)( [^<>]{0,12})?>", " ", content)
            if not content:
                content = "None"
            contents.append(content)
        
        total_tokens = 0
        title_embeddings = None
        content_embeddings = None
        vector_size = 0
        
        if len(titles) == len(contents) and len(titles) > 0:
            try:
                title_embeddings, title_token_counts = embedding_model.encode(titles[:1])
                if len(titles) > 1:
                    title_embeddings = np.tile(title_embeddings[0], (len(titles), 1))
                total_tokens += sum(title_token_counts)
            except Exception as e:
                logger.warning(f"标题向量化失败: {e}")
                title_embeddings = None
        
        from app.core.knowledgebase.rag.settings import EMBEDDING_BATCH_SIZE
        content_embeddings = np.array([])
        all_token_counts = []
        for i in range(0, len(contents), EMBEDDING_BATCH_SIZE):
            batch = contents[i:i+EMBEDDING_BATCH_SIZE]
            try:
                batch_embeddings, batch_token_counts = embedding_model.encode(batch)
                if len(content_embeddings) == 0:
                    content_embeddings = batch_embeddings
                else:
                    content_embeddings = np.concatenate((content_embeddings, batch_embeddings), axis=0)
                all_token_counts.extend(batch_token_counts)
                total_tokens += sum(batch_token_counts)
            except Exception as e:
                logger.warning(f"批次向量化失败: {e}")
                raise
            
            progress = 0.60 + 0.25 * ((i+EMBEDDING_BATCH_SIZE) / len(contents))
            self._set_progress(task, progress, f"向量化进度: {min(i+EMBEDDING_BATCH_SIZE, len(contents))}/{len(contents)}")
        
        # 确保至少有一个向量源可用
        if len(content_embeddings) > 0:
            vector_size = len(content_embeddings[0])
        elif title_embeddings is not None and len(title_embeddings) > 0:
            vector_size = len(title_embeddings[0])
        else:
            vector_size = self._get_vector_size(task.embedding_model_id, embedding_model) if task.embedding_model_id else 1024
        
        q_vec_field = f"q_{vector_size}_vec"
        
        title_w = float(filename_embd_weight)
        if (title_embeddings is not None and len(content_embeddings) > 0 and 
            title_embeddings.ndim == 2 and content_embeddings.ndim == 2 and 
            title_embeddings.shape == content_embeddings.shape):
            final_embeddings = title_w * title_embeddings + (1 - title_w) * content_embeddings
        elif len(content_embeddings) > 0:
            final_embeddings = content_embeddings
        elif title_embeddings is not None:
            final_embeddings = np.tile(title_embeddings[0] if len(title_embeddings) > 0 else np.zeros(vector_size), (len(chunks), 1))
        else:
            final_embeddings = np.zeros((len(chunks), vector_size))
        
        assert len(final_embeddings) == len(chunks), f"向量数量({len(final_embeddings)})与切片数量({len(chunks)})不一致"
        assert len(all_token_counts) == len(chunks), f"token数量({len(all_token_counts)})与切片数量({len(chunks)})不一致"
        
        for i, chunk in enumerate(chunks):
            v = final_embeddings[i].tolist()
            chunk["embedding"] = v
            chunk[q_vec_field] = v
            chunk["tkn_cnt_int"] = all_token_counts[i]
            chunk["token_num_int"] = chunk["tkn_cnt_int"]
            chunk["char_count_int"] = len(contents[i]) if i < len(contents) else 0
        
        self._set_progress(task, 0.85, f"向量化完成，共处理 {len(chunks)} 个切片，token总数: {total_tokens}")
        return chunks

    def _insert_es(self, chunks: List[Dict[str, Any]], task: DocumentTask):
        """将切片插入Elasticsearch（使用chunk原始数据）

        进度范围: 0.85 ~ 1.00
        """
        self._set_progress(task, 0.85, "开始写入ES...")

        if not es_utils.is_available:
            raise RuntimeError("Elasticsearch不可用，无法存储切片数据")

        vector_size = None
        for chunk in chunks:
            for key in chunk:
                if key.startswith("q_") and key.endswith("_vec"):
                    vector_size = int(key[2:-4])
                    break
            if vector_size:
                break
        
        if not vector_size:
            vector_size = self._get_vector_size(task.embedding_model_id) if task.embedding_model_id else 1024
        
        # 如果是自定义模版知识，需要添加自定义字段的索引
        custom_field_mappings = {}
        if task.doc and task.doc.source_type == 'custom_template':
            document_config = task.doc.document_config
            if isinstance(document_config, str):
                import json
                document_config = json.loads(document_config)
            
            custom_fields = document_config.get('custom_fields', [])
            for field in custom_fields:
                if field.get('is_param_search') and field.get('field_code'):
                    # 将字段编码作为索引字段（keyword类型）
                    custom_field_mappings[field['field_code']] = {"type": "keyword"}
        
        self._init_kb_index(task.kb_id, vector_size, custom_field_mappings)

        docs_to_insert = []

        for i, chunk in enumerate(chunks):
            doc = dict(chunk)

            # 调试日志：检查chunk中的向量字段
            vec_fields = [k for k in chunk.keys() if k.startswith("q_") and k.endswith("_vec")]
            if i == 0:
                logger.info(f"切片0中的向量字段: {vec_fields}")
                if vec_fields:
                    logger.info(f"向量字段 {vec_fields[0]} 的值长度: {len(chunk.get(vec_fields[0], []))}")

            doc["doc_id"] = task.doc_id
            doc["kb_id"] = task.kb_id
            
            # 添加doc_title字段，存储文档标题
            if task.doc and task.doc.title:
                doc["doc_title"] = task.doc.title
            
            # 如果file_name为空则docnm_kwd和doc_name字段使用文档标题
            if task.filename:
                doc["doc_name"] = task.filename
                doc["docnm_kwd"] = task.filename
            elif task.doc and task.doc.title:
                doc["doc_name"] = task.doc.title
                doc["docnm_kwd"] = task.doc.title
            
            doc["chunk_id"] = f"{task.doc_id}_{i}"
            doc["create_time"] = str(datetime.now()).replace("T", " ")[:19]
            doc["create_timestamp_flt"] = datetime.now().timestamp()
            doc["available_int"] = 1

            if task.metadatas:
                doc["metadatas"] = task.metadatas

            if "image" in doc:
                img = doc["image"]
                try:
                    if img is not None:
                        if hasattr(img, 'save'):
                            buffer = io.BytesIO()
                            img.save(buffer, format='PNG')
                            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                            doc["image_base64"] = img_base64
                except Exception as e:
                    logger.warning(f"图片转base64失败: {e}")
                del doc["image"]

            doc.pop("embedding", None)

            # 调试日志：检查doc中的向量字段
            if i == 0:
                doc_vec_fields = [k for k in doc.keys() if k.startswith("q_") and k.endswith("_vec")]
                logger.info(f"准备写入ES的doc中的向量字段: {doc_vec_fields}")

            docs_to_insert.append(doc)

        if docs_to_insert:
            success_count = es_utils.batch_insert_documents(task.kb_id, docs_to_insert)
            logger.info(f"ES写入完成: {success_count}/{len(docs_to_insert)} 个切片")

    def _delete_es_chunks(self, kb_id: str, doc_id: str):
        """删除ES中指定文档的切片"""
        if not es_utils.is_available:
            return

        try:
            # 先判断索引是否存在
            if not es_utils.client.indices.exists(index=kb_id):
                logger.info(f"索引不存在，跳过删除: kb={kb_id}")
                return

            query = {
                "query": {
                    "term": {"doc_id": doc_id}
                }
            }
            deleted = es_utils.delete_by_query(kb_id, query)
            logger.info(f"删除ES切片: kb={kb_id}, doc={doc_id}, 删除数量: {deleted}")
        except Exception as e:
            logger.error(f"删除ES切片失败: {e}")

    def _worker_loop(self):
        """工作线程主循环"""
        logger.info("工作线程已启动")
        loop_count = 0

        while self._running and not self._shutdown_event.is_set():
            try:
                loop_count += 1
                
                # 每10次循环打印一次监控日志
                if loop_count % 10 == 0:
                    logger.info(f"工作线程运行中: loop_count={loop_count}, active_tasks={len(self._active_tasks)}, _running={self._running}, _shutdown_event={self._shutdown_event.is_set()}")
                
                # 先尝试读取新消息
                msg = redis_utils.queue_consumer(
                    self.QUEUE_NAME,
                    self.GROUP_NAME,
                    self.CONSUMER_NAME
                )

                # 没有新消息时，尝试读取pending消息（之前已投递但未确认的消息）
                if not msg:
                    msg = redis_utils.queue_consumer(
                        self.QUEUE_NAME,
                        self.GROUP_NAME,
                        self.CONSUMER_NAME,
                        msg_id="0"
                    )
                    if msg:
                        logger.info(f"读取到pending消息: msg_id={msg.get_msg_id()}")
                        # 检查pending消息对应的任务是否正在执行中
                        pending_task_id = msg.get_message().get("task_id")
                        with self._active_tasks_lock:
                            is_active = pending_task_id in self._active_tasks
                        if is_active:
                            logger.info(f"Pending任务正在执行中，跳过: {pending_task_id}")
                            msg.ack()  # 确认消息，避免重复消费
                            msg = None
                            continue

                if not msg:
                    time.sleep(1)
                    continue

                logger.info(f"工作线程收到消息，准备处理: loop_count={loop_count}, msg_id={msg.get_msg_id()}")
                
                # 先获取限流器，确保不会超过最大并发数（阻塞等待，不超时）
                acquired = self._task_limiter.acquire()
                if not acquired:
                    logger.warning(f"获取限流器失败，跳过任务: loop_count={loop_count}")
                    continue
                
                # 使用线程池提交任务
                self._thread_pool.submit(self._process_task_with_limit, msg)

            except Exception as e:
                logger.exception(f"工作线程异常: {e}, loop_count={loop_count}")
                time.sleep(2)

        logger.info(f"工作线程已退出，总计循环次数: {loop_count}")

    def _process_task_with_limit(self, msg):
        """处理任务并释放限流器"""
        task_id = None
        try:
            message = msg.get_message()
            task_id = message.get("task_id")
            
            try:
                self._process_message(msg)
            finally:
                # 释放限流器，允许下一个任务执行
                self._task_limiter.release()

        except Exception as e:
            logger.exception(f"任务处理异常: {e}")

    def _process_message(self, msg):
        """处理单个消息"""
        task_id = None
        try:
            message = msg.get_message()
            task_id = message.get("task_id")

            logger.info(f"收到任务: {task_id}")

            # 先检查任务是否已被取消
            if self._has_canceled(task_id):
                logger.info(f"任务已被取消，直接跳过: {task_id}")
                msg.ack()
                return

            task = self._get_task(task_id)
            if not task:
                logger.warning(f"任务不存在: {task_id}")
                msg.ack()
                return

            # 检查任务是否正在被其他线程处理
            with self._active_tasks_lock:
                is_active = task_id in self._active_tasks
            if is_active:
                logger.warning(f"任务正在被其他线程处理，跳过: {task_id}")
                msg.ack()
                return

            # 检查任务状态，如果已经是终止状态，直接ack
            if task.status in (RunningStatus.DONE, RunningStatus.FAIL, RunningStatus.CANCEL):
                logger.warning(f"任务已处于终止状态，跳过执行: task_id={task_id}, status={task.status}")
                msg.ack()
                return

            # 再次检查取消标记
            if self._has_canceled(task.task_id):
                logger.info(f"任务已被取消: {task_id}")
                task.status = RunningStatus.CANCEL
                task.completed_at = datetime.now()
                self._update_document_status(task)
                msg.ack()
                return

            self._add_active_task(task_id)

            try:
                task.status = RunningStatus.RUNNING
                task.started_at = datetime.now()
                task.progress = 0.0
                task.progress_message = ""
                self._set_progress(task, 0.0, "开始处理...", append=False)

                try:
                    self._execute_chunk(task)
                except TaskCanceledException:
                    # 任务被取消，直接设置状态，不调用_set_progress避免再次抛出异常
                    task.status = RunningStatus.CANCEL
                    task.progress = 1.0
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    task.progress_message = f"{task.progress_message}\n[{timestamp}] 任务已取消" if task.progress_message else f"[{timestamp}] 任务已取消"
                    task.completed_at = datetime.now()
                except Exception as e:
                    logger.exception(f"任务执行异常 {task_id}: {e}")
                    # 任务失败，直接设置状态，不调用_set_progress避免再次抛出异常
                    task.status = RunningStatus.FAIL
                    task.error = str(e)
                    task.progress = -1
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    error_msg = f"任务失败: {str(e)[:200]}"
                    task.progress_message = f"{task.progress_message}\n[{timestamp}] [ERROR]{error_msg}" if task.progress_message else f"[{timestamp}] [ERROR]{error_msg}"
                    task.completed_at = datetime.now()

                msg.ack()
                self._update_document_status(task)

                logger.info(f"任务处理完成: {task_id}, 状态: {task.status}")

            except TaskCanceledException:
                # 任务在开始处理时被取消（_set_progress抛出异常）
                logger.info(f"任务在开始时被取消: {task_id}")
                task.status = RunningStatus.CANCEL
                task.progress = 1.0
                timestamp = datetime.now().strftime("%H:%M:%S")
                task.progress_message = f"{task.progress_message}\n[{timestamp}] 任务已取消" if task.progress_message else f"[{timestamp}] 任务已取消"
                task.completed_at = datetime.now()
                msg.ack()
                self._update_document_status(task)

            finally:
                self._remove_active_task(task_id)
                redis_utils.delete(f"{self.CANCEL_KEY_PREFIX}{task_id}")
                self._tasks.pop(task_id, None)

        except Exception as e:
            logger.exception(f"处理消息异常: {e}")

    def _execute_chunk(self, task: DocumentTask):
        """执行文档切片完整流水线

        进度分配:
          0.00 ~ 0.05: 文件读取
          0.05 ~ 0.50: 切片 (_build_chunks)
          0.50 ~ 0.60: 关键词提取 (_extract_keywords)
          0.60 ~ 0.85: 向量化 (_embedding_chunks)
          0.85 ~ 1.00: ES写入 (_insert_es)
        """
        from app.utils.token_utils import num_tokens_from_string
        from app.core.knowledgebase.utils.file_utils import (
            generate_markdown_file, 
            generate_custom_template_excel, 
            cleanup_temp_files
        )
        
        logger.info(f"开始执行切片流水线: {task.task_id}, 文档: {task.filename}")
        
        self._set_progress(task, 0.0, "开始读取文件...")
        
        temp_file_path = None
        
        try:
            # 根据source_type进行不同文件读取处理
            if task.doc and task.doc.source_type == 'rich_text':
                # 富文本类型：从document_config中读取富文本内容，生成临时markdown文件
                logger.info(f"处理富文本类型文档: {task.task_id}")
                document_config = task.doc.document_config
                if isinstance(document_config, str):
                    import json
                    document_config = json.loads(document_config)
                
                rich_text_content = document_config.get('content', '')
                if not rich_text_content:
                    raise RuntimeError("富文本内容为空")
                
                self._set_progress(task, 0.02, "正在生成临时markdown文件...")
                temp_file_path, binary, error = generate_markdown_file(rich_text_content)
                if error:
                    raise RuntimeError(error)
                
                logger.info(f"生成markdown临时文件: {temp_file_path}")
                
                task.binary = binary
                # 修改filename为临时markdown文件名
                task.filename = f"{task.doc.title or 'rich_text'}.md"
                
            elif task.doc and task.doc.source_type == 'custom_template':
                # 自定义模版类型：生成临时excel文件
                logger.info(f"处理自定义模版类型文档: {task.task_id}")
                document_config = task.doc.document_config
                if isinstance(document_config, str):
                    import json
                    document_config = json.loads(document_config)
                
                self._set_progress(task, 0.02, "正在生成临时excel文件...")
                temp_file_path, binary, error = generate_custom_template_excel(document_config)
                if error:
                    raise RuntimeError(error)

                logger.info(f"生成excel临时文件: {temp_file_path}")

                task.binary = binary
                # 修改filename为临时excel文件名
                task.filename = f"{task.doc.title or 'custom_template'}.xlsx"
                
            elif not task.binary:
                # 本地文件或数据源：保持现有逻辑
                self._set_progress(task, 0.02, f"从RustFS读取文件: {task.kb_id}/{task.filename}")
                logger.info(f"从RustFS读取文件: {task.kb_id}/{task.filename}")
                binary = rustfs_utils.download_object(task.kb_id, task.filename)
                if not binary:
                    raise RuntimeError(f"从RustFS读取文件失败: {task.kb_id}/{task.filename}")
                task.binary = binary
            
            self._set_progress(task, 0.05, "文件读取完成，开始切片...")
            
            chunks = self._build_chunks(task)
            if not chunks:
                task.result = []
                task.status = RunningStatus.DONE
                task.completed_at = datetime.now()
                task.progress = 1.0
                task.progress_message = "文档切片为空，无需处理"
                return
            
            embedding_model = None
            if task.embedding_model_id:
                embedding_model = self._get_embedding_model(task.embedding_model_id)
            
            if embedding_model:
                chunks = self._embedding_chunks(chunks, embedding_model, task)
            else:
                logger.warning(f"未配置Embedding模型，使用默认零向量: {task.kb_id}")
                self._set_progress(task, 0.60, "未配置Embedding模型，使用默认零向量")
                vector_size = self._get_vector_size(task.embedding_model_id) if task.embedding_model_id else 1024
                q_vec_field = f"q_{vector_size}_vec"
                zero_vector = [0.0] * vector_size
                for chunk in chunks:
                    chunk["embedding"] = zero_vector
                    chunk[q_vec_field] = zero_vector
                    chunk["tkn_cnt_int"] = num_tokens_from_string(chunk.get("content_with_weight", ""))
                    chunk["token_num_int"] = chunk["tkn_cnt_int"]
                self._set_progress(task, 0.85, "零向量准备完成")
            
            self._insert_es(chunks, task)
            
            total_tokens = sum(chunk.get("tkn_cnt_int", 0) for chunk in chunks)
            task.token_num = total_tokens
            
            task.result = chunks
            task.status = RunningStatus.DONE
            task.completed_at = datetime.now()
            
            if task.started_at:
                duration = (task.completed_at - task.started_at).total_seconds()
                minutes = int(duration // 60)
                seconds = int(duration % 60)
                duration_str = f"{minutes}分{seconds}秒" if minutes > 0 else f"{seconds}秒"
                self._set_progress(task, 1.0, f"完成！共生成 {len(chunks)} 个切片\n开始时间: {task.started_at.strftime('%Y-%m-%d %H:%M:%S')}\n结束时间: {task.completed_at.strftime('%Y-%m-%d %H:%M:%S')}\n耗时: {duration_str}")
            else:
                self._set_progress(task, 1.0, f"完成！共生成 {len(chunks)} 个切片")
            
            logger.info(f"切片流水线完成: {task.task_id}, {len(chunks)} 个切片, token总数: {total_tokens}")
        
        finally:
            # 清理临时文件
            if temp_file_path:
                cleanup_temp_files(temp_file_path)

    def _heartbeat_loop(self):
        """心跳检测循环"""
        logger.info("心跳检测线程已启动")

        while self._running and not self._shutdown_event.is_set():
            try:
                self._heartbeat_report()
            except Exception as e:
                logger.exception(f"心跳检测异常: {e}")

            self._shutdown_event.wait(10)

        logger.info("心跳检测线程已退出")

    def _heartbeat_report(self):
        """心跳状态报告"""
        queue_info = redis_utils.queue_info(self.QUEUE_NAME, self.GROUP_NAME)
        pending_msgs = redis_utils.get_pending_msg(self.QUEUE_NAME, self.GROUP_NAME)

        pending_count = 0
        running_count = 0
        completed_count = 0
        failed_count = 0

        for task in self._tasks.values():
            if task.status == RunningStatus.PENDING:
                pending_count += 1
            elif task.status == RunningStatus.RUNNING:
                running_count += 1
            elif task.status == RunningStatus.DONE:
                completed_count += 1
            elif task.status == RunningStatus.FAIL:
                failed_count += 1

        active_count = self._get_active_task_count()

        heartbeat_data = {
            "consumer_name": self.CONSUMER_NAME,
            "active_tasks": active_count,
            "max_concurrent": self.MAX_CONCURRENT_TASKS,
            "pending": pending_count,
            "running": running_count,
            "completed": completed_count,
            "failed": failed_count,
            "timestamp": datetime.now().isoformat(),
        }

        redis_utils.set_obj(self.HEARTBEAT_KEY, heartbeat_data, exp=30)

        logger.debug(
            f"心跳报告: 活跃={active_count}/{self.MAX_CONCURRENT_TASKS}, "
            f"待执行={pending_count}, 执行中={running_count}, "
            f"已完成={completed_count}, 失败={failed_count}"
        )

    def get_task_status(self, task_id: str) -> Optional[DocumentTask]:
        """获取任务状态"""
        return self._get_task(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        logger.info(f"尝试取消任务: {task_id}")
        
        task = self._get_task(task_id)
        if not task:
            logger.info(f"任务不存在或已完成，视为已停止: {task_id}")
            return True

        if task.status in (RunningStatus.DONE, RunningStatus.FAIL, RunningStatus.CANCEL):
            logger.info(f"任务已处于终止状态，无需取消: {task_id}, 状态: {task.status}")
            return True

        redis_utils.set(f"{self.CANCEL_KEY_PREFIX}{task_id}", "1", exp=3600)
        logger.info(f"任务取消标记已设置: {task_id}")
        
        old_status = task.status
        task.status = RunningStatus.CANCEL
        task.progress = 1.0
        task.completed_at = datetime.now()
        timestamp = datetime.now().strftime('%H:%M:%S')
        
        if old_status == RunningStatus.WAITING:
            task.progress_message = f"[{timestamp}] 任务已取消"
        else:
            if task.progress_message:
                task.progress_message = f"{task.progress_message}\n[{timestamp}] 任务已取消"
            else:
                task.progress_message = f"[{timestamp}] 任务已取消"

        self._update_document_status(task)
        logger.info(f"任务状态已更新为取消: {task_id}")
        
        return True

    def cleanup_task(self, task_id: str) -> bool:
        """清理任务"""
        if task_id in self._tasks:
            del self._tasks[task_id]
        redis_utils.delete(f"{self.CANCEL_KEY_PREFIX}{task_id}")
        return True

    def run_document_task(self, doc_id: str) -> Optional[DocumentTask]:
        """执行文档切片任务（从数据库读取文档信息并提交）"""
        try:
            logger.info(f"开始执行文档切片任务: doc_id={doc_id}")
            
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == doc_id)
            logger.info(f"找到文档: id={doc.id}, kb_id={doc.kb_id}, file_name={doc.file_name}, chunk_method={doc.chunk_method}")
            
            if doc.deleted:
                logger.error(f"文档已删除: {doc_id}")
                return None

            kb = Knowledgebase.get(Knowledgebase.id == doc.kb_id)
            logger.info(f"找到知识库: id={kb.id}, name={kb.name}, embedding_model_id={kb.embedding_model_id}")

            parser_config = {}
            if doc.chunk_config:
                try:
                    parser_config = json.loads(doc.chunk_config) if isinstance(doc.chunk_config, str) else doc.chunk_config
                except (json.JSONDecodeError, TypeError):
                    pass

            metadatas = {}
            if doc.metadatas:
                try:
                    metadatas = json.loads(doc.metadatas) if isinstance(doc.metadatas, str) else doc.metadatas
                except (json.JSONDecodeError, TypeError):
                    pass

            embedding_model_id = kb.embedding_model_id if kb else None
            text_model_id = kb.text_model_id if kb else None
            logger.info(f"模型配置: embedding_model_id={embedding_model_id}, text_model_id={text_model_id}")

            self._delete_es_chunks(doc.kb_id, doc_id)

            old_token_num = doc.token_num or 0
            old_chunk_num = doc.chunk_num or 0
            if old_token_num > 0 or old_chunk_num > 0:
                self._update_kb_stats(doc.kb_id, -old_token_num, -old_chunk_num)

            redis_utils.delete(f"{self.CANCEL_KEY_PREFIX}{doc_id}")

            doc.running_status = RunningStatus.WAITING
            doc.task_progress = 0
            doc.task_progress_message = ""
            doc.task_begin_at = None
            doc.task_end_at = None
            doc.task_duration = 0
            doc.token_num = 0
            doc.chunk_num = 0
            doc.save()
            
            self._publish_doc_event(doc.kb_id, {
                "doc_id": doc.id,
                "running_status": doc.running_status,
                "task_progress": 0,
                "task_progress_message": "",
                "chunk_num": 0,
                "token_num": 0,
            })

            task = self.submit_task(
                doc=doc,
                lang="Chinese",
                parser_config=parser_config,
                embedding_model_id=embedding_model_id,
                text_model_id=text_model_id,
                metadatas=metadatas,
            )
            
            logger.info(f"任务提交结果: task_id={task.task_id if task else None}")
            return task

        except KnowledgebaseDocument.DoesNotExist:
            logger.error(f"文档不存在: {doc_id}")
            return None
        except Knowledgebase.DoesNotExist:
            logger.error(f"知识库不存在: kb_id={doc.kb_id if 'doc' in dir() else 'unknown'}")
            return None
        except Exception as e:
            logger.error(f"执行文档任务失败: {e}", exc_info=True)
            return None

    def stop_document_task(self, doc_id: str) -> bool:
        """停止文档切片任务"""
        return self.cancel_task(doc_id)

    def delete_document_chunks(self, kb_id: str, doc_id: str) -> bool:
        """删除文档的切片数据（ES+任务清理）"""
        self._delete_es_chunks(kb_id, doc_id)
        self.cleanup_task(doc_id)

        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == doc_id)
            doc.running_status = RunningStatus.CANCEL
            doc.task_progress = 0
            doc.task_progress_message = "切片数据已删除"
            doc.chunk_num = 0
            doc.token_num = 0
            doc.save()
        except Exception as e:
            logger.error(f"更新文档状态失败: {e}")

        return True

    def batch_run_documents(self, doc_ids: List[str]) -> Dict[str, Any]:
        """批量执行文档切片任务，忽略正在执行的任务"""
        results = {"success": [], "failed": [], "skipped": []}
        for doc_id in doc_ids:
            try:
                doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == doc_id)
                if doc.running_status in (RunningStatus.RUNNING, RunningStatus.WAITING):
                    results["skipped"].append(doc_id)
                    continue
                task = self.run_document_task(doc_id)
                if task:
                    results["success"].append(doc_id)
                else:
                    results["failed"].append(doc_id)
            except Exception as e:
                logger.error(f"批量执行任务异常 {doc_id}: {e}")
                results["failed"].append(doc_id)
        return results

    def batch_stop_documents(self, doc_ids: List[str]) -> Dict[str, Any]:
        """批量停止文档切片任务，忽略非正在执行的任务"""
        results = {"success": [], "failed": [], "skipped": []}
        for doc_id in doc_ids:
            try:
                doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == doc_id)
                if doc.running_status not in (RunningStatus.RUNNING, RunningStatus.WAITING):
                    results["skipped"].append(doc_id)
                    continue
                success = self.stop_document_task(doc_id)
                if success:
                    results["success"].append(doc_id)
                else:
                    results["failed"].append(doc_id)
            except Exception as e:
                logger.error(f"批量停止任务异常 {doc_id}: {e}")
                results["failed"].append(doc_id)
        return results


def main():
    """主函数 - 独立运行时启动任务调度器"""
    from app.configs.config import config
    
    log_level = config.logging.get('level', 'INFO').upper()
    log_format = config.logging.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format=log_format
    )

    executor = TaskExecutor()

    try:
        executor.start()
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到中断信号")
    finally:
        executor.stop()


if __name__ == "__main__":
    main()
