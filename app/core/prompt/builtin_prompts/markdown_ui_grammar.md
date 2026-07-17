# Markdown-UI 组件语法参考

## 基础语法规则

所有 Markdown-UI 组件必须包裹在 ` ```markdown-ui-widget ` 和 ` ``` ` 代码块中。

### 通用语法格式

```
组件类型 组件ID [其他参数...]
```

**核心规则：**
- **组件 ID 是第二个 token，直接跟在组件类型之后**，不是 `id="..."` 的格式
- 空格分隔 token
- 方括号 `[...]` 表示数组
- 引号 `"..."` 表示字符串
- 2 空格缩进用于表单
- 除了组件类型和 ID，其他参数都是可选的和位置相关的

**正确示例：**
```
select env [dev staging prod] dev
```

**错误示例：**
```
select id="env" env [dev staging prod] dev
select env [dev staging prod] dev id="env"
```

## 1. 文本输入框 (text-input)

用于创建文本输入框。

### 基础用法
```markdown-ui-widget
text-input username "Username" "Enter your name"
```

### 带默认值
```markdown-ui-widget
text-input username "Username" "Enter your name" "john"
```

**参数说明（位置参数）：**
- `username`: 组件 ID（必填，紧跟在 text-input 之后）
- `"Username"`: 输入框标签
- `"Enter your name"`: 占位提示文本
- `"john"`: 默认值（可选）

## 2. 按钮组 (button-group)

用于创建多个按钮供用户选择。

### 基础用法
```markdown-ui-widget
button-group env [dev staging prod] dev
```

### 带中文选项
```markdown-ui-widget
button-group plan [基础版 专业版 企业版] 基础版
```

**参数说明（位置参数）：**
- `env`: 组件 ID（必填，紧跟在 button-group 之后）
- `[dev staging prod]`: 按钮选项列表（数组）
- `dev`: 默认选中的按钮（可选）

## 3. 下拉选择 (select)

用于创建单选下拉框。

### 基础用法
```markdown-ui-widget
select region [us-east us-west] us-east
```

### 带中文选项
```markdown-ui-widget
select country [中国 美国 英国] 中国
```

**参数说明（位置参数）：**
- `region`: 组件 ID（必填，紧跟在 select 之后）
- `[us-east us-west]`: 选项列表（数组）
- `us-east`: 默认选中的选项（可选）

## 4. 多选组件 (select-multi)

用于创建多选下拉框。

### 基础用法
```markdown-ui-widget
select-multi helpers [Reminders Templates Examples Checklists] [Reminders]
```

### 带多个默认选中
```markdown-ui-widget
select-multi skills [Python JavaScript Java Go] [Python JavaScript]
```

**参数说明（位置参数）：**
- `helpers`: 组件 ID（必填，紧跟在 select-multi 之后）
- `[Reminders Templates Examples Checklists]`: 选项列表（数组）
- `[Reminders]`: 默认选中的选项（数组，可选）

## 5. 滑块 (slider)

用于创建数值滑块。

### 基础用法
```markdown-ui-widget
slider cpu 1 32 1 4
```

### 带中文标签场景
```markdown-ui-widget
slider volume 0 100 1 50
```

**参数说明（位置参数）：**
- `cpu`: 组件 ID（必填，紧跟在 slider 之后）
- `1`: 最小值
- `32`: 最大值
- `1`: 步长
- `4`: 默认值（可选）

## 6. 表单 (form)

用于组合多个输入组件，带提交按钮。

### 基础表单
```markdown-ui-widget
form deploy "Launch"
  text-input name "App Name"
  select env [dev prod] dev
  slider replicas 1 10 1 3
```

### 复杂表单
```markdown-ui-widget
form register "注册"
  text-input username "用户名" "请输入用户名"
  text-input email "邮箱" "请输入邮箱"
  select role [管理员 普通用户] 普通用户
  select-multi permissions [读取 写入 删除] [读取]
  slider age 18 100 1 25
```

### 项目配置表单
```markdown-ui-widget
form projectConfig "创建项目"
  text-input projectName "项目名称" "请输入项目名称"
  text-input description "项目描述" "请输入描述"
  select team [前端团队 后端团队 设计团队] 前端团队
  select-multi services [API服务 Web服务 数据库 缓存] [API服务 Web服务]
  slider priority 1 5 1 3
```

**参数说明：**
- `deploy`: 组件 ID（必填，紧跟在 form 之后）
- `"Launch"`: 提交按钮文本
- 表单内容使用 **2 空格缩进**
- 每个子组件都有自己的 ID

## 7. 折线图 (chart-line)

用于展示趋势数据、时间序列等。

```markdown-ui-widget
chart-line
title: Monthly Sales
height: 300
Month,Sales,Target
Jan,100,120
Feb,150,140
Mar,200,180
Apr,180,190
```

**参数说明：**
- `chart-line`: 图表类型
- `title:`: 图表标题（可选）
- `height:`: 图表高度，范围 200-800px，默认 400px（可选）
- CSV 格式数据：第一行为表头，后续行为数据

