"""
API调用内置工具

将任意HTTP API的调用封装为统一工具，参数覆盖API服务器地址及接口所需的全部字段
（请求方法、路径、请求头、查询参数、路径参数、请求体、超时时间等），
执行真实的HTTP请求并返回结构化结果。

同时对外提供请求头/参数的合并及请求执行的公共方法，供API接口测试等场景复用。
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult

logger = logging.getLogger(__name__)

# 无请求体的HTTP方法
_METHODS_WITHOUT_BODY = ("GET", "DELETE", "HEAD", "OPTIONS")
# 默认请求超时（秒）
DEFAULT_TIMEOUT = 30


def normalize_headers(raw: Any) -> Dict[str, str]:
    """将多种形态的请求头规整为普通字典。

    支持三种输入形态：
    - JSON字符串
    - 列表形态 [{"key": "X", "value": "Y"}]
    - 字典形态 {"X": "Y"}

    Args:
        raw: 原始请求头，可为字符串、列表或字典

    Returns:
        Dict[str, str]: 规整后的请求头字典
    """
    headers: Dict[str, str] = {}
    if not raw:
        return headers
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return headers
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and item.get("key"):
                headers[item["key"]] = item.get("value", "")
    elif isinstance(raw, dict):
        for k, v in raw.items():
            headers[k] = v
    return headers


def split_params(raw: Any, value_key: str = "value") -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """将参数定义列表拆分为查询参数与路径参数。

    支持列表形态 [{"name": "id", "in": "query"|"path", "value": ...}]，
    也兼容以 ``default`` 作为取值来源的接口配置。

    Args:
        raw: 参数定义，列表或字典
        value_key: 取值字段名，默认为 ``value``

    Returns:
        Tuple[Dict, Dict]: (查询参数, 路径参数)
    """
    query_params: Dict[str, Any] = {}
    path_params: Dict[str, Any] = {}
    if not raw:
        return query_params, path_params
    if isinstance(raw, dict):
        # 直接是 {name: value} 的查询参数字典
        return dict(raw), path_params
    if isinstance(raw, list):
        for p in raw:
            if not isinstance(p, dict) or not p.get("name"):
                continue
            value = p.get(value_key, p.get("default", ""))
            if p.get("in") == "path":
                path_params[p["name"]] = value
            else:
                query_params[p["name"]] = value
    return query_params, path_params


def build_url(server_url: str, path: str, path_params: Optional[Dict[str, Any]] = None) -> str:
    """拼接服务器地址与接口路径，并替换路径参数占位符。

    Args:
        server_url: API服务器基础地址
        path: 接口路径
        path_params: 路径参数键值对

    Returns:
        str: 完整请求地址
    """
    server_url = server_url or ""
    path = path or ""
    if server_url and path and not server_url.endswith("/") and not path.startswith("/"):
        server_url += "/"
    full_url = f"{server_url}{path}"
    for name, value in (path_params or {}).items():
        full_url = full_url.replace("{" + name + "}", str(value))
    return full_url


def send_http_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    body: Any = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Dict[str, Any]:
    """执行真实的HTTP请求并返回结构化响应。

    这是API调用的公共执行方法，API调用工具与接口测试均复用此方法。

    Args:
        method: 请求方法（GET/POST/PUT/PATCH/DELETE等）
        url: 完整请求地址
        headers: 请求头
        params: 查询参数
        body: 请求体（用于POST/PUT/PATCH等）
        timeout: 超时时间（秒）

    Returns:
        Dict[str, Any]: 包含 status_code、headers、body、elapsed 的响应字典
    """
    method = (method or "GET").upper()
    start = time.time()
    if method in _METHODS_WITHOUT_BODY:
        resp = requests.request(method, url, headers=headers, params=params, timeout=timeout)
    else:
        resp = requests.request(method, url, headers=headers, params=params, json=body, timeout=timeout)
    elapsed = resp.elapsed.total_seconds() if resp.elapsed else round(time.time() - start, 3)

    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text

    return {
        "status_code": resp.status_code,
        "headers": dict(resp.headers),
        "body": resp_body,
        "elapsed": elapsed,
    }


@ToolRegistry.register
class api_call(BaseTool):
    """通用API调用工具，封装任意HTTP接口的真实调用。"""

    name = "api_call"
    title = "API调用"
    description = (
        "调用外部HTTP API接口。当需要请求某个API服务器上的接口以获取或提交数据时使用此工具。"
        "支持自定义请求方法、路径、请求头、查询参数、路径参数和请求体，"
        "返回接口的HTTP状态码、响应头、响应体和耗时。"
    )
    params = [
        BaseToolParam(
            name="server_url",
            type="string",
            description="API服务器基础地址，如 https://api.example.com",
            required=True,
        ),
        BaseToolParam(
            name="path",
            type="string",
            description="接口路径，可包含路径参数占位符（如 /users/{id}）",
            required=False,
            default="",
        ),
        BaseToolParam(
            name="method",
            type="string",
            description="HTTP请求方法",
            required=False,
            default="GET",
            enum=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        ),
        BaseToolParam(
            name="headers",
            type="object",
            description="请求头字典，如 {\"Authorization\": \"Bearer xxx\"}",
            required=False,
        ),
        BaseToolParam(
            name="query_params",
            type="object",
            description="查询参数字典，将拼接到URL的query string中",
            required=False,
        ),
        BaseToolParam(
            name="path_params",
            type="object",
            description="路径参数字典，用于替换path中的占位符（如 {id}）",
            required=False,
        ),
        BaseToolParam(
            name="body",
            type="object",
            description="请求体，用于POST/PUT/PATCH等方法，以JSON形式发送",
            required=False,
        ),
        BaseToolParam(
            name="timeout",
            type="integer",
            description="请求超时时间（秒）",
            required=False,
            default=DEFAULT_TIMEOUT,
        ),
    ]

    def _run(self, **kwargs) -> ToolResult:
        server_url = kwargs.get("server_url", "")
        if not server_url:
            return self._error(message="API服务器地址不能为空", error="server_url is required")

        path = kwargs.get("path", "") or ""
        method = (kwargs.get("method", "GET") or "GET").upper()
        headers = normalize_headers(kwargs.get("headers"))
        query_params = kwargs.get("query_params") or {}
        path_params = kwargs.get("path_params") or {}
        body = kwargs.get("body")
        try:
            timeout = int(kwargs.get("timeout", DEFAULT_TIMEOUT))
        except (TypeError, ValueError):
            timeout = DEFAULT_TIMEOUT

        full_url = build_url(server_url, path, path_params)
        logger.info(f"API调用 - method={method}, url={full_url}")

        try:
            response = send_http_request(
                method=method,
                url=full_url,
                headers=headers,
                params=query_params,
                body=body,
                timeout=timeout,
            )
        except requests.ConnectionError as e:
            return self._error(message=f"API调用失败，无法连接服务器: {full_url}", error=str(e), url=full_url)
        except requests.Timeout as e:
            return self._error(message="API调用失败，请求超时", error=str(e), url=full_url)
        except requests.RequestException as e:
            return self._error(message=f"API调用失败: {str(e)}", error=str(e), url=full_url)
        except Exception as e:
            logger.error(f"API调用异常 - url={full_url}, error={e}", exc_info=True)
            return self._error(message=f"API调用失败: {str(e)}", error=str(e), url=full_url)

        status_code = response.get("status_code")
        logger.info(f"API调用完成 - url={full_url}, status_code={status_code}")
        return self._success(
            result=response,
            message=f"API调用完成，状态码 {status_code}",
            url=full_url,
            method=method,
            status_code=status_code,
        )
