#
#  Copyright 2025 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import os
import io
import time
import logging
from datetime import datetime
from threading import Thread, Lock
from typing import Generator, Optional

import tempfile

PROJECT_BASE = os.getenv("RAG_PROJECT_BASE") or os.getenv("RAG_DEPLOY_BASE")

logger = logging.getLogger(__name__)

# 结果文件临时子目录名（位于系统临时目录下，如 %TEMP%/temp_results）
TEMP_RESULT_DIR_NAME = 'temp_results'

# 默认文件过期时间（秒）：24小时
DEFAULT_EXPIRE_SECONDS = 86400

# 流式下载分块大小（64KB）
DOWNLOAD_CHUNK_SIZE = 64 * 1024

# 过期清理线程默认检测间隔（秒）：1小时
CLEANUP_INTERVAL_SECONDS = 3600


def get_project_base_directory(*args):
    global PROJECT_BASE
    if PROJECT_BASE is None:
        PROJECT_BASE = os.path.abspath(
            os.path.join(
                os.path.dirname(os.path.realpath(__file__)),
                os.pardir,
                os.pardir,
            )
        )

    if args:
        return os.path.join(PROJECT_BASE, *args)
    return PROJECT_BASE


def traversal_files(base):
    for root, ds, fs in os.walk(base):
        for f in fs:
            fullname = os.path.join(root, f)
            yield fullname


# ==================== 结果文件临时目录管理 ====================

def get_temp_dir() -> str:
    """获取结果文件临时目录路径（系统临时目录/temp_results，不存在则自动创建）"""
    temp_dir = os.path.join(tempfile.gettempdir(), TEMP_RESULT_DIR_NAME)
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def create_result_file(file_name: str) -> str:
    """在临时目录中创建结果文件，返回完整路径

    文件名会自动拼接当前时间戳：name_YYYYmmdd_HHMMSS.ext，
    同一秒内重名时追加序号避免覆盖。

    Args:
        file_name: 文件名（含扩展名，如 result.json）

    Returns:
        str: 文件完整路径
    """
    temp_dir = get_temp_dir()
    base, ext = os.path.splitext(file_name)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_path = os.path.join(temp_dir, f"{base}_{timestamp}{ext}")
    # 同秒重名防覆盖
    counter = 1
    while os.path.exists(file_path):
        file_path = os.path.join(temp_dir, f"{base}_{timestamp}_{counter}{ext}")
        counter += 1
    return file_path


def write_bytes(file_path: str, data: bytes) -> None:
    """写入二进制数据到文件（覆盖模式）"""
    with open(file_path, 'wb') as f:
        f.write(data)


def append_bytes(file_path: str, data: bytes) -> None:
    """追加二进制数据到文件"""
    with open(file_path, 'ab') as f:
        f.write(data)


def write_text(file_path: str, text: str, encoding: str = 'utf-8') -> None:
    """写入文本到文件（覆盖模式）"""
    with open(file_path, 'w', encoding=encoding) as f:
        f.write(text)


def append_text(file_path: str, text: str, encoding: str = 'utf-8') -> None:
    """追加文本到文件"""
    with open(file_path, 'a', encoding=encoding) as f:
        f.write(text)


def read_file_bytes(file_path: str) -> Optional[bytes]:
    """读取文件全部二进制内容"""
    if not os.path.exists(file_path):
        return None
    with open(file_path, 'rb') as f:
        return f.read()


def stream_file_chunks(file_path: str, chunk_size: int = DOWNLOAD_CHUNK_SIZE) -> Generator[bytes, None, None]:
    """流式分块读取文件（用于大文件下载）

    Args:
        file_path: 文件路径
        chunk_size: 每块大小（字节），默认64KB

    Yields:
        bytes: 文件数据块
    """
    with open(file_path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            yield chunk


def delete_file(file_path: str) -> bool:
    """删除文件（不存在不报错）"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
        return True
    except Exception as e:
        logger.warning(f"删除文件失败: {file_path}, error={e}")
        return False


def file_exists(file_path: str) -> bool:
    """检查文件是否存在"""
    return os.path.exists(file_path) and os.path.isfile(file_path)


def get_file_size(file_path: str) -> int:
    """获取文件大小（字节），不存在返回0"""
    return os.path.getsize(file_path) if file_exists(file_path) else 0


def cleanup_expired_files(expire_seconds: int = DEFAULT_EXPIRE_SECONDS) -> int:
    """清理临时目录中过期的结果文件

    Args:
        expire_seconds: 过期时间（秒），默认24小时

    Returns:
        int: 删除的文件数量
    """
    temp_dir = get_temp_dir()
    if not os.path.exists(temp_dir):
        return 0

    now = time.time()
    deleted_count = 0
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        if not os.path.isfile(file_path):
            continue
        try:
            mtime = os.path.getmtime(file_path)
            if now - mtime > expire_seconds:
                os.remove(file_path)
                deleted_count += 1
                logger.info(f"清理过期结果文件: {filename}")
        except Exception as e:
            logger.warning(f"清理文件失败: {filename}, error={e}")

    if deleted_count > 0:
        logger.info(f"清理过期结果文件完成，共删除 {deleted_count} 个文件")
    return deleted_count


# ==================== 过期文件后台清理线程 ====================

_cleanup_thread: Optional[Thread] = None
_cleanup_thread_lock = Lock()


def _cleanup_loop(interval_seconds: int) -> None:
    """过期文件清理线程主循环：按固定间隔周期性执行清理"""
    while True:
        time.sleep(interval_seconds)
        try:
            cleanup_expired_files()
        except Exception as e:
            logger.warning(f"结果文件过期清理线程异常: {e}")


def start_cleanup_scheduler(interval_seconds: int = CLEANUP_INTERVAL_SECONDS) -> bool:
    """启动结果文件过期清理后台线程（守护线程，重复调用不会重复启动）

    Args:
        interval_seconds: 检测间隔（秒），默认1小时

    Returns:
        bool: 是否成功启动（False表示已在运行）
    """
    global _cleanup_thread
    with _cleanup_thread_lock:
        if _cleanup_thread and _cleanup_thread.is_alive():
            return False
        _cleanup_thread = Thread(
            target=_cleanup_loop,
            args=(interval_seconds,),
            daemon=True,
            name='result-file-cleaner',
        )
        _cleanup_thread.start()
    logger.info(f"结果文件过期清理线程已启动（每 {interval_seconds} 秒检测一次）")
    return True