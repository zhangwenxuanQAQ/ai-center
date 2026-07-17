"""
机器人插件集成常量定义
"""

# 预设主题色（白色默认选中）
# INTEGRATION_THEME_PRESETS = [
#     {"key": "white", "label": "白色", "color": "#ffffff"},
#     {"key": "dark", "label": "深色", "color": "#1f2937"},
#     {"key": "default_blue", "label": "经典蓝", "color": "#1677ff"},
#     {"key": "emerald", "label": "翡翠绿", "color": "#10b981"},
#     {"key": "violet", "label": "紫罗兰", "color": "#8b5cf6"},
#     {"key": "orange", "label": "活力橙", "color": "#f97316"},
#     {"key": "rose", "label": "玫瑰红", "color": "#f43f5e"},
# ]

# 预设渐变色（none表示不使用渐变色，白色默认选中）
# INTEGRATION_GRADIENT_PRESETS = [
#     {"key": "none", "label": "无", "color": "none"},
#     {"key": "white", "label": "白色", "color": "#ffffff"},
#     {"key": "cyan", "label": "天蓝", "color": "#06b6d4"},
#     {"key": "pink", "label": "粉红", "color": "#ec4899"},
#     {"key": "amber", "label": "琥珀", "color": "#f59e0b"},
#     {"key": "teal", "label": "青绿", "color": "#14b8a6"},
#     {"key": "indigo", "label": "靛青", "color": "#6366f1"},
# ]

# 颜色主题预设
INTEGRATION_COLOR_THEMES = [
    {"key": "default_blue", "label": "经典蓝", "color": "#1677ff"},
    {"key": "emerald", "label": "翡翠绿", "color": "#10b981"},
    {"key": "violet", "label": "紫罗兰", "color": "#8b5cf6"},
    {"key": "orange", "label": "活力橙", "color": "#f97316"},
    {"key": "rose", "label": "玫瑰红", "color": "#f43f5e"},
    {"key": "cyan", "label": "天蓝", "color": "#06b6d4"},
    {"key": "pink", "label": "粉红", "color": "#ec4899"},
    {"key": "amber", "label": "琥珀", "color": "#f59e0b"},
    {"key": "teal", "label": "青绿", "color": "#14b8a6"},
    {"key": "indigo", "label": "靛青", "color": "#6366f1"},
]

