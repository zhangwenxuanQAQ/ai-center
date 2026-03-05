# 机器人来源
SOURCE_TYPE = {
    "work_weixin": "企业微信",
    "local": "本地"
}

# 配置参数字段
SOURCE_CONFIG_FIELDS = {
    "local": [],
    "work_weixin": [
        {"title": "回调地址", "name": "callback_url", "type": "string", "description": "企业微信机器人回调地址"}
    ],
}