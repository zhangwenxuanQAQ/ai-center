"""
本体工作台任务钩子

提供数据抽取任务的安全校验钩子，包括SQL安全过滤等。
继承BaseHook，SQL校验在before方法中执行。
"""

import logging
import re
import sqlparse
from typing import Any, Dict

from app.core.hooks.base_hook import BaseHook

logger = logging.getLogger(__name__)


class OntologyTaskHook(BaseHook):
    """本体工作台任务钩子 - 提供SQL安全校验等"""

    # 危险SQL关键字（作为sqlparse解析的补充检查）
    DANGEROUS_KEYWORDS = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
        'TRUNCATE', 'REPLACE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE',
        'MERGE', 'CALL', 'LOAD', 'IMPORT', 'RENAME', 'SHOW',
        'DESCRIBE', 'DESC', 'EXPLAIN', 'USE', 'SET',
    ]

    def before(self, **kwargs) -> Dict[str, Any]:
        """
        在被勾的方法执行前进行SQL安全校验

        校验规则：
        1. 禁止多条SQL语句（防止注入攻击）
        2. 只允许SELECT类型语句
        3. 补充检查危险关键字

        Args:
            **kwargs: 包含 sql 等参数

        Returns:
            Dict[str, Any]: 校验通过则返回原参数，失败则抛出异常

        Raises:
            Exception: SQL安全校验未通过时抛出
        """
        sql = kwargs.get('sql', '')

        if not sql or not sql.strip():
            raise Exception("SQL安全校验未通过: SQL语句不能为空")

        sql = sql.strip()

        try:
            # 1. 解析SQL
            parsed = sqlparse.parse(sql)
            if not parsed:
                raise Exception("SQL安全校验未通过: 无法解析SQL语句")

            # 2. 关键：禁止多条SQL语句，防止 'SELECT 1; DROP TABLE users' 这类攻击
            if len(parsed) > 1:
                raise Exception("SQL安全校验未通过: 禁止执行多条SQL语句")

            # 3. 检查语句类型，只允许SELECT
            statement = parsed[0]
            if statement.get_type().upper() != 'SELECT':
                raise Exception(f"SQL安全校验未通过: 仅允许SELECT查询操作，当前语句类型: {statement.get_type()}")

            # 4. 补充检查危险关键字（作为额外保险）
            sql_upper = sql.upper()
            for keyword in self.DANGEROUS_KEYWORDS:
                pattern = r'\b' + re.escape(keyword) + r'\b'
                if re.search(pattern, sql_upper):
                    if keyword == 'SELECT':
                        continue
                    raise Exception(f"SQL安全校验未通过: SQL中包含危险关键字: {keyword}")

            logger.info(f"SQL安全校验通过: {sql[:100]}...")
            return kwargs

        except Exception as e:
            if str(e).startswith("SQL安全校验未通过"):
                raise
            logger.error(f"SQL安全校验异常: {e}", exc_info=True)
            raise Exception(f"SQL安全校验未通过: SQL安全校验失败: {str(e)}")

    def ongoing(self, intermediate_result: Any, **kwargs) -> Any:
        """
        在执行过程中调用（当前无需处理）

        Args:
            intermediate_result: 中间结果
            **kwargs: 动态入参

        Returns:
            Any: 原样返回中间结果
        """
        return intermediate_result

    def after(self, result: Any) -> Any:
        """
        在执行后调用（当前无需处理）

        Args:
            result: 执行结果

        Returns:
            Any: 原样返回执行结果
        """
        return result