# 集成界面配置参数定义
# key与默认配置中的字段名保持一致，前端根据此定义渲染配置控件
INTEGRATION_CONFIG_PARAMS = [
    {
        "key": "interface_config",
        "label": "界面配置",
        "type": "section",
        "children": [
            {
                "key": "common_config",
                "label": "通用配置",
                "type": "section",
                "children": [
                    {
                        "key": "theme_mode",
                        "label": "主题",
                        "type": "select",
                        "default": "light",
                        "description": "聊天界面的显示主题，影响输入框、消息区域、历史对话列表的文字颜色和背景色",
                        "options": [
                            {"label": "白天", "value": "light"},
                            {"label": "夜间", "value": "dark"},
                        ]
                    },
                    {
                        "key": "color_theme",
                        "label": "颜色主题",
                        "type": "select",
                        "default": "default_blue",
                        "description": "聊天界面的配色主题，影响悬浮球、标题栏、按钮和用户消息气泡的颜色",
                        "options": [
                            {"label": "经典蓝", "value": "default_blue"},
                            {"label": "翡翠绿", "value": "emerald"},
                            {"label": "紫罗兰", "value": "violet"},
                            {"label": "活力橙", "value": "orange"},
                            {"label": "玫瑰红", "value": "rose"},
                            {"label": "天蓝", "value": "cyan"},
                            {"label": "粉红", "value": "pink"},
                            {"label": "琥珀", "value": "amber"},
                            {"label": "青绿", "value": "teal"},
                            {"label": "靛青", "value": "indigo"},
                        ]
                    },
                    # {
                    #     "key": "boder_color",
                    #     "label": "边框颜色",
                    #     "type": "theme_select",
                    #     "default": "#ffffff",
                    #     "description": "悬浮球、聊天界面标题头和按钮的边框颜色",
                    #     "options": INTEGRATION_THEME_PRESETS
                    # },
                    # {
                    #     "key": "gradient_end_color",
                    #     "label": "渐变色",
                    #     "type": "color",
                    #     "default": "none",
                    #     "description": "悬浮球渐变的终止颜色，选择「无」表示不使用渐变",
                    #     "presets": INTEGRATION_GRADIENT_PRESETS
                    # },
                    {
                        "key": "user_avatar",
                        "label": "自定义用户头像",
                        "type": "upload",
                        "default": "",
                        "description": "聊天界面中用户自定义头像图片",
                        "avatar_type": "user"
                    },
                    {
                        "key": "bot_avatar",
                        "label": "自定义机器人头像",
                        "type": "upload",
                        "default": "",
                        "description": "聊天界面中机器人自定义头像图片",
                        "avatar_type": "bot"
                    }
                ]
            },
            {
                "key": "sidebar",
                "label": "悬浮球侧边栏",
                "type": "section",
                "children": [
                    {
                        "key": "position",
                        "label": "初始位置",
                        "type": "select",
                        "default": "bottom-right",
                        "description": "悬浮球的初始显示位置",
                        "options": [
                            {"label": "左上角", "value": "top-left"},
                            {"label": "左下角", "value": "bottom-left"},
                            {"label": "右上角", "value": "top-right"},
                            {"label": "右下角", "value": "bottom-right"},
                        ]
                    },
                    {
                        "key": "size",
                        "label": "悬浮球大小",
                        "type": "number",
                        "min": 36,
                        "max": 80,
                        "default": 52,
                        "description": "悬浮球按钮尺寸（像素）"
                    },
                    {
                        "key": "animation",
                        "label": "动画效果",
                        "type": "select",
                        "default": "bounce",
                        "description": "悬浮球动画效果",
                        "options": [
                            {"label": "弹跳", "value": "bounce"},
                            {"label": "淡入", "value": "fade"},
                            {"label": "缩放", "value": "scale"},
                            {"label": "无", "value": "none"},
                        ]
                    },
                    {
                        "key": "title",
                        "label": "聊天框标题",
                        "type": "text",
                        "default": "",
                        "description": "聊天框顶部标题（为空时默认取机器人名称）"
                    },
                    {
                        "key": "width",
                        "label": "聊天框宽度",
                        "type": "number",
                        "min": 300,
                        "max": 800,
                        "default": 400,
                        "description": "聊天框宽度（像素）"
                    },
                    {
                        "key": "height",
                        "label": "聊天框高度",
                        "type": "number",
                        "min": 400,
                        "max": 1000,
                        "default": 600,
                        "description": "聊天框高度（像素）"
                    },
                    {
                        "key": "resizable",
                        "label": "允许缩放聊天面板",
                        "type": "switch",
                        "default": True,
                        "description": "是否允许用户拖拽缩放聊天面板"
                    },
                    {
                        "key": "maximizable",
                        "label": "允许最大化聊天面板",
                        "type": "switch",
                        "default": True,
                        "description": "是否允许用户将聊天面板最大化"
                    }
                ]
            },
            {
                "key": "iframe",
                "label": "iframe嵌入",
                "type": "section",
                "children": [
                    {
                        "key": "width",
                        "label": "宽度",
                        "type": "text",
                        "default": "100%",
                        "description": "iframe宽度（像素或百分比）"
                    },
                    {
                        "key": "height",
                        "label": "高度",
                        "type": "text",
                        "default": "100%",
                        "description": "iframe高度（像素或百分比）"
                    }
                ]
            }
        ]
    },
    {
        "key": "chat_config",
        "label": "聊天配置",
        "type": "section",
        "children": [
            {
                "key": "input_placeholder",
                "label": "输入框占位符",
                "type": "text",
                "default": "请输入您的问题...",
                "description": "聊天输入框的占位提示文本"
            },
            {
                "key": "max_input_length",
                "label": "输入框最大字符数",
                "type": "number",
                "min": 100,
                "max": 50000,
                "default": 4000,
                "description": "聊天输入框允许输入的最大字符数"
            },
            {
                "key": "welcome_messages",
                "label": "欢迎语",
                "type": "tag_list",
                "default": [],
                "description": "聊天框初始显示的欢迎语列表（为空时默认取机器人欢迎语）"
            }
        ]
    }
]