## 8. 柱状图 (chart-bar)

用于展示对比数据。

```markdown-ui-widget
chart-bar
title: Quarterly Revenue
height: 400
Quarter,Revenue,Profit
Q1,15000,3000
Q2,18000,4500
Q3,22000,6000
Q4,25000,7500
```

## 9. 饼图 (chart-pie)

用于展示占比数据。

```markdown-ui-widget
chart-pie
title: Project Time Allocation
Category,Hours
开发,45
测试,20
设计,15
部署,10
文档,10
```

## 10. 散点图 (chart-scatter)

用于展示相关性分析。

```markdown-ui-widget
chart-scatter
title: Height vs Weight
height: 400
Height,Weight
160,55
170,65
180,75
175,70
165,60
```

## 11. 测验 (quiz)

用于创建带评分的测验。

### 基础测验
```markdown-ui-widget
quiz jsQuiz "JavaScript Fundamentals Quiz"
showScore: true
showProgress: true
passingScore: 70
mcq q1 "What is JavaScript?" 10
  [Programming language Markup language Database] Programming language
mcq q2 "JavaScript is typed as?" 5
  [Static Dynamic Both] Dynamic
short-answer q3 "What does 'DOM' stand for?" 20
  ["Document Object Model"]
```

**参数说明：**
- `jsQuiz`: 测验 ID
- `"JavaScript Fundamentals Quiz"`: 测验标题
- `showScore:`: 是否显示分数（可选，默认 true）
- `showProgress:`: 是否显示进度（可选，默认 true）
- `passingScore:`: 及格分数（可选）
- `mcq ID "问题" 分数`: 多选题
- `short-answer ID "问题" 分数`: 简答题

## 12. 多选题 (multiple-choice-question)

用于创建独立的多选题。

```markdown-ui-widget
multiple-choice-question planet "Which planet is known as the Red Planet?"
  [Mars Venus Jupiter Mercury] Mars
```

**参数说明：**
- `planet`: 问题 ID
- `"Which planet is known as the Red Planet?"`: 问题文本
- `[Mars Venus Jupiter Mercury]`: 选项列表
- `Mars`: 正确答案

## 13. 简答题 (short-answer-question)

用于创建独立的简答题。

### 单个正确答案
```markdown-ui-widget
short-answer-question dom "What does 'DOM' stand for?"
  "Document Object Model"
```

### 多个可接受答案
```markdown-ui-widget
short-answer-question js "Name a JavaScript framework"
  ["React" "Vue" "Angular" "Svelte"]
```

**参数说明：**
- `dom`: 问题 ID
- `"What does 'DOM' stand for?"`: 问题文本
- `"Document Object Model"`: 单个正确答案
- `["React" "Vue" "Angular" "Svelte"]`: 多个可接受答案（数组）

## 最佳实践

### 1. 组件 ID 命名规范
- 使用有意义的英文名称，如 `username`、`env`、`region`
- 使用小写字母和连字符
- 示例：`user-name`、`api-env`、`select-country`

### 2. ID 位置规则（重要）
- **ID 必须紧跟在组件类型之后**，作为第二个 token
- 正确示例：`select env [dev prod] dev`
- 错误示例：`select id="env" env [dev prod] dev`

### 3. 表单设计建议
- 表单使用 2 空格缩进
- 提供合理的默认值
- 标签清晰明了
- 提交按钮文本要明确

### 4. 组件组合示例

```markdown-ui-widget
form userSettings "保存设置"
  text-input displayName "显示名称" "请输入名称"
  text-input email "邮箱地址" "请输入邮箱"
  select theme [浅色 深色 自动] 自动
  select-multi notifications [邮件通知 系统通知 短信通知] [系统通知]
  slider fontSize 12 24 1 14
```

### 5. 部署配置表单

```markdown-ui-widget
form deploymentConfig "开始部署"
  button-group environment [开发环境 测试环境 生产环境] 测试环境
  select region [华东 华北 华南 西南] 华东
  select-multi services [API服务 Web服务 数据库 缓存] [API服务 Web服务]
  slider replicas 1 10 1 3
```

## 注意事项

1. **ID 位置规则（最重要）**：
   - ID 必须紧跟在组件类型之后，作为第二个 token
   - 通用格式：`组件类型 组件ID 其他参数...`
   - **不要使用 `id="..."` 的格式**
   - 正确：`select env [dev prod] dev`
   - 错误：`select id="env" env [dev prod] dev`

2. **组件类型名称**：
   - 使用 `text-input`（不是 `input`）
   - 使用 `button-group`（没有单个 `button` 组件）
   - 使用 `select-multi`（不是 `multiselect`）

3. **数据格式**：
   - 数组使用方括号：`[dev staging prod]`
   - 字符串使用引号：`"Enter your name"`
   - 图表数据使用 CSV 格式

4. **中文字符**：
   - 所有标签和选项可以使用中文
   - 确保 token 之间的空格分隔正确

5. **代码块标记**：
   - 必须使用 `markdown-ui-widget` 作为代码块语言标记
   - 确保前端正确识别和渲染
