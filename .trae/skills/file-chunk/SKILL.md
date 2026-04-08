---
name: file-chunk
description: 文档切片后端代码实现
---

## 使用场景
- 使用Deepdoc以及大模型进行文档切片
- 需要参考RAGFLOW项目的rag代码， ragflow项目源码在本系统目录 F:\project\ragflow-0.24.0

## 技术栈
- Deepdoc
- Ragflow

## 需要满足如下要求
1.扫描ragflow项目工程， 实现RAGFLOW工程中的rag目录下的切片功能
2.graphrag和llm目录下的可以不用实现
3.将deepdoc目录复制到本项目的core/knowledge目录下
### 代码大致说明：
(1)rag/app: 不同文档切面方法的具体切面实现
(2)rag/nlp: 自然语言处理
(3)rag/res: 资源文件
(4)rag/utils:工具类
(5)rag/svr：任务调度与执行服务，只用实现task_executor.py
(6)deepdoc ： Deepdoc解析器代码

### 代码实现
1.在本项目的core/knowledgebase/rag目录下实现上面描述的rag代码（可创建子目录）
2.生成本功能的README.md
3.server_config.yaml添加了es的配置项，在database目录的es_utils.py文件中实现es连接工具类
4.knowledge_constants.py定义了文档解析类型以及文档解析状态常量，帮我修复代码bug改成字典类型

##规定
1.需要完整扫描ragflow项目工程，理解rag以及deepdoc目录下的代码
2.不要影响本项目已有的其他功能代码
3.结合本项目代码风格以及已存在代码实现ragflow下的切片方法