def _build_curl_chat_example(base_url: str = "{base_url}", api_key: str = "{api_key}") -> str:
    """生成聊天接口的curl示例"""
    return (
        f'curl -X POST "{base_url}/aicenter/api/v1/chat/completions" \\\n'
        f'  -H "Content-Type: application/json" \\\n'
        f'  -H "Authorization: Bearer {api_key}" \\\n'
        f'  -d \'{{\n'
        f'    "query": [\n'
        f'      {{\n'
        f'        "type": "text",\n'
        f'        "content": "你好"\n'
        f'      }}\n'
        f'    ],\n'
        f'    "stream": true\n'
        f'  }}\''
    )


def _build_python_chat_example(base_url: str = "{base_url}", api_key: str = "{api_key}") -> str:
    """生成聊天接口的Python示例"""
    return (
        f'import requests\n\n'
        f'url = "{base_url}/aicenter/api/v1/chat/completions"\n'
        f'headers = {{\n'
        f'    "Content-Type": "application/json",\n'
        f'    "Authorization": "Bearer {api_key}"\n'
        f'}}\n'
        f'data = {{\n'
        f'    "query": [\n'
        f'        {{"type": "text", "content": "你好"}}\n'
        f'    ],\n'
        f'    "stream": True\n'
        f'}}\n\n'
        f'response = requests.post(url, json=data, headers=headers, stream=True)\n'
        f'for line in response.iter_lines():\n'
        f'    if line:\n'
        f'        print(line.decode("utf-8"))'
    )


def _build_curl_messages_example(base_url: str = "{base_url}", api_key: str = "{api_key}") -> str:
    """生成获取聊天记录接口的curl示例"""
    return (
        f'curl -X GET "{base_url}/aicenter/api/v1/chat/{{chat_id}}/messages" \\\n'
        f'  -H "Authorization: Bearer {api_key}"'
    )


def _build_python_messages_example(base_url: str = "{base_url}", api_key: str = "{api_key}") -> str:
    """生成获取聊天记录接口的Python示例"""
    return (
        f'import requests\n\n'
        f'url = "{base_url}/aicenter/api/v1/chat/{{chat_id}}/messages"\n'
        f'headers = {{\n'
        f'    "Authorization": "Bearer {api_key}"\n'
        f'}}\n\n'
        f'response = requests.get(url, headers=headers)\n'
        f'print(response.json())'
    )


