# 错误码
ERROR_CODES = {
    0: "成功",
    1001: "参数错误",
    1002: "用户不存在",
    1003: "密码错误",
    1004: "权限不足",
    1005: "资源不存在",
    1006: "数据库错误",
    1007: "服务器错误"
}

# 状态码
STATUS_CODES = {
    "SUCCESS": 0,
    "PARAMETER_ERROR": 1001,
    "USER_NOT_FOUND": 1002,
    "PASSWORD_ERROR": 1003,
    "PERMISSION_DENIED": 1004,
    "RESOURCE_NOT_FOUND": 1005,
    "DATABASE_ERROR": 1006,
    "SERVER_ERROR": 1007
}

# 限流配置
RATE_LIMITS = {
    "per_minute": 60,  # 每分钟限制60次请求
    "per_hour": 1000  # 每小时限制1000次请求
}