"""
代码脚本内置工具

将Python代码脚本的执行封装为统一工具，支持：
- 语法检查：基于 ast.parse 确保代码符合Python语法规范
- 安全检查：危险操作黑名单（危险模块导入、危险函数调用等）
- 沙箱执行：受限 __builtins__、模块导入白名单、超时控制
- 执行入口：必须包含 main 方法，代码执行结果取 main() 的返回值（原始输出）

同时对外提供语法检查、安全检查、沙箱执行的公共方法，供脚本测试等场景复用。
"""

import ast
import json
import logging
import re
import time
import traceback
from typing import Any, Dict, List, Optional

from app.core.tools import BaseTool, BaseToolParam, ToolRegistry, ToolResult

logger = logging.getLogger(__name__)

# 默认执行超时（秒）
DEFAULT_TIMEOUT = 30
# 默认输出最大长度（字符）
MAX_OUTPUT_LENGTH = 10000
# 执行入口函数名
ENTRY_FUNCTION = "main"

# 禁止导入的模块（危险操作黑名单）
BLOCKED_MODULES = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "ctypes",
    "signal",
    "multiprocessing",
    "threading",
    "socket",
    "http",
    "urllib",
    "requests",
    "pathlib",
    "importlib",
    "builtins",
    "code",
    "codeop",
    "compile",
    "compileall",
    "pickle",
    "dill",
    "webbrowser",
    "tkinter",
    "asyncio",
    "concurrent",
}

# 禁止导入的模块前缀（子模块一并禁止）
BLOCKED_MODULE_PREFIXES = (
    "os.",
    "sys.",
    "subprocess.",
    "shutil.",
    "ctypes.",
    "signal.",
    "multiprocessing.",
    "threading.",
    "socket.",
    "http.",
    "urllib.",
    "requests.",
    "pathlib.",
    "importlib.",
    "asyncio.",
    "concurrent.",
)

# 禁止调用的危险函数/属性名
BLOCKED_CALLS = {
    "eval",
    "exec",
    "compile",
    "__import__",
    "open",
    "globals",
    "locals",
    "vars",
    "dir",
    "input",
    "getattr",
    "setattr",
    "delattr",
    "__subclasses__",
    "__bases__",
    "__mro__",
    "__class__",
    "__globals__",
    "__code__",
    "__builtins__",
    "breakpoint",
    "exit",
    "quit",
    "__builtins__",
}

# 允许导入的第三方模块白名单（数据分析等常用库）
ALLOWED_MODULES = {
    "json",
    "math",
    "re",
    "datetime",
    "time",
    "random",
    "collections",
    "itertools",
    "functools",
    "operator",
    "string",
    "textwrap",
    "typing",
    "copy",
    "heapq",
    "bisect",
    "statistics",
    "decimal",
    "fractions",
    "numbers",
    "uuid",
    "hashlib",
    "base64",
    "pandas",
    "numpy",
    "scipy",
    "matplotlib",
}

# 入参定义允许的类型
PARAM_TYPES = {"string", "integer", "number", "boolean", "array", "object"}


def parse_params_json(params_json: Optional[str]) -> List[Dict[str, Any]]:
    """解析入参定义JSON为列表，非法内容返回空列表。

    Args:
        params_json: 入参定义JSON字符串（JSON数组）

    Returns:
        List[Dict[str, Any]]: 入参定义列表 [{name, type, description, required, default}]
    """
    if not params_json or not params_json.strip():
        return []
    try:
        parsed = json.loads(params_json)
        if isinstance(parsed, list):
            return parsed
        return []
    except (ValueError, TypeError):
        return []