def get_integration_default_configs(base_url: str = "", api_key: str = "") -> dict:
    """
    获取集成配置默认值
    
    Args:
        base_url: 后端服务地址
        api_key: API密钥
        
    Returns:
        dict: 集成配置默认值
    """
    return {
        "api_config": {
            "chat": {
                "request_example": {
                    "curl": _build_curl_chat_example(base_url, api_key),
                    "python": _build_python_chat_example(base_url, api_key)
                },
                "stream_response_example": (
                    'data: {"chat_id": "xxx", "message_id": "xxx", "step_id": "xxx", "role": "assistant", "content": "\u4f60\u597d\uff01", "status": "streaming"}\n'
                    'data: {"chat_id": "xxx", "message_id": "xxx", "step_id": "xxx", "role": "assistant", "content": "\u4f60\u597d\uff01\u6709\u4ec0\u4e48\u53ef\u4ee5\u5e2e\u4f60\u7684\u5417\uff1f", "status": "done"}\n'
                    'data: [DONE]'
                ),
                "non_stream_response_example": (
                    '{\n'
                    '  "code": 200,\n'
                    '  "message": "\u64cd\u4f5c\u6210\u529f",\n'
                    '  "data": {\n'
                    '    "chat_id": "xxx",\n'
                    '    "message_id": "xxx",\n'
                    '    "content": "\u4f60\u597d\uff01\u6709\u4ec0\u4e48\u53ef\u4ee5\u5e2e\u4f60\u7684\u5417\uff1f"\n'
                    '  }\n'
                    '}'
                )
            },
            "get_messages": {
                "request_example": {
                    "curl": _build_curl_messages_example(base_url, api_key),
                    "python": _build_python_messages_example(base_url, api_key)
                },
                "response_example": (
                    '{\n'
                    '  "code": 200,\n'
                    '  "message": "操作成功",\n'
                    '  "data": {\n'
                    '    "items": [\n'
                    '      {\n'
                    '        "id": "xxx",\n'
                    '        "chat_id": "xxx",\n'
                    '        "message_id": "xxx",\n'
                    '        "role": "user",\n'
                    '        "content": "你好",\n'
                    '        "created_at": "2024-01-01 00:00:00"\n'
                    '      },\n'
                    '      {\n'
                    '        "id": "xxx",\n'
                    '        "chat_id": "xxx",\n'
                    '        "message_id": "xxx",\n'
                    '        "role": "assistant",\n'
                    '        "content": "你好！有什么可以帮你的吗？",\n'
                    '        "created_at": "2024-01-01 00:00:01"\n'
                    '      }\n'
                    '    ],\n'
                    '    "total": 2\n'
                    '  }\n'
                    '}'
                )
            }
        },
        "interface_config": {
            "common_config": {
                "theme_mode": "light",
                "color_theme": "default_blue",
                "user_avatar": "",
                "bot_avatar": ""
            },
            "sidebar": {
                "position": "bottom-right",
                "size": 52,
                "animation": "bounce",
                "title": "",
                "width": 400,
                "height": 600,
                "resizable": True,
                "maximizable": True,
            },
            "iframe": {
                "width": "100%",
                "height": "100%"
            }
        },
        "chat_config": {
            "input_placeholder": "请输入您的问题...",
            "max_input_length": 4000,
            "welcome_messages": []
        },
        "html_code": {
            "sidebar": (
                '<!-- AI助手悬浮球侧边栏 -->\n'
                '<script>\n'
                '  (function() {{\n'
                '    var config = {{\n'
                '      apiKey: "{api_key}",\n'
                '      baseUrl: "{base_url}",\n'
                '      colorTheme: "{color_theme}",\n'
                '      themeMode: "{theme_mode}",\n'
                '      position: "{position}",\n'
                '      title: "{title}",\n'
                '      width: {width},\n'
                '      height: {height},\n'
                '      resizable: {resizable},\n'
                '      maximizable: {maximizable}\n'
                '    }};\n'
                '    var THEME_COLORS = {{"default_blue":"#1677ff","emerald":"#10b981","violet":"#8b5cf6","orange":"#f97316","rose":"#f43f5e","cyan":"#06b6d4","pink":"#ec4899","amber":"#f59e0b","teal":"#14b8a6","indigo":"#6366f1"}};\n'
                '    var themeColor = THEME_COLORS[config.colorTheme] || "#1677ff";\n'
                '    var ball = document.createElement("div");\n'
                '    ball.id = "ai-widget-ball";\n'
                '    ball.innerHTML = "\U0001f4ac";\n'
                '    ball.style.cssText = "position:fixed;width:52px;height:52px;border-radius:50%;background:"+themeColor+";color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:grab;box-shadow:0 6px 24px rgba(0,0,0,0.12);z-index:99999;user-select:none;touch-action:none;";\n'
                '    var pos = {{"bottom-right":"bottom:48px;right:48px","bottom-left":"bottom:48px;left:48px","top-right":"top:48px;right:48px","top-left":"top:48px;left:48px"}};\n'
                '    ball.style.cssText += (pos[config.position]||pos["bottom-right"]);\n'
                '    var panel = document.createElement("iframe");\n'
                '    var params = "api_key="+encodeURIComponent(config.apiKey)+"&color_theme="+config.colorTheme+"&theme_mode="+config.themeMode+"&title="+encodeURIComponent(config.title);\n'
                '    panel.src = config.baseUrl+"/integration/chat?"+params;\n'
                '    panel.style.cssText = "position:fixed;width:"+config.width+"px;height:"+config.height+"px;border:none;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.15);z-index:99998;display:none;";\n'
                '    panel.style.cssText += (pos[config.position]||pos["bottom-right"]).replace(/bottom:\s*48px/,"bottom:112px").replace(/top:\s*48px/,"top:112px");\n'
                '    var isOpen=false,hasMoved=false,dragStart=null;\n'
                '    ball.addEventListener("mousedown",function(e){{hasMoved=false;var r=ball.getBoundingClientRect();dragStart={{x:e.clientX,y:e.clientY,bx:r.left,by:r.top}};}});\n'
                '    document.addEventListener("mousemove",function(e){{if(!dragStart)return;var dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.abs(dx)>3||Math.abs(dy)>3)hasMoved=true;ball.style.top=Math.max(0,Math.min(window.innerHeight-52,dragStart.by+dy))+"px";ball.style.left=Math.max(0,Math.min(window.innerWidth-52,dragStart.bx+dx))+"px";ball.style.bottom="auto";ball.style.right="auto";ball.style.cursor="grabbing";}});\n'
                '    document.addEventListener("mouseup",function(){{if(!dragStart)return;dragStart=null;ball.style.cursor="grab";if(hasMoved)return;isOpen=!isOpen;panel.style.display=isOpen?"block":"none";ball.innerHTML=isOpen?"\u2715":"\U0001f4ac";}});\n'
                '    ball.addEventListener("touchstart",function(e){{var t=e.touches[0];hasMoved=false;var r=ball.getBoundingClientRect();dragStart={{x:t.clientX,y:t.clientY,bx:r.left,by:r.top}};}});\n'
                '    document.addEventListener("touchmove",function(e){{if(!dragStart)return;var t=e.touches[0],dx=t.clientX-dragStart.x,dy=t.clientY-dragStart.y;if(Math.abs(dx)>3||Math.abs(dy)>3){{hasMoved=true;e.preventDefault();}}ball.style.top=Math.max(0,Math.min(window.innerHeight-52,dragStart.by+dy))+"px";ball.style.left=Math.max(0,Math.min(window.innerWidth-52,dragStart.bx+dx))+"px";ball.style.bottom="auto";ball.style.right="auto";}},{{passive:false}});\n'
                '    document.addEventListener("touchend",function(){{if(!dragStart)return;dragStart=null;if(!hasMoved){{isOpen=!isOpen;panel.style.display=isOpen?"block":"none";ball.innerHTML=isOpen?"\u2715":"\U0001f4ac";}}}});\n'
                '    document.body.appendChild(panel);\n'
                '    document.body.appendChild(ball);\n'
                '  }})();\n'
                '</script>'
            ),
            "iframe": (
                '<!-- AI助手iframe嵌入 -->\n'
                '<iframe\n'
                '  src="{base_url}/integration/chat?api_key={api_key}&color_theme={color_theme}&theme_mode={theme_mode}&title={title_encoded}"\n'
                '  style="width: {iframe_width}; height: {iframe_height}; border: 1px solid #e8e8e8; border-radius: 8px;"\n'
                '  allow="microphone"\n'
                '></iframe>'
            )
        }
    }


# 集成类型
INTEGRATION_TYPE_SIDEBAR = "sidebar"
INTEGRATION_TYPE_IFRAME = "iframe"
