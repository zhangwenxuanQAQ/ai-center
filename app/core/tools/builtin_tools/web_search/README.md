# web_search - 网络搜索内置工具

基于 [SearXNG](https://docs.searxng.org/) 搜索引擎的网络搜索工具，用于在大模型对话中搜索互联网信息。

## 功能说明

- 调用 SearXNG 搜索引擎 API 执行网络搜索
- 使用 BeautifulSoup 抓取搜索结果网页的实际内容
- 返回包含标题、URL、摘要和网页内容的结构化结果
- 支持指定搜索引擎、最大结果数等参数

## 工具参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | 是 | - | 搜索查询字符串 |
| format | string | 否 | json | 返回格式（目前仅支持 json） |
| max_results | integer | 否 | 10 | 返回的最大结果数 |
| engines | string | 否 | "" | 逗号分隔的搜索引擎列表（如 "baidu,bing"） |

## 返回格式

```json
[
  {
    "title": "网页标题",
    "url": "https://example.com/page",
    "snippet": "搜索引擎摘要",
    "web_content": "网页实际内容（最多3000字符）"
  }
]
```

## 项目配置

在 `configs/server_config.yaml` 中添加以下配置：

```yaml
web_search_engine:
  host: "10.9.44.5"    # SearXNG 服务地址
  port: 18080           # SearXNG 服务端口
```

## Docker 部署 SearXNG

### 1. 创建配置文件

创建 `settings.yml`：

```yaml
server:
  secret_key: "aicenter"   # 务必改成一个随机字符串
  limiter: true            # 关闭限流（内网用，公网建议开启）
  public_instance: false
    
# 网络请求配置
outgoing:
  request_timeout: 5.0        # 超时5秒，防止慢引擎卡死
  max_request_timeout: 10.0
  pool_connections: 100
  pool_maxsize: 20
  enable_http2: true

use_default_settings:
  engines:
    remove:
      - google #去掉谷歌（要翻墙）

search:
  safe_search: 0              # 0=关闭安全搜索, 1=中等, 2=严格
  autocomplete: ""            # 关闭自动补全（节省资源）
  default_lang: "zh-CN"       # 默认中文
  formats:
    - html
    - json
  max_results: 50             # 全局默认最大返回50条，请求参数中的会覆盖这个
  
engines:
  # ----- 第一梯队（中文最优，优先展示） -----
  - name: baidu
    use: true
    weight: 3                 # weight越高，同质量时排名更靠前
    disabled: false

  - name: sogou
    use: true
    weight: 3
    disabled: false
    
  - name: 360search
    use: true
    weight: 3
    disabled: false

  # ----- 第二梯队（全球通用） -----
  - name: google
    use: true
    weight: 2
    disabled: true #禁用

  - name: bing
    use: true
    weight: 2
    disabled: false

  - name: duckduckgo
    use: true
    weight: 2
    disabled: false
```

### 2. Docker 启动命令

```bash
docker run -d \
  --name searxng \
  -p 18080:8080 \
  -v ./settings.yml:/etc/searxng/settings.yml \
  --restart unless-stopped \
  searxng/searxng:latest
```

### 3. 验证服务

```bash
curl "http://10.9.44.5:18080/search?q=test&format=json"
```

如果返回 JSON 格式的搜索结果，说明服务正常运行。

## 错误处理

- 搜索引擎连接失败：返回 `"network search failed: cannot connect to http://host:port. Details: ..."`
- 请求超时：返回 `"network search failed: request timeout. Details: ..."`
- 其他错误：返回 `"network search failed: {错误信息}"`
- 搜索结果为空：返回 `"No search results found"`
- 网页抓取失败：对应结果的 `web_content` 字段为 `"(page fetch failed: ...)"` 等提示信息

## 添加新的内置工具

1. 在 `builtin_tools` 目录下创建新的工具子目录
2. 创建与工具同名的 Python 文件
3. 继承 `BuiltinTool` 基类并使用 `@register_builtin_tool` 装饰器
4. 在 `tool_utils.py` 的 `_load_builtin_tools()` 中添加导入语句

示例：

```python
from app.core.tools.base_tool import BaseTool, BaseToolParam
from app.core.tools.tool_registry import register_builtin_tool

@register_builtin_tool
class my_tool(BaseTool):
    name = "my_tool"
    title = "My Tool"
    description = "Tool description"
    params = [
        BuiltinToolParam(name="param1", type="string", description="Param description", required=True),
    ]

    def run(self, **kwargs):
        # Tool logic here
        return result
```
