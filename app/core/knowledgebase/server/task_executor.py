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
import signal
import threading
import time
import uuid
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
        doc_id: str,
        kb_id: str,
        filename: str = "",
        binary: Optional[bytes] = None,
        parse_type: str = "naive",
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
        embedding_model_id: Optional[str] = None,
        text_model_id: Optional[str] = None,
    ):
        self.task_id = task_id
        self.doc_id = doc_id
        self.kb_id = kb_id
        self.filename = filename
        self.binary = binary
        self.parse_type = parse_type
        self.lang = lang
        self.parser_config = parser_config or {}
        self.embedding_model_id = embedding_model_id
        self.text_model_id = text_model_id
        self.status = RunningStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.error: Optional[str] = None
        self.result: Optional[List[Dict[str, Any]]] = None
        self.progress: float = 0.0
        self.progress_message: str = ""


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

        self._register_signals()

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

        logger.info("任务调度器已启动")

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

        logger.info("任务调度器已停止")

    def _register_signals(self):
        """注册信号处理器"""
        try:
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            logger.info("信号处理器已注册 (SIGINT, SIGTERM)")
        except Exception as e:
            logger.warning(f"信号处理器注册失败: {e}")

    def _signal_handler(self, signum, frame):
        """信号处理函数"""
        logger.info(f"收到信号 {signum}，正在关闭...")
        self.stop()

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

    def _init_kb_index(self, kb_id: str, vector_size: int = 1024):
        """初始化知识库ES索引，索引名为知识库ID"""
        if not es_utils.is_available:
            logger.warning("ES不可用，跳过索引初始化")
            return False

        try:
            index_name = kb_id
            if es_utils.client.indices.exists(index=index_name):
                logger.info(f"ES索引已存在: {index_name}")
                return True

            mappings = None
            if self._mapping_config:
                mappings = self._mapping_config.get("mappings", {})
                settings = self._mapping_config.get("settings", {})
                body = {"settings": settings, "mappings": mappings}
                es_utils.client.indices.create(index=index_name, body=body)
                logger.info(f"成功使用mapping.json创建ES索引: {index_name}")
            else:
                es_utils.create_index(index_name)

            return True
        except Exception as e:
            logger.error(f"初始化ES索引失败 {kb_id}: {e}")
            return False

    def submit_task(
        self,
        doc_id: str,
        kb_id: str,
        filename: str = "",
        parse_type: str = "naive",
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
        embedding_model_id: Optional[str] = None,
        text_model_id: Optional[str] = None,
    ) -> DocumentTask:
        """
        提交任务到队列

        Args:
            doc_id: 文档ID
            kb_id: 知识库ID
            filename: 文件名
            parse_type: 解析类型
            lang: 语言
            parser_config: 解析配置
            embedding_model_id: Embedding模型ID
            text_model_id: Text模型ID

        Returns:
            DocumentTask: 任务对象
        """
        task_id = doc_id

        task = DocumentTask(
            task_id=task_id,
            doc_id=doc_id,
            kb_id=kb_id,
            filename=filename,
            parse_type=parse_type,
            lang=lang,
            parser_config=parser_config,
            embedding_model_id=embedding_model_id,
            text_model_id=text_model_id,
        )

        self._tasks[task_id] = task
        self._save_task(task)

        message = {
            "task_id": task_id,
            "doc_id": doc_id,
            "kb_id": kb_id,
            "filename": filename,
            "parse_type": parse_type,
            "lang": lang,
            "parser_config": parser_config,
            "embedding_model_id": embedding_model_id,
            "text_model_id": text_model_id,
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

    def _save_task(self, task: DocumentTask):
        """保存任务状态到Redis"""
        task_data = {
            "task_id": task.task_id,
            "doc_id": task.doc_id,
            "kb_id": task.kb_id,
            "filename": task.filename,
            "parse_type": task.parse_type,
            "lang": task.lang,
            "parser_config": task.parser_config,
            "embedding_model_id": task.embedding_model_id,
            "text_model_id": task.text_model_id,
            "status": task.status,
            "progress": task.progress,
            "progress_message": task.progress_message,
            "created_at": task.created_at.isoformat(),
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "error": task.error,
        }

        redis_utils.set_obj(
            f"{self.TASK_KEY_PREFIX}{task.task_id}",
            task_data,
            exp=3600 * 24
        )

    def _get_task(self, task_id: str) -> Optional[DocumentTask]:
        """从Redis获取任务"""
        if task_id in self._tasks:
            return self._tasks[task_id]

        task_data = redis_utils.get_obj(f"{self.TASK_KEY_PREFIX}{task_id}")
        if not task_data:
            return None

        task = DocumentTask(
            task_id=task_data["task_id"],
            doc_id=task_data["doc_id"],
            kb_id=task_data["kb_id"],
            filename=task_data.get("filename", ""),
            parse_type=task_data["parse_type"],
            lang=task_data.get("lang", "Chinese"),
            parser_config=task_data.get("parser_config"),
            embedding_model_id=task_data.get("embedding_model_id"),
            text_model_id=task_data.get("text_model_id"),
        )
        task.status = task_data["status"]
        task.progress = task_data.get("progress", 0)
        task.progress_message = task_data.get("progress_message", "")
        task.error = task_data.get("error")

        self._tasks[task_id] = task
        return task

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

    def _set_progress(self, task: DocumentTask, prog: float = None, msg: str = "Processing..."):
        """设置任务进度并更新数据库"""
        try:
            if prog is not None and prog < 0:
                msg = "[ERROR]" + msg

            if self._has_canceled(task.task_id):
                msg += " [Canceled]"
                prog = -1

            if prog is not None:
                new_progress = min(max(prog, 0), 1.0)
                if new_progress < task.progress:
                    logger.debug(f"进度未更新: 当前进度 {task.progress:.2%}, 新进度 {new_progress:.2%}")
                else:
                    task.progress = new_progress
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            new_msg = f"[{timestamp}] {msg}"
            if task.progress_message:
                task.progress_message = f"{task.progress_message}\n{new_msg}"
            else:
                task.progress_message = new_msg

            self._save_task(task)
            self._update_document_status(task)

            if self._has_canceled(task.task_id):
                raise TaskCanceledException(msg)

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
            callback=lambda prog=None, msg="": self._set_progress(
                task,
                prog=0.05 + 0.45 * prog if prog else None,
                msg=msg
            )
        )

        self._set_progress(task, 0.50, f"切片完成，共 {len(result)} 个切片")

        auto_keywords = task.parser_config.get("auto_keywords", 1)
        text_model_id = getattr(task, "text_model_id", None)
        if auto_keywords > 0 and text_model_id:
            self._extract_keywords(task, result, auto_keywords)

        return result

    def _extract_keywords(self, task: DocumentTask, chunks: List[Dict[str, Any]], topn: int):
        """提取切片关键词

        进度范围: 0.50 ~ 0.60
        """
        import asyncio
        from app.core.knowledgebase.rag.prompts.generator import keyword_extraction
        from app.core.knowledgebase.rag.utils.common_utils import get_llm_cache, set_llm_cache

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
                    set_llm_cache(model_name, content, kwd, "keywords", gen_conf)
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
                title_embeddings, title_tokens = embedding_model.encode(titles[:1])
                if len(titles) > 1:
                    title_embeddings = np.tile(title_embeddings[0], (len(titles), 1))
                total_tokens += title_tokens
            except Exception as e:
                logger.warning(f"标题向量化失败: {e}")
                title_embeddings = None
        
        batch_size = 16
        all_content_embeddings = []
        for i in range(0, len(contents), batch_size):
            batch = contents[i:i + batch_size]
            try:
                batch_embeddings, batch_tokens = embedding_model.encode(batch)
                all_content_embeddings.append(batch_embeddings)
                total_tokens += batch_tokens
            except Exception as e:
                logger.warning(f"批次 {i//batch_size} 向量化失败: {e}")
                continue
            
            progress = 0.60 + 0.25 * ((i + batch_size) / len(contents))
            self._set_progress(task, progress, f"向量化进度: {min(i + batch_size, len(contents))}/{len(contents)}")
        
        if all_content_embeddings:
            content_embeddings = np.concatenate(all_content_embeddings, axis=0)
        else:
            content_embeddings = None
        
        # 确保至少有一个向量源可用
        if content_embeddings is not None and len(content_embeddings) > 0:
            vector_size = len(content_embeddings[0])
        elif title_embeddings is not None and len(title_embeddings) > 0:
            vector_size = len(title_embeddings[0])
        else:
            vector_size = self._get_vector_size(task.embedding_model_id, embedding_model) if task.embedding_model_id else 1024
        
        q_vec_field = f"q_{vector_size}_vec"
        
        title_w = float(filename_embd_weight)
        if (title_embeddings is not None and content_embeddings is not None and 
            title_embeddings.ndim == 2 and content_embeddings.ndim == 2 and 
            title_embeddings.shape == content_embeddings.shape):
            final_embeddings = title_w * title_embeddings + (1 - title_w) * content_embeddings
        elif content_embeddings is not None:
            final_embeddings = content_embeddings
        elif title_embeddings is not None:
            final_embeddings = np.tile(title_embeddings[0] if len(title_embeddings) > 0 else np.zeros(vector_size), (len(chunks), 1))
        else:
            final_embeddings = np.zeros((len(chunks), vector_size))
        
        for i, chunk in enumerate(chunks):
            if i < len(final_embeddings):
                v = final_embeddings[i].tolist()
                chunk["embedding"] = v
                chunk[q_vec_field] = v
            
            content = contents[i] if i < len(contents) else ""
            chunk["tkn_cnt_int"] = len(content.split()) if content else 0
        
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
        
        self._init_kb_index(task.kb_id, vector_size)

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
            doc["doc_name"] = task.filename
            doc["chunk_id"] = f"{task.doc_id}_{i}"
            doc["create_time"] = str(datetime.now()).replace("T", " ")[:19]
            doc["create_timestamp_flt"] = datetime.now().timestamp()

            if "image" in doc:
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

        while self._running and not self._shutdown_event.is_set():
            try:
                msg = redis_utils.queue_consumer(
                    self.QUEUE_NAME,
                    self.GROUP_NAME,
                    self.CONSUMER_NAME
                )

                if not msg:
                    time.sleep(1)
                    continue

                threading.Thread(
                    target=self._process_task_with_limit,
                    args=(msg,),
                    daemon=True
                ).start()

            except Exception as e:
                logger.exception(f"工作线程异常: {e}")
                time.sleep(2)

        logger.info("工作线程已退出")

    def _process_task_with_limit(self, msg):
        """使用限流器处理任务"""
        task_id = None
        try:
            message = msg.get_message()
            task_id = message.get("task_id")

            acquired = self._task_limiter.acquire(timeout=30)

            if not acquired:
                logger.warning(f"获取限流器超时: {task_id}")
                return

            try:
                self._process_message(msg)
            finally:
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

            task = self._get_task(task_id)
            if not task:
                logger.warning(f"任务不存在: {task_id}")
                msg.ack()
                return

            if self._has_canceled(task.task_id):
                logger.info(f"任务已被取消: {task_id}")
                task.status = RunningStatus.CANCEL
                task.completed_at = datetime.now()
                self._save_task(task)
                self._update_document_status(task)
                msg.ack()
                return

            self._add_active_task(task_id)

            try:
                task.status = RunningStatus.RUNNING
                task.started_at = datetime.now()
                self._set_progress(task, 0.0, "开始处理...")

                try:
                    self._execute_chunk(task)
                except TaskCanceledException:
                    task.status = RunningStatus.CANCEL
                    self._set_progress(task, 1.0, "任务已取消")
                    task.completed_at = datetime.now()
                except Exception as e:
                    logger.exception(f"任务执行异常 {task_id}: {e}")
                    task.status = RunningStatus.FAIL
                    task.error = str(e)
                    self._set_progress(task, -1, f"任务失败: {str(e)[:200]}")
                    task.completed_at = datetime.now()

                self._save_task(task)
                self._update_document_status(task)

                msg.ack()
                logger.info(f"任务处理完成: {task_id}, 状态: {task.status}")

            finally:
                self._remove_active_task(task_id)
                redis_utils.delete(f"{self.CANCEL_KEY_PREFIX}{task_id}")

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
        logger.info(f"开始执行切片流水线: {task.task_id}, 文档: {task.filename}")

        self._set_progress(task, 0.0, "开始读取文件...")

        if not task.binary:
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
                chunk["tkn_cnt_int"] = len(chunk.get("content_with_weight", "").split()) if chunk.get("content_with_weight") else 0
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
        return True

    def cleanup_task(self, task_id: str) -> bool:
        """清理任务"""
        if task_id in self._tasks:
            del self._tasks[task_id]
        redis_utils.delete(f"{self.TASK_KEY_PREFIX}{task_id}")
        redis_utils.delete(f"{self.CANCEL_KEY_PREFIX}{task_id}")
        return True

    def run_document_task(self, doc_id: str) -> Optional[DocumentTask]:
        """执行文档切片任务（从数据库读取文档信息并提交）"""
        try:
            doc = KnowledgebaseDocument.get(KnowledgebaseDocument.id == doc_id)
            if doc.deleted:
                logger.error(f"文档已删除: {doc_id}")
                return None

            kb = Knowledgebase.get(Knowledgebase.id == doc.kb_id)

            parser_config = {}
            if doc.chunk_config:
                try:
                    parser_config = json.loads(doc.chunk_config) if isinstance(doc.chunk_config, str) else doc.chunk_config
                except (json.JSONDecodeError, TypeError):
                    pass

            embedding_model_id = kb.embedding_model_id if kb else None
            text_model_id = kb.text_model_id if kb else None

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
                doc_id=doc.id,
                kb_id=doc.kb_id,
                filename=doc.location or doc.file_name,
                parse_type=doc.chunk_method,
                lang="Chinese",
                parser_config=parser_config,
                embedding_model_id=embedding_model_id,
                text_model_id=text_model_id,
            )

            return task

        except KnowledgebaseDocument.DoesNotExist:
            logger.error(f"文档不存在: {doc_id}")
            return None
        except Knowledgebase.DoesNotExist:
            logger.error(f"知识库不存在")
            return None
        except Exception as e:
            logger.error(f"执行文档任务失败: {e}")
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
        """批量执行文档切片任务"""
        results = {"success": [], "failed": []}
        for doc_id in doc_ids:
            task = self.run_document_task(doc_id)
            if task:
                results["success"].append(doc_id)
            else:
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