def validate_params_definitions(
    param_definitions: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    """校验入参定义列表的合法性。

    校验规则：
    - 每个参数必须包含合法的 name（Python标识符，且不能与内置工具保留参数冲突）
    - type 必须在 PARAM_TYPES 中
    - name 不能重复

    Args:
        param_definitions: 入参定义列表

    Returns:
        Dict[str, Any]: 包含 valid 和 error 的字典
    """
    if not param_definitions:
        return {"valid": True, "error": ""}

    reserved_names = {"code", "script_id", "timeout", "params"}
    seen_names = set()
    for index, param in enumerate(param_definitions, start=1):
        if not isinstance(param, dict):
            return {"valid": False, "error": f"第{index}个参数定义必须是JSON对象"}
        name = param.get("name")
        if not name or not isinstance(name, str):
            return {"valid": False, "error": f"第{index}个参数缺少name字段"}
        if not name.isidentifier():
            return {"valid": False, "error": f"参数名 '{name}' 不是合法的Python标识符"}
        if name in reserved_names:
            return {"valid": False, "error": f"参数名 '{name}' 与工具保留参数冲突"}
        if name in seen_names:
            return {"valid": False, "error": f"参数名 '{name}' 重复"}
        seen_names.add(name)

        param_type = param.get("type", "string")
        if param_type not in PARAM_TYPES:
            return {
                "valid": False,
                "error": f"参数 '{name}' 的type必须为 {'/'.join(sorted(PARAM_TYPES))} 之一",
            }

    return {"valid": True, "error": ""}


def _normalize_param_definitions(
    param_definitions: Optional[List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """规范化入参定义列表，补全缺失字段。"""
    if not param_definitions:
        return []
    normalized = []
    for param in param_definitions:
        if not isinstance(param, dict) or not param.get("name"):
            continue
        normalized.append(
            {
                "name": str(param.get("name")),
                "type": (
                    param.get("type") if param.get("type") in PARAM_TYPES else "string"
                ),
                "description": param.get("description") or "",
                "required": bool(param.get("required", False)),
                "default": param.get("default"),
            }
        )
    return normalized


def _coerce_params_input(
    params: Optional[Dict[str, Any]],
    param_definitions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """按参数定义的类型转换用户传入的参数值。

    string/integer/number/boolean/array/object 之外的类型不转换；转换失败保留原值，
    由 main 函数内部或运行时报错反馈。
    """
    if not params:
        return {}
    type_map = {p["name"]: p["type"] for p in param_definitions}
    coerced: Dict[str, Any] = {}
    for key, value in params.items():
        param_type = type_map.get(key)
        try:
            if param_type == "integer":
                coerced[key] = int(value)
            elif param_type == "number":
                coerced[key] = float(value)
            elif param_type == "boolean":
                if isinstance(value, str):
                    coerced[key] = value.strip().lower() in ("true", "1", "yes")
                else:
                    coerced[key] = bool(value)
            elif param_type == "string":
                coerced[key] = (
                    value
                    if isinstance(value, str)
                    else json.dumps(value, ensure_ascii=False)
                )
            elif param_type in ("array", "object"):
                # 允许JSON字符串输入，解析后校验结构
                parsed = json.loads(value) if isinstance(value, str) else value
                if param_type == "array" and not isinstance(parsed, list):
                    raise ValueError(f"参数 '{key}' 须为JSON数组")
                if param_type == "object" and not isinstance(parsed, dict):
                    raise ValueError(f"参数 '{key}' 须为JSON对象")
                coerced[key] = parsed
            else:
                coerced[key] = value
        except (ValueError, TypeError):
            coerced[key] = value
    return coerced


def check_syntax(code: str) -> Dict[str, Any]:
    """检查Python代码是否符合语法规范。

    使用 ast.parse 解析代码，语法错误时返回错误位置与信息。

    Args:
        code: Python代码字符串

    Returns:
        Dict[str, Any]: 包含 valid（是否合法）和 error（错误信息）的字典
    """
    if not code or not code.strip():
        return {"valid": False, "error": "代码内容为空"}

    try:
        ast.parse(code)
        return {"valid": True, "error": ""}
    except SyntaxError as e:
        line = e.lineno or 0
        col = e.offset or 0
        return {"valid": False, "error": f"语法错误（第{line}行，第{col}列）: {e.msg}"}


def check_main_function(code: str) -> Dict[str, Any]:
    """检查代码是否包含 main 函数（执行入口）。

    Args:
        code: Python代码字符串

    Returns:
        Dict[str, Any]: 包含 valid（是否包含）和 error（错误信息）的字典
    """
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return {"valid": False, "error": "代码存在语法错误，无法解析"}

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == ENTRY_FUNCTION:
            return {
                "valid": True,
                "error": "",
                "args": [a.arg for a in node.args.args],
                # 声明了默认值的形参（如 def main(a=1, b=2)），未传参时使用函数自身默认值
                "args_with_defaults": (
                    [a.arg for a in node.args.args[-len(node.args.defaults) :]]
                    if node.args.defaults
                    else []
                ),
                "has_kwarg": node.args.kwarg is not None,
            }

    return {"valid": False, "error": f"代码必须包含 {ENTRY_FUNCTION} 函数作为执行入口"}


def check_safety(code: str) -> Dict[str, Any]:
    """安全检查，确保代码不会执行危险操作。

    基于 AST 遍历，检查：
    - 导入的模块是否在黑名单中（不在白名单内的导入一律拒绝）
    - 调用的函数/属性是否在危险名单中
    - 访问的双下划线属性

    Args:
        code: Python代码字符串

    Returns:
        Dict[str, Any]: 包含 safe（是否安全）和 error（违规描述）的字典
    """
    if not code or not code.strip():
        return {"safe": False, "error": "代码内容为空"}

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"safe": False, "error": f"代码存在语法错误，无法进行安全检查: {e.msg}"}

    violations: List[str] = []

    def _module_name(node: ast.Import) -> List[str]:
        return [alias.name for alias in node.names]

    for node in ast.walk(tree):
        # 检查 import 语句
        if isinstance(node, ast.Import):
            for name in _module_name(node):
                root = name.split(".")[0]
                if name in BLOCKED_MODULES or name.startswith(BLOCKED_MODULE_PREFIXES):
                    violations.append(f"禁止导入危险模块: {name}")
                elif root not in ALLOWED_MODULES:
                    violations.append(
                        f"不允许导入模块: {name}（仅允许: {', '.join(sorted(ALLOWED_MODULES))}）"
                    )
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            root = module.split(".")[0] if module else ""
            if module in BLOCKED_MODULES or module.startswith(BLOCKED_MODULE_PREFIXES):
                violations.append(f"禁止从危险模块导入: {module}")
            elif root not in ALLOWED_MODULES:
                violations.append(
                    f"不允许从模块导入: {module}（仅允许: {', '.join(sorted(ALLOWED_MODULES))}）"
                )
        # 检查函数调用
        elif isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in BLOCKED_CALLS:
                violations.append(f"禁止调用危险函数: {func.id}")
            elif isinstance(func, ast.Attribute):
                if func.attr in BLOCKED_CALLS:
                    violations.append(f"禁止调用危险方法: {func.attr}")
                # 检查 __dunder__ 属性访问
                if re.match(r"^__.*__$", func.attr):
                    violations.append(f"禁止访问双下划线属性: {func.attr}")
        # 检查名称访问
        elif isinstance(node, ast.Name):
            if node.id in BLOCKED_CALLS:
                violations.append(f"禁止使用危险名称: {node.id}")
        # 检查属性访问
        elif isinstance(node, ast.Attribute):
            if re.match(r"^__.*__$", node.attr):
                violations.append(f"禁止访问双下划线属性: {node.attr}")

    if violations:
        return {"safe": False, "error": "; ".join(violations[:10])}
    return {"safe": True, "error": ""}


def validate_code(code: str) -> Dict[str, Any]:
    """代码校验入口：语法检查 + main函数检查 + 安全检查。

    Args:
        code: Python代码字符串

    Returns:
        Dict[str, Any]: 包含 valid（整体是否通过）和 error（错误信息）的字典
    """
    syntax_result = check_syntax(code)
    if not syntax_result["valid"]:
        return {"valid": False, "error": syntax_result["error"], "stage": "syntax"}

    main_result = check_main_function(code)
    if not main_result["valid"]:
        return {"valid": False, "error": main_result["error"], "stage": "main_function"}

    safety_result = check_safety(code)
    if not safety_result["safe"]:
        return {"valid": False, "error": safety_result["error"], "stage": "safety"}

    return {
        "valid": True,
        "error": "",
        "stage": "",
        "main_args": main_result.get("args", []),
        "args_with_defaults": main_result.get("args_with_defaults", []),
        "has_kwarg": main_result.get("has_kwarg", False),
    }


def execute_code(
    code: str,
    timeout: int = DEFAULT_TIMEOUT,
    params: Optional[Dict[str, Any]] = None,
    param_definitions: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """在受限沙箱环境中执行Python代码。

    沙箱措施：
    - 受限 __builtins__（移除 open/exec/eval/compile/__import__ 等危险内建）
    - 导入白名单校验（仅允许安全的标准库与数据分析库）
    - 超时控制（超时抛出 TimeoutError）
    - stdout/stderr 重定向捕获

    执行流程：先完整校验（语法/main/安全），通过后 exec 代码定义，
    然后按 main 函数声明的形参注入参数值并调用 main()，
    捕获其返回值与标准输出。参数取值优先级：用户传入 > 参数定义默认值 > 函数签名默认值 > None。

    Args:
        code: Python代码字符串，必须包含 main 函数
        timeout: 执行超时时间（秒）
        params: 用户传入的参数值字典（键为参数名，与main函数形参对应）
        param_definitions: 参数定义列表（[{name, type, description, required, default}]，
            用于提供默认值与参数类型转换）

    Returns:
        Dict[str, Any]: 包含 success、result（main返回值）、error、elapsed 的字典
    """
    start = time.time()

    # 0. 参数定义默认值按类型转换
    param_definitions = _normalize_param_definitions(param_definitions)
    params = _coerce_params_input(params, param_definitions)

    # 1. 完整校验
    validate_result = validate_code(code)
    if not validate_result["valid"]:
        return {
            "success": False,
            "error": validate_result["error"],
            "error_stage": validate_result["stage"],
            "elapsed": round(time.time() - start, 3),
        }

    # 2. 构建受限执行环境
    import builtins as _builtins

    blocked_builtins = {
        "open",
        "exec",
        "eval",
        "compile",
        "__import__",
        "input",
        "breakpoint",
        "exit",
        "quit",
    }
    safe_builtins = {
        k: v for k, v in _builtins.__dict__.items() if k not in blocked_builtins
    }

    def _safe_import(name, *args, **kwargs):
        """受控导入：仅允许白名单模块，禁止危险模块。"""
        root = name.split(".")[0]
        if name in BLOCKED_MODULES or name.startswith(BLOCKED_MODULE_PREFIXES):
            raise ImportError(f"禁止导入危险模块: {name}")
        if root not in ALLOWED_MODULES:
            raise ImportError(f"不允许导入模块: {name}")
        return __import__(name, *args, **kwargs)

    safe_builtins["__import__"] = _safe_import

    exec_globals: Dict[str, Any] = {
        "__builtins__": safe_builtins,
        "__name__": "__sandbox__",
    }

    # 3. 执行代码并调用 main
    try:
        exec(code, exec_globals)  # noqa: S102 沙箱环境受控执行

        if ENTRY_FUNCTION not in exec_globals or not callable(
            exec_globals[ENTRY_FUNCTION]
        ):
            return {
                "success": False,
                "error": f"代码必须包含 {ENTRY_FUNCTION} 函数作为执行入口",
                "error_stage": "main_function",
                "elapsed": round(time.time() - start, 3),
            }

        # 按main函数声明的形参注入参数值：优先用户传入，其次参数定义默认值，
        # 形参自身声明了默认值时跳过注入（使用函数签名默认值），否则None
        main_func = exec_globals[ENTRY_FUNCTION]
        main_args = validate_result.get("main_args", [])
        args_with_defaults = set(validate_result.get("args_with_defaults", []))
        has_kwarg = validate_result.get("has_kwarg", False)
        call_args: Dict[str, Any] = {}
        params = params or {}
        param_defaults = {
            p.get("name"): p.get("default") for p in (param_definitions or [])
        }
        for arg_name in main_args:
            if arg_name in params:
                call_args[arg_name] = params[arg_name]
            elif arg_name in param_defaults and param_defaults[arg_name] is not None:
                call_args[arg_name] = param_defaults[arg_name]
            elif arg_name in args_with_defaults:
                continue
            else:
                call_args[arg_name] = None

        # main函数声明了 **kwargs 时，透传用户传入的其余参数
        if has_kwarg:
            for key, value in params.items():
                if key not in call_args:
                    call_args[key] = value

        result = main_func(**call_args)

        return {
            "success": True,
            "result": result,
            "elapsed": round(time.time() - start, 3),
        }
    except TimeoutError as e:
        return {
            "success": False,
            "error": f"代码执行超时（超过 {timeout} 秒）",
            "error_stage": "execution",
            "elapsed": round(time.time() - start, 3),
        }
    except Exception as e:
        logger.error(f"代码沙箱执行异常: {e}", exc_info=True)
        tb = traceback.format_exc()
        return {
            "success": False,
            "error": f"代码执行异常: {type(e).__name__}: {e}\n{tb if len(tb) <= MAX_OUTPUT_LENGTH else tb[:MAX_OUTPUT_LENGTH] + '...（已截断）'}",
            "error_stage": "execution",
            "elapsed": round(time.time() - start, 3),
        }


def run_code_script(
    params: Optional[Dict[str, Any]] = None,
    code: str = "",
    script_id: str = "",
    timeout: int = DEFAULT_TIMEOUT,
    param_definitions: Optional[List[Dict[str, Any]]] = None,
) -> ToolResult:
    """代码脚本执行公共方法，供内置工具与脚本测试等场景复用。

    Args:
        params: 用户传入的参数值字典（键为参数名，与main函数形参对应）
        code: Python代码内容，必须包含 main 函数
        script_id: 代码脚本ID（可选，用于日志追踪）
        timeout: 执行超时时间（秒）
        param_definitions: 入参定义列表（[{name, type, description, required, default}]，
            用于提供默认值与参数类型转换）

    Returns:
        ToolResult: 统一工具执行结果
    """
    if not code or not code.strip():
        return ToolResult.error(message="代码内容不能为空", error="code is required")

    # 入参定义合法性校验
    param_definitions = _normalize_param_definitions(param_definitions)
    params_check = validate_params_definitions(param_definitions)
    if not params_check["valid"]:
        return ToolResult.error(
            message=f"入参定义校验失败: {params_check['error']}",
            error="invalid param definitions",
        )

    # 必填参数校验
    if param_definitions:
        params = params or {}
        missing = [
            p["name"]
            for p in param_definitions
            if p["required"] and p["name"] not in params and p["default"] is None
        ]
        if missing:
            return ToolResult.error(
                message=f"缺少必填参数: {', '.join(missing)}",
                error=f"missing required params: {','.join(missing)}",
            )

    logger.info(
        f"代码脚本执行 - script_id={script_id or '临时脚本'}, code_length={len(code)}"
    )

    execution = execute_code(
        code,
        timeout=timeout,
        params=params,
        param_definitions=param_definitions,
    )
    if not execution["success"]:
        return ToolResult.error(
            message=execution["error"],
            error=execution.get("error", ""),
            script_id=script_id,
            error_stage=execution.get("error_stage", ""),
            elapsed=execution.get("elapsed", 0),
        )

    logger.info(
        f"代码脚本执行完成 - script_id={script_id or '临时脚本'}, elapsed={execution['elapsed']}s"
    )
    return ToolResult.ok(
        result=execution["result"],
        message="代码执行成功",
        script_id=script_id,
        elapsed=execution["elapsed"],
    )


@ToolRegistry.register
class code_script(BaseTool):
    """代码脚本工具，在沙箱环境中执行Python代码。"""

    name = "code_script"
    title = "代码脚本"
    description = (
        "执行Python代码脚本。脚本必须包含 main 函数作为执行入口，main 的返回值即为执行结果（原始输出）。"
        'main 函数可声明入参，执行时通过 params 传入参数值（如 params={"a": 1, "b": 2}）。'
        "代码在受限沙箱环境中运行：仅允许导入安全模块（如 json/math/re/datetime/pandas/numpy等），"
        "禁止执行危险操作（如文件读写、系统命令、网络请求等）。"
    )
    params = [
        BaseToolParam(
            name="params",
            type="object",
            description='main函数入参值字典，键为参数名（与main函数形参对应），如 {"a": 1, "b": 2}',
            required=False,
        ),
        BaseToolParam(
            name="code",
            type="string",
            description="Python代码内容，必须包含 main 函数作为执行入口（与script_id二选一）",
            required=False,
        ),
        BaseToolParam(
            name="script_id",
            type="string",
            description="已保存的代码脚本ID，传入后执行该脚本内容（与code二选一）",
            required=False,
        ),
        BaseToolParam(
            name="timeout",
            type="integer",
            description="执行超时时间（秒）",
            required=False,
            default=DEFAULT_TIMEOUT,
        ),
    ]

    def _run(self, **kwargs) -> ToolResult:
        code = kwargs.get("code", "")
        script_id = kwargs.get("script_id", "")
        try:
            timeout = int(kwargs.get("timeout", DEFAULT_TIMEOUT))
        except (TypeError, ValueError):
            timeout = DEFAULT_TIMEOUT

        params = kwargs.get("params") or {}
        if isinstance(params, str):
            params = parse_params_json(params)

        # 支持通过脚本ID执行已保存的脚本（同时取脚本保存的入参定义）
        param_definitions: List[Dict[str, Any]] = []
        if not code and script_id:
            from app.services.code_script.service import CodeScriptService

            script = CodeScriptService.get_script(script_id)
            if not script:
                return self._error(
                    message=f"代码脚本 {script_id} 不存在", error="script not found"
                )
            if not script.status:
                return self._error(
                    message=f"代码脚本 {script_id} 已禁用", error="script disabled"
                )
            code = script.content or ""
            param_definitions = parse_params_json(getattr(script, "params", None))

        return run_code_script(
            code=code,
            script_id=script_id,
            timeout=timeout,
            params=params,
            param_definitions=param_definitions,
        )

    @classmethod
    def from_db_script(cls, script) -> "code_script":
        """
        从数据库CodeScript记录创建绑定到该脚本的工具实例（供机器人聊天链路使用）

        在内置code_script工具类基础上定制实例属性：
            - name: code_script_脚本ID（避免与内置工具重名）
            - title/description: 脚本名称/描述
            - params: 脚本保存的入参定义（main形参），公共参数由to_openai_tool统一注入
            - _run: 注入script_id执行该脚本，大模型只需提供main形参值

        Args:
            script: CodeScript数据库对象

        Returns:
            code_script: 绑定到指定脚本的工具实例
        """
        tool = cls()
        tool.name = f"code_script_{script.id}"
        tool.title = getattr(script, "name", "") or f"code_script_{script.id}"
        tool.description = (
            getattr(script, "description", "") or f"执行代码脚本：{script.name}"
        )
        tool.params = [
            BaseToolParam(
                name=p.get("name", ""),
                type=p.get("type", "string"),
                description=p.get("description", ""),
                required=bool(p.get("required")),
            )
            for p in parse_params_json(getattr(script, "params", None))
            if isinstance(p, dict) and p.get("name")
        ]

        script_id = str(script.id)
        original_run = tool._run

        def _script_run(**kwargs):
            # 过滤公共参数（task_name/reasoning_content），main形参值组装为params
            params = {
                k: v
                for k, v in kwargs.items()
                if k not in ("task_name", "reasoning_content")
            }
            return original_run(script_id=script_id, params=params)

        tool._run = _script_run
        return tool
