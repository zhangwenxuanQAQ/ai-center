"""
文档切片任务调度器和执行器
参考RAGFLOW的task_executor.py实现

功能:
1. 从Redis队列获取待执行任务
2. 执行文档切片任务
3. 心跳检测和状态报告
4. Signal处理（优雅关闭）
5. 任务限流（限制同时执行的任务数量）
"""

import logging
import signal
import threading
import time
import uuid
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from app.database.redis_utils import redis_utils
from app.core.knowledge.rag.app import CHUNK_STRATEGIES

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DocumentTask:
    """文档切片任务类"""

    def __init__(
        self,
        task_id: str,
        filename: str,
        binary: Optional[bytes] = None,
        parse_type: str = "naive",
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
    ):
        self.task_id = task_id
        self.filename = filename
        self.binary = binary
        self.parse_type = parse_type
        self.lang = lang
        self.parser_config = parser_config or {}
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.error: Optional[str] = None
        self.result: Optional[List[Dict[str, Any]]] = None
        self.progress: float = 0.0
        self.progress_message: str = ""


class TaskExecutor:
    """文档切片任务执行器"""

    # 队列配置
    QUEUE_NAME = "document_chunk_queue"
    GROUP_NAME = "chunk_workers"
    CONSUMER_NAME = f"chunk_worker_{uuid.uuid4().hex[:8]}"

    # 任务存储前缀
    TASK_KEY_PREFIX = "chunk_task:"

    # 最大并发任务数（可通过环境变量 MAX_CONCURRENT_TASKS 配置）
    MAX_CONCURRENT_TASKS = int(os.environ.get('MAX_CONCURRENT_TASKS', '5'))

    def __init__(self):
        self._running = False
        self._shutdown_event = threading.Event()
        self._tasks: Dict[str, DocumentTask] = {}
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._worker_thread: Optional[threading.Thread] = None
        
        # 任务限流器（Semaphore）
        self._task_limiter = threading.Semaphore(self.MAX_CONCURRENT_TASKS)
        
        # 活跃任务跟踪
        self._active_tasks: set = set()
        self._active_tasks_lock = threading.Lock()

    def start(self):
        """启动任务调度器"""
        if self._running:
            logger.warning("任务调度器已在运行")
            return

        if not redis_utils.is_available:
            logger.error("Redis不可用，无法启动任务调度器")
            return

        logger.info("=" * 60)
        logger.info("       🚀 文档切片任务调度器启动")
        logger.info("=" * 60)
        logger.info(f"  队列名称: {self.QUEUE_NAME}")
        logger.info(f"  消费者组: {self.GROUP_NAME}")
        logger.info(f"  消费者ID: {self.CONSUMER_NAME}")
        logger.info(f"  最大并发任务: {self.MAX_CONCURRENT_TASKS}")
        logger.info("=" * 60)

        self._running = True
        self._shutdown_event.clear()

        # 注册信号处理
        self._register_signals()

        # 启动工作线程
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True
        )
        self._worker_thread.start()

        # 启动心跳线程
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            daemon=True
        )
        self._heartbeat_thread.start()

        logger.info("✅ 任务调度器已启动")

    def stop(self):
        """停止任务调度器（优雅关闭）"""
        if not self._running:
            return

        logger.info("⏳ 正在关闭任务调度器...")
        self._running = False
        self._shutdown_event.set()

        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=10)

        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=5)

        logger.info("✅ 任务调度器已停止")

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

    def submit_task(
        self,
        task_id: Optional[str] = None,
        filename: str = "",
        binary: Optional[bytes] = None,
        parse_type: str = "naive",
        lang: str = "Chinese",
        parser_config: Optional[Dict[str, Any]] = None,
    ) -> DocumentTask:
        """
        提交任务到队列
        
        Args:
            task_id: 任务ID（可选，自动生成）
            filename: 文件名
            binary: 文件二进制数据
            parse_type: 解析类型
            lang: 语言
            parser_config: 解析配置
            
        Returns:
            DocumentTask: 任务对象
        """
        if not task_id:
            task_id = str(uuid.uuid4())

        task = DocumentTask(
            task_id=task_id,
            filename=filename,
            binary=binary,
            parse_type=parse_type,
            lang=lang,
            parser_config=parser_config
        )

        self._tasks[task_id] = task

        # 存储任务到Redis
        self._save_task(task)

        # 发送任务消息到队列
        message = {
            "task_id": task_id,
            "filename": filename,
            "parse_type": parse_type,
            "lang": lang,
            "parser_config": parser_config,
            "timestamp": datetime.now().isoformat(),
        }

        if redis_utils.queue_product(self.QUEUE_NAME, message):
            logger.info(f"任务已提交到队列: {task_id}")
        else:
            logger.error(f"任务提交到队列失败: {task_id}")
            task.status = TaskStatus.FAILED
            task.error = "Failed to enqueue task"

        return task

    def _save_task(self, task: DocumentTask):
        """保存任务状态到Redis"""
        task_data = {
            "task_id": task.task_id,
            "filename": task.filename,
            "parse_type": task.parse_type,
            "lang": task.lang,
            "status": task.status.value,
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
            exp=3600 * 24  # 24小时过期
        )

    def _get_task(self, task_id: str) -> Optional[DocumentTask]:
        """从Redis获取任务"""
        task_data = redis_utils.get_obj(f"{self.TASK_KEY_PREFIX}{task_id}")
        if not task_data:
            return None

        if task_id in self._tasks:
            return self._tasks[task_id]

        task = DocumentTask(
            task_id=task_data["task_id"],
            filename=task_data["filename"],
            parse_type=task_data["parse_type"],
            lang=task_data["lang"]
        )
        task.status = TaskStatus(task_data["status"])
        task.progress = task_data.get("progress", 0)
        task.progress_message = task_data.get("progress_message", "")
        task.error = task_data.get("error")

        self._tasks[task_id] = task
        return task

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

    def _worker_loop(self):
        """工作线程主循环"""
        logger.info("工作线程已启动")

        while self._running and not self._shutdown_event.is_set():
            try:
                # 从队列获取消息
                msg = redis_utils.queue_consumer(
                    self.QUEUE_NAME,
                    self.GROUP_NAME,
                    self.CONSUMER_NAME
                )

                if not msg:
                    time.sleep(1)
                    continue

                # 处理任务（在单独线程中执行，支持并发）
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
            # 获取任务ID
            message = msg.get_message()
            task_id = message.get("task_id")
            
            # 获取信号量（限流）
            logger.debug(f"等待获取限流器: {task_id}, 当前活跃: {self._get_active_task_count()}/{self.MAX_CONCURRENT_TASKS}")
            acquired = self._task_limiter.acquire(timeout=30)  # 30秒超时
            
            if not acquired:
                logger.warning(f"获取限流器超时: {task_id}")
                return
            
            try:
                # 处理任务
                self._process_message(msg)
            finally:
                # 释放信号量
                self._task_limiter.release()
                logger.debug(f"释放限流器: {task_id}")
                
        except Exception as e:
            logger.exception(f"任务处理异常: {e}")

    def _process_message(self, msg):
        """处理单个消息"""
        task_id = None
        try:
            message = msg.get_message()
            task_id = message.get("task_id")

            logger.info(f"收到任务: {task_id}")

            # 获取任务
            task = self._get_task(task_id)
            if not task:
                logger.warning(f"任务不存在: {task_id}")
                msg.ack()
                return

            # 添加到活跃任务
            self._add_active_task(task_id)
            
            try:
                # 更新任务状态
                task.status = TaskStatus.RUNNING
                task.started_at = datetime.now()
                self._save_task(task)

                # 执行切片
                try:
                    self._execute_chunk(task)
                except Exception as e:
                    logger.exception(f"任务执行异常 {task_id}: {e}")
                    task.status = TaskStatus.FAILED
                    task.error = str(e)
                    task.completed_at = datetime.now()

                # 保存结果
                self._save_task(task)

                # 确认消息
                msg.ack()
                logger.info(f"任务处理完成: {task_id}, 状态: {task.status.value}")
                
            finally:
                # 从活跃任务移除
                self._remove_active_task(task_id)

        except Exception as e:
            logger.exception(f"处理消息异常: {e}")

    def _execute_chunk(self, task: DocumentTask):
        """执行文档切片"""
        logger.info(f"开始执行切片: {task.task_id}, 策略: {task.parse_type}")

        def progress_callback(prog=None, msg=""):
            if prog is not None:
                task.progress = prog
            if msg:
                task.progress_message = msg
            self._save_task(task)
            logger.debug(f"[{task.task_id}] {task.progress:.1%} {task.progress_message}")

        # 获取策略函数
        chunk_func = CHUNK_STRATEGIES.get(task.parse_type)
        if not chunk_func:
            raise ValueError(f"不支持的切片策略: {task.parse_type}")

        # 执行切片
        result = chunk_func(
            filename=task.filename,
            binary=task.binary,
            lang=task.lang,
            parser_config=task.parser_config,
            callback=progress_callback
        )

        task.result = result
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        task.progress = 1.0
        task.progress_message = f"完成！共生成 {len(result)} 个切片"

        logger.info(f"切片完成: {task.task_id}, {len(result)} 个切片")

    def _heartbeat_loop(self):
        """心跳检测循环"""
        logger.info("心跳检测线程已启动")

        while self._running and not self._shutdown_event.is_set():
            try:
                self._heartbeat_report()
            except Exception as e:
                logger.exception(f"心跳检测异常: {e}")

            # 每10秒报告一次
            self._shutdown_event.wait(10)

        logger.info("心跳检测线程已退出")

    def _heartbeat_report(self):
        """心跳状态报告"""
        # 获取队列信息
        queue_info = redis_utils.queue_info(self.QUEUE_NAME, self.GROUP_NAME)

        # 获取待确认消息
        pending_msgs = redis_utils.get_pending_msg(self.QUEUE_NAME, self.GROUP_NAME)

        # 获取内存中的任务状态
        pending_count = 0
        running_count = 0
        completed_count = 0
        failed_count = 0

        for task in self._tasks.values():
            if task.status == TaskStatus.PENDING:
                pending_count += 1
            elif task.status == TaskStatus.RUNNING:
                running_count += 1
            elif task.status == TaskStatus.COMPLETED:
                completed_count += 1
            elif task.status == TaskStatus.FAILED:
                failed_count += 1

        # 获取当前活跃任务数
        active_count = self._get_active_task_count()

        # 打印报告
        logger.info("-" * 60)
        logger.info("              📊 任务调度器状态报告")
        logger.info("-" * 60)
        logger.info(f"  队列信息: {self.QUEUE_NAME}")
        if queue_info:
            logger.info(f"    - 待处理: {queue_info.get('pending', 0)}")
            logger.info(f"    - 消费者: {queue_info.get('consumers', 0)}")
        logger.info(f"  待确认消息: {len(pending_msgs)}")
        logger.info(f"  并发限制: {active_count}/{self.MAX_CONCURRENT_TASKS}")
        logger.info(f"  内存任务:")
        logger.info(f"    - 待执行: {pending_count}")
        logger.info(f"    - 执行中: {running_count}")
        logger.info(f"    - 已完成: {completed_count}")
        logger.info(f"    - 已失败: {failed_count}")
        logger.info(f"  总任务数: {len(self._tasks)}")
        logger.info("-" * 60)

    def get_task_status(self, task_id: str) -> Optional[DocumentTask]:
        """获取任务状态"""
        return self._get_task(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self._get_task(task_id)
        if not task:
            return False

        if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            return True

        task.status = TaskStatus.CANCELLED
        task.completed_at = datetime.now()
        self._save_task(task)
        return True

    def cleanup_task(self, task_id: str) -> bool:
        """清理任务"""
        if task_id in self._tasks:
            del self._tasks[task_id]
        redis_utils.delete(f"{self.TASK_KEY_PREFIX}{task_id}")
        return True


# 全局单例实例
task_executor = TaskExecutor()


def main():
    """
    主函数 - 独立运行时启动任务调度器
    """
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    executor = TaskExecutor()

    try:
        executor.start()
        # 主线程保持运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到中断信号")
    finally:
        executor.stop()


if __name__ == "__main__":
    main()
