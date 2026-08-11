"""
聊天响应数据传输对象

封装聊天接口SSE返回的数据结构
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, Any, Dict, List


class MessageStatus:
    """
    消息状态常量
    
    用于标识同一消息ID的消息流转状态
    """
    START = 'start'
    RUNNING = 'running'
    DONE = 'done'
    STOP = 'stop'
    ERROR = 'error'


class MessageStep:
    """
    消息步骤常量
    
    用于标识聊天流程中的各个阶段
    """
    PRE_PROCESS = 'pre_process'
    ANALYZE_QUERY = 'analyze_query'
    TASK_PLANNING = 'task_planning'
    TASK_LIST = 'task_list'
    MODEL_ANSWER = 'model_answer'
    TASK_EXECUTION = 'task_execution'
    RESULT_SUMMARY = 'result_summary'
    TOOL_CALL = 'tool_call'


@dataclass
class TaskInfo:
    """
    任务信息
    
    封装任务规划中的子任务信息
    """
    id: int = 0
    name: str = ''
    description: str = ''
    status: str = 'pending'
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 字典格式的任务信息
        """
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status
        }


@dataclass
class ToolCallInfo:
    """
    工具调用信息
    
    封装工具调用的状态、结果等信息
    """
    tool_call_id: str = ''
    name: str = ''
    task_name: str = ''
    status: str = 'start'
    elapsed_ms: int = 0
    result: Optional[Any] = None
    message: Optional[str] = None
    reasoning_content: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式
        
        Returns:
            Dict[str, Any]: 字典格式的工具调用信息
        """
        data = {
            'tool_call_id': self.tool_call_id,
            'name': self.name,
            'task_name': self.task_name,
            'status': self.status,
            'elapsed_ms': self.elapsed_ms
        }
        if self.result is not None:
            data['result'] = self.result
        if self.message is not None:
            data['message'] = self.message
        if self.reasoning_content is not None:
            data['reasoning_content'] = self.reasoning_content
        if self.parameters is not None:
            data['parameters'] = self.parameters
        return data


@dataclass
class ChatStreamResponse:
    """
    聊天流式响应
    
    封装SSE返回的完整数据结构
    """
    text: str = ''
    reasoning_content: Optional[str] = None
    reasoning_end: bool = False
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, int]] = None
    tool_call: Optional[ToolCallInfo] = None
    task_plan: Optional[List[TaskInfo]] = None
    chat_id: str = ''
    user_message_id: str = ''
    assistant_message_id: str = ''
    status: str = MessageStatus.RUNNING
    error: Optional[str] = None
    step: Optional[str] = None
    step_id: str = ''
    parent_step_id: Optional[str] = None
    reasoning_time: Optional[int] = None
    avatar: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典格式，用于SSE返回
        
        Returns:
            Dict[str, Any]: 字典格式的响应数据
        """
        data = {
            'text': self.text,
            'chat_id': self.chat_id,
            'user_message_id': self.user_message_id,
            'assistant_message_id': self.assistant_message_id,
            'status': self.status,
            'step_id': self.step_id
        }
        
        if self.step is not None:
            data['step'] = self.step
        
        if self.error is not None:
            data['error'] = self.error
            # 错误响应也需要包含text字段（错误信息文本）
            if self.text:
                data['text'] = self.text
            return data
        
        if self.reasoning_content is not None:
            data['reasoning_content'] = self.reasoning_content
        
        if self.reasoning_end:
            data['reasoning_end'] = self.reasoning_end
        
        if self.finish_reason is not None:
            data['finish_reason'] = self.finish_reason
        
        if self.usage is not None:
            data['usage'] = self.usage
        
        if self.tool_call is not None:
            data['tool_call'] = self.tool_call.to_dict()
        
        if self.task_plan is not None:
            data['task_plan'] = [t.to_dict() for t in self.task_plan]
        
        if self.step is not None:
            data['step'] = self.step
        
        if self.reasoning_time is not None:
            data['reasoning_time'] = self.reasoning_time
        
        if self.parent_step_id is not None:
            data['parent_step_id'] = self.parent_step_id
        
        if self.avatar is not None:
            data['avatar'] = self.avatar
        
        return data
    
    @classmethod
    def error_response(
        cls,
        error: str,
        chat_id: str = '',
        user_message_id: str = '',
        assistant_message_id: str = '',
        step_id: str = '',
        step: Optional[str] = None,
        text: str = '',
        avatar: Optional[str] = None
    ) -> 'ChatStreamResponse':
        """
        创建错误响应
        
        Args:
            error: 错误信息
            chat_id: 对话ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            step_id: 步骤ID
            step: 当前步骤
            text: 文本内容（错误信息）
            avatar: 头像URL
            
        Returns:
            ChatStreamResponse: 错误响应对象
        """
        return cls(
            error=error,
            text=text,
            chat_id=chat_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            status=MessageStatus.ERROR,
            step_id=step_id,
            step=step,
            avatar=avatar
        )
    
    @classmethod
    def start_response(
        cls,
        chat_id: str,
        user_message_id: str,
        assistant_message_id: str,
        step: Optional[str] = None,
        step_id: str = '',
        avatar: Optional[str] = None
    ) -> 'ChatStreamResponse':
        """
        创建消息开始响应
        
        Args:
            chat_id: 对话ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            step: 阶段标识（task_planning/model_answer/task_execution/result_summary）
            step_id: 阶段ID
            avatar: 头像URL
            
        Returns:
            ChatStreamResponse: 开始响应对象
        """
        return cls(
            text='',
            chat_id=chat_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            status=MessageStatus.START,
            step=step,
            step_id=step_id,
            avatar=avatar
        )
    
    @classmethod
    def text_response(
        cls,
        text: str,
        chat_id: str,
        user_message_id: str,
        assistant_message_id: str,
        reasoning_content: Optional[str] = None,
        reasoning_end: bool = False,
        finish_reason: Optional[str] = None,
        usage: Optional[Dict[str, int]] = None,
        status: str = MessageStatus.RUNNING,
        step_id: str = '',
        step: Optional[str] = None,
        reasoning_time: Optional[int] = None,
        avatar: Optional[str] = None
    ) -> 'ChatStreamResponse':
        """
        创建文本流响应
        
        Args:
            text: 文本内容
            chat_id: 对话ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            reasoning_content: 推理内容
            reasoning_end: 推理是否结束
            finish_reason: 结束原因
            usage: 使用统计
            status: 消息状态
            step_id: 阶段ID
            step: 阶段标识
            reasoning_time: 推理耗时
            avatar: 头像URL
            
        Returns:
            ChatStreamResponse: 文本响应对象
        """
        return cls(
            text=text,
            reasoning_content=reasoning_content,
            reasoning_end=reasoning_end,
            finish_reason=finish_reason,
            usage=usage,
            chat_id=chat_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            status=status,
            step_id=step_id,
            step=step,
            reasoning_time=reasoning_time,
            avatar=avatar
        )
    
    @classmethod
    def tool_call_response(
        cls,
        tool_call: ToolCallInfo,
        chat_id: str,
        user_message_id: str,
        assistant_message_id: str,
        status: str = MessageStatus.RUNNING,
        step_id: str = '',
        step: Optional[str] = None,
        reasoning_content: Optional[str] = None,
        avatar: Optional[str] = None
    ) -> 'ChatStreamResponse':
        """
        创建工具调用响应
        
        Args:
            tool_call: 工具调用信息
            chat_id: 对话ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            status: 消息状态
            step_id: 阶段ID
            step: 阶段标识
            reasoning_content: 思考过程
            avatar: 头像URL
            
        Returns:
            ChatStreamResponse: 工具调用响应对象
        """
        return cls(
            text='',
            tool_call=tool_call,
            chat_id=chat_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            status=status,
            step_id=step_id,
            step=step,
            reasoning_content=reasoning_content,
            avatar=avatar
        )
    
    @classmethod
    def task_plan_response(
        cls,
        task_plan: List[TaskInfo],
        chat_id: str,
        user_message_id: str,
        assistant_message_id: str,
        step_id: str = '',
        step: Optional[str] = None,
        avatar: Optional[str] = None
    ) -> 'ChatStreamResponse':
        """
        创建任务规划响应
        
        Args:
            task_plan: 任务列表
            chat_id: 对话ID
            user_message_id: 用户消息ID
            assistant_message_id: 助手消息ID
            step_id: 阶段ID
            step: 阶段标识
            avatar: 头像URL
            
        Returns:
            ChatStreamResponse: 任务规划响应对象
        """
        return cls(
            text='',
            task_plan=task_plan,
            chat_id=chat_id,
            user_message_id=user_message_id,
            assistant_message_id=assistant_message_id,
            status=MessageStatus.RUNNING,
            step_id=step_id,
            step=step,
            avatar=avatar
        )
