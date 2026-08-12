"""
聊天事件总线模块

基于 Redis Stream 实现的事件驱动架构，将聊天的请求、流式输出、停止等
操作统一抽象为事件，通过事件总线进行解耦。

事件类型（event.py）：
    - BaseEvent:        事件基类
    - ChatRequestEvent: 前端发起的聊天请求事件
    - ChatStreamEvent:  聊天流式输出的单个 chunk 事件
    - ChatStopEvent:    停止聊天事件
    - ChatDoneEvent:    聊天完成事件

核心组件：
    - EventBus:            Redis Stream 事件总线（发布/订阅）
    - ChatEventPublisher:  事件发布器（API 层使用）
    - ChatEventConsumer:   事件消费者（后台运行，处理聊天逻辑）
    - ChatResultStream:    结果流读取器（供前端 SSE 消费）
"""
