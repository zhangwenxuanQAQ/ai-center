import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Switch, Modal, Slider, message, Popconfirm, Tooltip, Dropdown, Empty, Spin, Popover, InputNumber, Select, Steps, Upload, List } from 'antd';
import { SendOutlined, ClearOutlined, SettingOutlined, RobotOutlined, BulbOutlined, LoadingOutlined, DownOutlined, RightOutlined, CopyOutlined, ReloadOutlined, EditOutlined, InfoCircleOutlined, StopOutlined, PaperClipOutlined, FolderOpenOutlined, FileTextOutlined, UploadOutlined, CloseCircleOutlined, InboxOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined, SoundOutlined, DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import DataSourceFileSelector from '../datasource/datasource data_select';
import type { MenuProps, UploadProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { chatbotService, Chatbot } from '../../services/chatbot';
import { chatService, Conversation, Message, QueryItem, FileInfo } from '../../services/chat';
import { datasourceService, Datasource } from '../../services/datasource';
import { getProviderAvatar, getDefaultAvatar, resolveAvatarPath } from '../../utils/avatar';

const { TextArea } = Input;

interface ConfigParam {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  description: string;
  options?: string[];
}

interface ToolCallStep {
  tool_call_id: string;
  name: string;
  task_name?: string;
  status: 'start' | 'running' | 'success' | 'error';
  result?: any;
  message?: string;
  elapsed_ms?: number;
}

interface TaskInfo {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'done';
}

interface Message {
  id: string;
  message_id?: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
  reasoning_content?: string;
  reasoning_time?: number;
  reasoning_end?: boolean;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  extra_content?: any;
  tool_calls?: ToolCallStep[];
  status?: 'start' | 'running' | 'done' | 'stop' | 'error';
  step?: 'pre_process' | 'task_planning' | 'task_list' | 'model_answer' | 'task_execution' | 'result_summary';
  step_id?: string;
  task_plan?: TaskInfo[];
  avatar?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  group_id?: string;
  group_name?: string;
}

interface ChatConversationProps {
  theme: 'light' | 'dark';
  conversation: Conversation | null;
  onConversationCreated?: (newConversation?: Conversation) => void;
}



const ChatConversation: React.FC<ChatConversationProps> = ({
  theme,
  conversation,
  onConversationCreated
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [selectedType, setSelectedType] = useState<'model' | 'chatbot'>('model');
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingChatbots, setLoadingChatbots] = useState(false);
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [configParams, setConfigParams] = useState<Record<string, ConfigParam[]>>({});
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedToolCallResults, setExpandedToolCallResults] = useState<Set<string>>(new Set());
  const [expandedTaskPlans, setExpandedTaskPlans] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingFiles, setEditingFiles] = useState<any[]>([]); // 保存编辑消息的文件信息
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const isCreatingNewConversation = useRef(false);
  // 标记切换对话后是否需要滚动到底部
  const shouldScrollToBottomOnLoad = useRef(false);
  // 追踪当前显示的对话ID，用于隔离不同对话的流式消息更新
  const currentChatIdRef = useRef<string>('');

  // 文件上传相关状态
  const [selectedFiles, setSelectedFiles] = useState<QueryItem[]>([]);
  const [isDataSourceModalVisible, setIsDataSourceModalVisible] = useState(false);
  const [dataSourceStep, setDataSourceStep] = useState(0);
  const [dataSources, setDataSources] = useState<Datasource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<Datasource | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [buckets, setBuckets] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedDataSourceFiles, setSelectedDataSourceFiles] = useState<any[]>([]);
  const [loadingDataSources, setLoadingDataSources] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchModels();
    fetchChatbots();
    fetchConfigParams();
  }, []);

  useEffect(() => {
    if (isCreatingNewConversation.current) {
      isCreatingNewConversation.current = false;
      return;
    }
    
    if (conversation) {
      // 更新当前显示的对话ID，用于隔离流式消息更新
      currentChatIdRef.current = conversation.id;
      
      // 检查是否有该对话的流式消息缓存
      const streamingCache = chatService.getStreamingCache(conversation.id);
      
      if (streamingCache && streamingCache.messages.length > 0) {
        // 有缓存：恢复缓存的消息
        // 先加载历史消息
        fetchMessages(conversation.id);
        fetchConversationConfig(conversation.id);
        
        // 设置标志：切换对话后需要滚动到底部
        shouldScrollToBottomOnLoad.current = true;
        
        // 恢复正在接收的助手消息
        if (streamingCache.isStreaming && streamingCache.assistantMessageId) {
          // 添加正在接收的助手消息到 messages
          setThinkingMessageId(streamingCache.assistantMessageId);
          
          // 创建一个恢复的助手消息
          const restoredAssistantMessage: Message = {
            id: streamingCache.assistantMessageId,
            message_id: streamingCache.assistantMessageId,
            role: 'assistant',
            content: streamingCache.currentContent,
            created_at: new Date().toISOString(),
            reasoning_content: streamingCache.currentReasoningContent,
            reasoning_end: streamingCache.currentReasoningContent ? true : undefined,
            status: 'running',
            step: 'model_answer'
          };
          
          // 需要在历史消息加载后追加这条消息
          // 使用 setTimeout 确保历史消息加载完成后再追加
          setTimeout(() => {
            setMessages(prev => {
              // 检查是否已经有这条消息（避免重复）
              if (prev.find(m => m.id === streamingCache.assistantMessageId)) {
                return prev;
              }
              // 追加恢复的助手消息
              return [...prev, restoredAssistantMessage];
            });
          }, 200);
        }
      } else {
        // 无缓存：正常加载历史消息
        setMessages([]);
        setLoading(true);
        shouldScrollToBottomOnLoad.current = true;
        fetchMessages(conversation.id);
        fetchConversationConfig(conversation.id);
      }
    } else {
      // 新建对话时，清空消息列表
      setMessages([]);
      // 清空系统提示词
      setSystemPrompt('');
      // 恢复模型配置参数为选中模型的默认配置
      if (selectedModel && selectedModel.config) {
        setModelConfig(selectedModel.config);
      } else {
        setModelConfig({});
      }
    }
  }, [conversation]);

  // 当models或chatbots加载完成后，重新加载对话配置
  useEffect(() => {
    if (conversation && models.length > 0 && chatbots.length > 0) {
      fetchConversationConfig(conversation.id);
    }
  }, [models, chatbots]);

  const fetchConversationConfig = async (conversationId: string) => {
    try {
      const detail = await chatService.getConversation(conversationId);
      
      // 加载系统提示词
      setSystemPrompt(detail.system_prompt || '');
      
      if (detail.model_id) {
        const model = models.find(m => m.id === detail.model_id);
        if (model) {
          setSelectedModel(model);
          setSelectedChatbot(null);
          setSelectedType('model');
          if (detail.config) {
            const configObj = typeof detail.config === 'string' ? JSON.parse(detail.config) : detail.config;
            setModelConfig(configObj);
          } else if (model.config) {
            setModelConfig(model.config);
          } else {
            setModelConfig({});
          }
        }
      } else if (detail.chatbot_id) {
        const chatbot = chatbots.find(c => c.id === detail.chatbot_id);
        if (chatbot) {
          setSelectedChatbot(chatbot);
          setSelectedModel(null);
          setSelectedType('chatbot');
          if (detail.config) {
            const configObj = typeof detail.config === 'string' ? JSON.parse(detail.config) : detail.config;
            setModelConfig(configObj);
          } else if (chatbot.model_id) {
            const model = models.find(m => m.id === chatbot.model_id);
            if (model && model.config) {
              setModelConfig(model.config);
            }
          } else {
            setModelConfig({});
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversation config:', error);
    }
  };

  /**
   * 处理SSE消息更新，支持多轮回答展示
   */
  const processSSEMessageUpdate = (msg: Message, data: any, idTracker: { assistant: string, user: string }) => {
    // 用户消息处理
    if (msg.role === 'user') {
      if (data.user_message_id && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
        idTracker.user = data.user_message_id;
        return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
      }
      return msg;
    }

    // 助手消息处理：严格基于step_id匹配，不同step_id之间互不影响
    if (msg.role === 'assistant') {
      const dataStepId = data.step_id;
      const msgStepId = msg.step_id;

      // 严格检查step_id匹配，只有step_id完全一致时才更新
      const dataHasStepId = dataStepId !== undefined && dataStepId !== null && dataStepId !== '';
      const msgHasStepId = msgStepId !== undefined && msgStepId !== null && msgStepId !== '';

      if (dataHasStepId) {
        if (!msgHasStepId || dataStepId !== msgStepId) {
          return msg;
        }
      } else {
        if (msgHasStepId) {
          return msg;
        }
      }

      const updates: any = { ...msg };

      // 更新message_id（后端返回的ID），但保持id不变（用于React渲染，保持唯一性）
      if (data.assistant_message_id) {
        updates.message_id = data.assistant_message_id;
      }

      const status = data.status || 'running';
      updates.status = status;

      if (data.step) {
        updates.step = data.step;
      }

      if (data.step_id) {
        updates.step_id = data.step_id;
      }

      if (data.task_plan) {
        updates.task_plan = data.task_plan.map((task: any) => ({
          id: task.id,
          name: task.name,
          description: task.description,
          status: task.status || 'pending'
        }));
      }

      // 如果reasoning_end已为true，不再处理reasoning_content的更新
      // 防止新步骤的数据被错误地追加到已结束的步骤中
      if (!msg.reasoning_end) {
        if (data.reasoning_content) {
          updates.reasoning_content = (msg.reasoning_content || '') + data.reasoning_content;
        }
      }

      if (data.text) {
        updates.content = (msg.content || '') + data.text;
      }

      if (data.reasoning_end) {
        updates.reasoning_end = true;
      }

      if (data.usage) {
        updates.usage = data.usage;
      }

      if (data.tool_call) {
        const tc = data.tool_call;
        const existingCalls = updates.tool_calls || [];
        const existingIndex = existingCalls.findIndex((c: ToolCallStep) => c.tool_call_id === tc.tool_call_id);
        if (existingIndex >= 0) {
          existingCalls[existingIndex] = { ...existingCalls[existingIndex], ...tc };
        } else {
          existingCalls.push(tc);
        }
        updates.tool_calls = [...existingCalls];
      }

      if (data.reasoning_time != null) {
        updates.reasoning_time = data.reasoning_time;
      }

      if (data.avatar) {
        updates.avatar = data.avatar;
      }

      if (status === 'start') {
        setThinkingMessageId(data.assistant_message_id);
      }

      updates.created_at = new Date().toISOString();
      return updates;
    }

    // 默认返回原消息
    return msg;
  };

  // 检测是否在底部
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100; // 容差阈值，距离底部100px以内视为在底部
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  };

  useEffect(() => {
    // 切换对话后强制滚动到底部
    if (shouldScrollToBottomOnLoad.current) {
      shouldScrollToBottomOnLoad.current = false;
      // 使用 setTimeout 确保 DOM 完全渲染后再滚动
      setTimeout(() => {
        scrollToBottomInstant();
      }, 100);
      return;
    }
    // 只有在底部时才自动滚动
    if (isAtBottom()) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 立即滚动到底部（无动画），用于切换对话时
  const scrollToBottomInstant = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // 处理本地文件上传
  const handleLocalFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Content = (e.target?.result as string).split(',')[1];
      const mimeType = file.type || 'application/octet-stream';
      
      const newFile: QueryItem = {
        type: 'file_base64',
        content: base64Content,
        mime_type: mimeType,
        file_name: file.name,
        file_size: file.size
      };
      
      setSelectedFiles(prev => [...prev, newFile]);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  };

  // 移除已选择的文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 处理数据源文件选择确认
  const handleDataSourceFileConfirm = (files: any[]) => {
    const newFiles: QueryItem[] = files.map(file => ({
      type: 'document',
      content: {
        datasource_id: file.datasource_id,
        bucket: file.bucket,
        location: file.path,
        file_name: file.name,
        file_size: file.size
      }
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  // 处理文件下载
  const handleDownloadFile = async (fileInfo: FileInfo) => {
    try {
      await chatService.downloadFile(
        fileInfo.type,
        fileInfo.file_name,
        fileInfo.base64_content,
        fileInfo.datasource_id,
        fileInfo.bucket,
        fileInfo.location
      );
      message.success('文件下载成功');
    } catch (error) {
      console.error('Failed to download file:', error);
      message.error('文件下载失败');
    }
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const result = await llmModelService.getLLMModels(1, 100, undefined, undefined, undefined, 'true');
      console.log('Fetched models:', result.data);
      const textModels = result.data.filter((model: LLMModel) => 
        model.model_type === 'text' || model.model_type === 'vision' || model.model_type === 'multimodal'
      );
      setModels(textModels);
      if (textModels.length > 0) {
        handleSelectModel(textModels[0]);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchChatbots = async () => {
    setLoadingChatbots(true);
    try {
      const result = await chatbotService.getChatbots(undefined, 1, 100);
      setChatbots(result.data);
    } catch (error) {
      console.error('Failed to fetch chatbots:', error);
    } finally {
      setLoadingChatbots(false);
    }
  };

  const fetchConfigParams = async () => {
    try {
      const data = await llmModelService.getConfigParams();
      setConfigParams(data);
    } catch (error) {
      console.error('Failed to fetch config params:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoading(true);
    try {
      const result = await chatService.getMessages(conversationId, 1, 50);
      const mappedMessages = result.items.map((msg: any) => {
        let extraContent = msg.extra_content;
        let step_id = undefined;
        let step = undefined;
        let tool_calls = undefined;
        try {
          if (typeof extraContent === 'string') {
            extraContent = JSON.parse(extraContent);
          }
          if (extraContent && extraContent.step_id) {
            step_id = extraContent.step_id;
          }
          if (extraContent && extraContent.step) {
            step = extraContent.step;
          }
          if (extraContent && extraContent.step === 'tool_call' && extraContent.tool_call_id) {
            tool_calls = [{
              tool_call_id: extraContent.tool_call_id,
              name: extraContent.name,
              task_name: extraContent.task_name,
              status: extraContent.status,
              result: extraContent.result,
              message: extraContent.message,
              elapsed_ms: extraContent.elapsed_ms,
              reasoning_content: extraContent.reasoning_content
            }];
          }
        } catch (e) {
          // ignore parsing errors
        }
        return {
          id: step_id || msg.message_id || msg.id,
          message_id: msg.message_id || msg.id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
          reasoning_content: msg.reasoning_content,
          reasoning_time: msg.reasoning_time,
          reasoning_end: msg.reasoning_content ? true : undefined,
          usage: msg.usage,
          extra_content: extraContent,
          tool_calls,
          step_id,
          step,
          avatar: msg.avatar
        };
      });
      setMessages(mappedMessages);
      
      const durations: Record<string, number> = {};
      mappedMessages.forEach((msg: Message) => {
        if (msg.reasoning_time) {
          durations[msg.id] = msg.reasoning_time;
        }
      });
      setThinkingDuration(durations);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    chatService.stopCurrentRequest();
    
    // 调用后端停止接口，更新消息状态
    if (conversation?.id) {
      try {
        await chatService.stopChat(conversation.id);
      } catch (e) {
        console.error('停止聊天失败:', e);
      }
    }
    
    // 更新当前正在运行的消息状态为stop
    setMessages(prev => prev.map(msg => {
      if (msg.role === 'assistant' && (msg.status === 'start' || msg.status === 'running')) {
        return {
          ...msg,
          status: 'stop',
          content: msg.content ? (msg.content.endsWith('\n') ? msg.content + '已停止' : msg.content + '\n已停止') : '已停止'
        };
      }
      return msg;
    }));
    
    setLoading(false);
    setThinkingMessageId(null);
  };

  const handleSend = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0) return;

    let currentConversation = conversation;

    // 构建查询数组
    const query: QueryItem[] = [];
    
    // 添加文本内容
    if (inputValue.trim()) {
      query.push({
        type: 'text',
        content: inputValue.trim()
      });
    }
    
    // 添加文件内容
    selectedFiles.forEach(file => {
      query.push(file);
    });

    // 如果没有选中的对话，先创建一个新对话
    if (!currentConversation) {
      try {
        // 标题为用户问题的前20个字符或文件名
        const title = inputValue.trim() 
          ? inputValue.trim().substring(0, 20)
          : selectedFiles.length > 0 
            ? selectedFiles[0].file_name?.substring(0, 20) || '新对话'
            : '新对话';
        
        // 标记正在创建新对话，防止 useEffect 清空消息
        isCreatingNewConversation.current = true;
        
        currentConversation = await chatService.createConversation(
          title,
          selectedModel?.id,
          selectedChatbot?.id,
          modelConfig,
          systemPrompt
        );
        // 通知父组件更新对话列表并选中新创建的对话
        if (onConversationCreated) {
          onConversationCreated({
            id: currentConversation.id,
            title: currentConversation.title,
            created_at: currentConversation.created_at,
            updated_at: currentConversation.updated_at,
            is_pinned: currentConversation.is_pinned || false
          });
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        message.error('创建对话失败，请重试');
        return;
      }
    }

    // 构建用户消息显示内容
    const displayContent = inputValue.trim() || (selectedFiles.length > 0 ? `${selectedFiles.length} 个文件` : '');
    
    // 转换selectedFiles为FileInfo格式
    const filesForDisplay = selectedFiles.map((file) => {
      if (file.type === 'file_base64') {
        return {
          type: 'local',
          file_name: file.file_name,
          file_size: file.file_size,
          base64_content: file.content,
          datasource_id: undefined,
          bucket: undefined,
          location: undefined
        };
      } else if (file.type === 'document') {
        const content = file.content as Record<string, any>;
        return {
          type: 'datasource',
          file_name: content?.file_name,
          file_size: content?.file_size,
          base64_content: undefined,
          datasource_id: content?.datasource_id,
          bucket: content?.bucket,
          location: content?.location
        };
      }
      return file;
    });
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      extra_content: { files: filesForDisplay },
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setSelectedFiles([]);
    setLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'start',
      created_at: new Date().toISOString(),
      avatar: selectedChatbot?.avatar || (selectedModel?.provider ? getProviderAvatar(selectedModel.provider) : undefined)
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      // 发送消息到后端
      console.log('Sending message with config:', modelConfig);
      
      const idTracker = { assistant: assistantMessageId, user: userMessage.id };

      // 使用流式发送（带文件）
      chatService.sendMessageStreamWithFiles(
        query,
        selectedModel?.id,
        selectedChatbot?.id,
        currentConversation?.id,
        { ...modelConfig, deep_thinking: deepThinking },
        undefined, // messageId is undefined for new messages
        systemPrompt, // 系统提示词
        (data) => {
          // 对话隔离：只处理当前显示对话的消息
          if (currentChatIdRef.current !== currentConversation?.id) {
            return;
          }
          
          const status = data.status || 'running';
          const stepId = data.step_id;
          
          // 处理 error 状态：将错误内容显示到助手消息中，不抛出异常
          if (status === 'error') {
            setMessages(prev => {
              // 先更新用户消息（如果有user_message_id）
              let updatedMessages = prev;
              if (data.user_message_id) {
                updatedMessages = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              
              // 检查是否有对应的助手消息（通过 step_id 或 assistant_message_id）
              const existingMsg = updatedMessages.find(msg => 
                msg.role === 'assistant' && 
                (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
              );
              
              if (existingMsg) {
                // 更新现有消息为错误状态，显示错误内容
                return updatedMessages.map(msg => {
                  if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                    return {
                      ...msg,
                      content: data.text || '抱歉，处理您的请求时出现错误。',
                      status: 'error',
                      reasoning_content: undefined,
                      reasoning_end: undefined
                    };
                  }
                  return msg;
                });
              } else {
                // 创建新的错误消息
                const errorMsg: Message = {
                  id: stepId || idTracker.assistant,
                  message_id: data.assistant_message_id,
                  role: 'assistant',
                  content: data.text || '抱歉，处理您的请求时出现错误。',
                  created_at: new Date().toISOString(),
                  status: 'error',
                  step: data.step,
                  step_id: stepId,
                  avatar: data.avatar
                };
                return [...updatedMessages, errorMsg];
              }
            });
            // 不清理状态，等待 [DONE] 消息来处理最终状态
            return;
          }
          
          // 当收到status=start且有step_id时，处理消息新增或更新
          if (status === 'start' && stepId && data.step) {
            setMessages(prev => {
              // 先更新用户消息（如果有user_message_id）
              let updatedMessages = prev;
              if (data.user_message_id) {
                updatedMessages = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              
              // 检查是否已有相同step_id的消息
              const existingStepMsg = updatedMessages.find(msg => msg.step_id === stepId && msg.role === 'assistant');
              if (existingStepMsg) {
                // 已存在，更新该消息和用户消息
                return updatedMessages.map(msg => {
                  if (msg.role === 'user') {
                    return processSSEMessageUpdate(msg, data, idTracker);
                  }
                  if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data, idTracker);
                  return msg;
                });
              }
              
              // 检查是否有初始的"思考中..."消息（没有step_id），需要移除它
              const initialMsgIndex = updatedMessages.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
              
              // 每个步骤创建独立的消息记录，不覆盖之前的步骤消息
              const newStepMsg: Message = {
                id: stepId,
                message_id: data.assistant_message_id,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                status: 'start',
                step: data.step,
                step_id: stepId,
                reasoning_content: '',
                reasoning_end: false,
                avatar: data.avatar,
                tool_calls: []
              };
              
              // 如果当前消息包含 tool_call 数据，立即添加到 tool_calls
              if (data.tool_call) {
                newStepMsg.tool_calls = [data.tool_call];
              }
              
              // 如果有初始"思考中"消息，移除它并新增具体步骤消息
              if (initialMsgIndex >= 0) {
                const newMessages = updatedMessages.filter((_, idx) => idx !== initialMsgIndex);
                return [...newMessages, newStepMsg];
              }
              
              return [...updatedMessages, newStepMsg];
            });
          } else {
            // 其他情况，更新现有消息
            // 更新用户消息和匹配的助手消息
            const stepId = data.step_id;
            setMessages(prev => prev.map(msg => {
              // 用户消息也需要更新（处理user_message_id）
              if (msg.role === 'user') {
                return processSSEMessageUpdate(msg, data, idTracker);
              }
              // 助手消息：只更新匹配的step_id的消息，避免不同步骤互相影响
              if (!stepId) return processSSEMessageUpdate(msg, data, idTracker);
              if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data, idTracker);
              return msg;
            }));
          }
        },
        (error) => {
          console.error('Failed to send message:', error);
          const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
          message.error(errorMessage);
          
          setMessages(prev => prev.map(msg => 
            msg.id === idTracker.assistant
              ? { 
                  ...msg, 
                  content: `抱歉，发送消息时出现错误：${errorMessage}`,
                  reasoning_content: undefined
                }
              : msg
          ));
          
          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [idTracker.assistant]: duration
            }));
          }
          setLoading(false);
          setThinkingMessageId(null);
        },
        () => {
          if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
            const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
            setThinkingDuration(prev => ({
              ...prev,
              [idTracker.assistant]: duration
            }));
          }
          // 将所有仍在运行中的消息（包括 error 状态）更新为 done，以便显示重新回答和复制按钮
          setMessages(prev => prev.map(msg => {
            if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
              return { ...msg, status: 'done' };
            }
            return msg;
          }));
          setLoading(false);
          setThinkingMessageId(null);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
      message.error(errorMessage);
      
      // 失败时显示错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: `抱歉，发送消息时出现错误：${errorMessage}`,
              reasoning_content: undefined
            }
          : msg
      ));
      
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({
          ...prev,
          [assistantMessageId]: duration
        }));
      }
      setLoading(false);
      setThinkingMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearMessages = async () => {
    if (!conversation) {
      message.warning('请先选择对话');
      return;
    }
    
    try {
      await chatService.clearMessages(conversation.id);
      setMessages([]);
      message.success('已清空对话');
    } catch (error) {
      console.error('Failed to clear messages:', error);
      message.error('清空对话失败，请重试');
    }
  };

  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const toggleToolCall = (toolCallId: string) => {
    setExpandedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const toggleToolCallResult = (toolCallId: string) => {
    setExpandedToolCallResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const toggleTaskPlan = (messageId: string) => {
    setExpandedTaskPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        message.success(`${type}已复制到剪贴板`);
      }).catch(() => {
        fallbackCopyTextToClipboard(text, type);
      });
    } else {
      fallbackCopyTextToClipboard(text, type);
    }
  };

  const fallbackCopyTextToClipboard = (text: string, type: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success(`${type}已复制到剪贴板`);
      } else {
        message.error('复制失败，请手动复制');
      }
    } catch (err) {
      message.error('复制失败，请手动复制');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    
    // 保存原消息的文件信息
    const originalMessage = messages.find(m => m.id === messageId);
    if (originalMessage && originalMessage.extra_content && originalMessage.extra_content.files) {
      setEditingFiles(originalMessage.extra_content.files);
    } else {
      setEditingFiles([]);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
    setEditingFiles([]);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) {
      message.error('内容不能为空');
      return;
    }

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // 截取到编辑消息之前的消息
    const updatedMessages = messages.slice(0, messageIndex);
    
    setEditingMessageId(null);
    setEditingContent('');
    setInputValue('');
    
    // 直接调用 handleSendMessageWithMessages，它会处理用户消息的创建
    handleSendMessageWithMessages(updatedMessages, editingContent, messageId);
  };

  const handleSendMessageWithMessages = async (
    previousMessages: Message[],
    content: string,
    messageId?: string,
    extraContent?: any
  ) => {
    if (loading) return;

    let newMessages = [...previousMessages];
    let currentUserMessageId: string | undefined;
    let userMessageForId: Message | undefined;
    
    if (!messageId) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString()
      };
      currentUserMessageId = userMessage.id;
      userMessageForId = userMessage;
      newMessages = [...previousMessages, userMessage];
    } else {
      // 重新回答或编辑问题时，仍然创建临时用户消息，但保留 messageId 传给后端
      let finalExtraContent = undefined;
      
      // 检查是否有编辑文件
      if (editingFiles.length > 0) {
        finalExtraContent = { files: editingFiles };
      } else if (extraContent) {
        // 使用传入的 extraContent（重新回答时会传入）
        finalExtraContent = extraContent;
      } else {
        // 如果没有编辑文件，使用旧消息的 extra_content
        const lastOldUserMessage = previousMessages[previousMessages.length - 1];
        finalExtraContent = lastOldUserMessage?.extra_content;
      }
      
      const userMessage: Message = {
        id: Date.now().toString(),
        message_id: messageId,
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString(),
        extra_content: finalExtraContent
      };
      currentUserMessageId = userMessage.id;
      userMessageForId = userMessage;
      newMessages = [...previousMessages, userMessage];
    }
    
    setMessages(newMessages);
    setInputValue('');
    setLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'start',
      created_at: new Date().toISOString(),
      avatar: selectedChatbot?.avatar || (selectedModel?.provider ? getProviderAvatar(selectedModel.provider) : undefined)
    };
    setMessages(prev => [...prev, assistantMessage]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) {
      thinkingStartTimeRef.current[assistantMessageId] = Date.now();
    }

    try {
      // 检查是否需要发送文件
      let hasFiles = false;
      let query: QueryItem[] = [];
      
      if (messageId) {
        // 编辑模式：使用我们刚刚创建的用户消息
        const lastUserMessage = userMessageForId;
        
        // 添加用户文本消息到query
        if (lastUserMessage && lastUserMessage.content) {
          query.push({
            type: 'text',
            content: lastUserMessage.content
          });
        }
        
        // 添加文件信息到query
        if (lastUserMessage && lastUserMessage.extra_content && lastUserMessage.extra_content.files) {
          hasFiles = true;
          // 将FileInfo格式转换为QueryItem格式
          const fileQueryItems = lastUserMessage.extra_content.files.map((file: any) => {
            if (file.type === 'local') {
              return {
                type: 'file_base64',
                content: file.base64_content,
                mime_type: file.mime_type,
                file_name: file.file_name,
                file_size: file.file_size
              };
            } else if (file.type === 'datasource') {
              return {
                type: 'document',
                content: {
                  datasource_id: file.datasource_id,
                  bucket: file.bucket,
                  location: file.location,
                  file_name: file.file_name,
                  file_size: file.file_size
                }
              };
            }
            return file;
          });
          query = [...query, ...fileQueryItems];
        }
      }
      
      if (hasFiles && query.length > 0) {
        const idTracker = { assistant: assistantMessageId, user: messageId || currentUserMessageId };
        // 使用带文件的发送方法
        chatService.sendMessageStreamWithFiles(
          query,
          selectedModel?.id,
          selectedChatbot?.id,
          conversation?.id,
          { ...modelConfig, deep_thinking: deepThinking },
          messageId,
          systemPrompt,
          (data) => {
              // 对话隔离：只处理当前显示对话的消息
              if (currentChatIdRef.current !== conversation?.id) {
                return;
              }
              
              const status = data.status || 'running';
              const stepId = data.step_id;
              
              // 处理 error 状态：将错误内容显示到助手消息中，不抛出异常
              if (status === 'error') {
                setMessages(prev => {
                  // 先更新用户消息（如果有user_message_id）
                  let updatedMessages = prev;
                  if (data.user_message_id) {
                    updatedMessages = prev.map(msg => {
                      if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                        idTracker.user = data.user_message_id;
                        return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                      }
                      return msg;
                    });
                  }
                  
                  // 检查是否有对应的助手消息
                  const existingMsg = updatedMessages.find(msg => 
                    msg.role === 'assistant' && 
                    (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
                  );
                  
                  if (existingMsg) {
                    // 更新现有消息为错误状态
                    return updatedMessages.map(msg => {
                      if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                        return {
                          ...msg,
                          content: data.text || '抱歉，处理您的请求时出现错误。',
                          status: 'error',
                          reasoning_content: undefined,
                          reasoning_end: undefined
                        };
                      }
                      return msg;
                    });
                  } else {
                    // 创建新的错误消息
                    const errorMsg: Message = {
                      id: stepId || idTracker.assistant,
                      message_id: data.assistant_message_id,
                      role: 'assistant',
                      content: data.text || '抱歉，处理您的请求时出现错误。',
                      created_at: new Date().toISOString(),
                      status: 'error',
                      step: data.step,
                      step_id: stepId,
                      avatar: data.avatar
                    };
                    return [...updatedMessages, errorMsg];
                  }
                });
                // 不清理状态，等待 [DONE] 消息来处理最终状态
                return;
              }
              
              // 当收到status=start且有step_id时，处理消息新增或更新
              if (status === 'start' && stepId && data.step) {
                setMessages(prev => {
                  // 检查是否已有相同step_id的消息
                  const existingStepMsg = prev.find(msg => msg.step_id === stepId && msg.role === 'assistant');
                  if (existingStepMsg) {
                    // 已存在，更新该消息
                    return prev.map(msg => msg.step_id === stepId ? processSSEMessageUpdate(msg, data, idTracker) : msg);
                  }
                  
                  // 检查是否有初始的"思考中..."消息（没有step_id），需要移除它
                  const initialMsgIndex = prev.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
                  
                  // 新增具体步骤消息，使用stepId作为唯一标识，确保不同步骤的消息不混淆
                  const newStepMsg: Message = {
                    id: stepId,  // 使用stepId作为唯一标识，不使用assistant_message_id
                    message_id: data.assistant_message_id,
                    role: 'assistant',
                    content: '',
                    created_at: new Date().toISOString(),
                    status: 'start',
                    step: data.step,
                    step_id: stepId,
                    reasoning_content: '',
                    reasoning_end: false,
                    avatar: data.avatar,
                    tool_calls: []
                  };
                  
                  // 如果当前消息包含 tool_call 数据，立即添加到 tool_calls
                  if (data.tool_call) {
                    newStepMsg.tool_calls = [data.tool_call];
                  }
                  // 更新idTracker
                  if (data.assistant_message_id) {
                    idTracker.assistant = data.assistant_message_id;
                  }
                  
                  // 如果有初始"思考中"消息，移除它并新增具体步骤消息
                  if (initialMsgIndex >= 0) {
                    const newMessages = prev.filter((_, idx) => idx !== initialMsgIndex);
                    return [...newMessages, newStepMsg];
                  }
                  
                  return [...prev, newStepMsg];
                });
              } else {
                // 其他情况，更新现有消息
                setMessages(prev => prev.map(msg => processSSEMessageUpdate(msg, data, idTracker)));
              }
            },
          (error) => {
            console.error('Failed to send message:', error);
            const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
            message.error(errorMessage);

            setMessages(prev => prev.map(msg =>
              msg.id === idTracker.assistant
                ? {
                    ...msg,
                    content: `抱歉，发送消息时出现错误：${errorMessage}`,
                    reasoning_content: undefined
                  }
                : msg
            ));

            if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
              const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
              setThinkingDuration(prev => ({
                ...prev,
                [idTracker.assistant]: duration
              }));
            }
            // 将所有仍在运行中的消息（包括 error 状态）更新为 done，以便显示重新回答和复制按钮
            setMessages(prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            setLoading(false);
            setThinkingMessageId(null);
          },
          () => {
            if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
              const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
              setThinkingDuration(prev => ({
                ...prev,
                [idTracker.assistant]: duration
              }));
            }
            // 将所有仍在运行中的消息（包括 error 状态）更新为 done，以便显示重新回答和复制按钮
            setMessages(prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            setLoading(false);
            setThinkingMessageId(null);
          }
        );
      } else {
        const idTracker = { assistant: assistantMessageId, user: messageId || currentUserMessageId };
        // 使用普通发送方法
        chatService.sendMessageStream(
          content,
          selectedModel?.id,
          selectedChatbot?.id,
          conversation?.id,
          { ...modelConfig, deep_thinking: deepThinking },
          messageId,
          systemPrompt,
          (data) => {
            // 对话隔离：只处理当前显示对话的消息
            if (currentChatIdRef.current !== conversation?.id) {
              return;
            }
            
            const status = data.status || 'running';
            const stepId = data.step_id;
            
            // 处理 error 状态：将错误内容显示到助手消息中，不抛出异常
            if (status === 'error') {
              setMessages(prev => {
                // 先更新用户消息（如果有user_message_id）
                let updatedMessages = prev;
                if (data.user_message_id) {
                  updatedMessages = prev.map(msg => {
                    if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                      idTracker.user = data.user_message_id;
                      return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                    }
                    return msg;
                  });
                }
                
                // 检查是否有对应的助手消息
                const existingMsg = updatedMessages.find(msg => 
                  msg.role === 'assistant' && 
                  (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
                );
                
                if (existingMsg) {
                  // 更新现有消息为错误状态
                  return updatedMessages.map(msg => {
                    if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                      return {
                        ...msg,
                        content: data.text || '抱歉，处理您的请求时出现错误。',
                        status: 'error',
                        reasoning_content: undefined,
                        reasoning_end: undefined
                      };
                    }
                    return msg;
                  });
                } else {
                  // 创建新的错误消息
                  const errorMsg: Message = {
                    id: stepId || idTracker.assistant,
                    message_id: data.assistant_message_id,
                    role: 'assistant',
                    content: data.text || '抱歉，处理您的请求时出现错误。',
                    created_at: new Date().toISOString(),
                    status: 'error',
                    step: data.step,
                    step_id: stepId,
                    avatar: data.avatar
                  };
                  return [...updatedMessages, errorMsg];
                }
              });
              // 不清理状态，等待 [DONE] 消息来处理最终状态
              return;
            }
            
            // 当收到status=start且有step_id时，处理消息新增或更新
            if (status === 'start' && stepId && data.step) {
              setMessages(prev => {
                // 先更新用户消息（如果有user_message_id）
                let updatedMessages = prev;
                if (data.user_message_id) {
                  updatedMessages = prev.map(msg => {
                    if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                      idTracker.user = data.user_message_id;
                      return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                    }
                    return msg;
                  });
                }
                
                // 检查是否已有相同step_id的消息
                const existingStepMsg = updatedMessages.find(msg => msg.step_id === stepId && msg.role === 'assistant');
                if (existingStepMsg) {
                  // 已存在，更新该消息和用户消息
                  return updatedMessages.map(msg => {
                    if (msg.role === 'user') {
                      return processSSEMessageUpdate(msg, data, idTracker);
                    }
                    if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data, idTracker);
                    return msg;
                  });
                }
                
                // 检查是否有初始的"思考中..."消息（没有step_id），需要移除它
                const initialMsgIndex = updatedMessages.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
                
                // 新增具体步骤消息，使用stepId作为唯一标识，确保不同步骤的消息不混淆
                const newStepMsg: Message = {
                  id: stepId,  // 使用stepId作为唯一标识，不使用assistant_message_id
                  message_id: data.assistant_message_id,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                  status: 'start',
                  step: data.step,
                  step_id: stepId,
                  reasoning_content: '',
                  reasoning_end: false,
                  avatar: data.avatar
                };
                // 更新idTracker
                if (data.assistant_message_id) {
                  idTracker.assistant = data.assistant_message_id;
                }
                
                // 如果有初始"思考中"消息，移除它并新增具体步骤消息
                if (initialMsgIndex >= 0) {
                  const newMessages = updatedMessages.filter((_, idx) => idx !== initialMsgIndex);
                  return [...newMessages, newStepMsg];
                }
                
                return [...updatedMessages, newStepMsg];
              });
            } else {
              // 其他情况，更新现有消息
              setMessages(prev => prev.map(msg => processSSEMessageUpdate(msg, data, idTracker)));
            }
          },
          (error) => {
            console.error('Failed to send message:', error);
            const errorMessage = typeof error === 'string' ? error : (error?.message || error?.error || '发送失败，请重试');
            message.error(errorMessage);

            setMessages(prev => prev.map(msg =>
              msg.id === idTracker.assistant
                ? {
                    ...msg,
                    content: `抱歉，发送消息时出现错误：${errorMessage}`,
                    reasoning_content: undefined
                  }
                : msg
            ));

            if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
              const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
              setThinkingDuration(prev => ({
                ...prev,
                [idTracker.assistant]: duration
              }));
            }
            // 将所有仍在运行中的消息（包括 error 状态）更新为 done，以便显示重新回答和复制按钮
            setMessages(prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            setLoading(false);
            setThinkingMessageId(null);
          },
          () => {
            if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
              const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
              setThinkingDuration(prev => ({
                ...prev,
                [idTracker.assistant]: duration
              }));
            }
            // 将所有仍在运行中的消息（包括 error 状态）更新为 done，以便显示重新回答和复制按钮
            setMessages(prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            setLoading(false);
            setThinkingMessageId(null);
          }
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: '抱歉，生成回复时出现错误' }
          : msg
      ));
      setLoading(false);
      setThinkingMessageId(null);
    }
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;

    // 往上找最近的一个user消息（可能中间有tool消息）
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageIndex = i;
        break;
      }
    }
    
    if (userMessageIndex === -1) return;

    const userMessage = messages[userMessageIndex];

    // Remove all messages after and including the current assistant message
    // 同时也删除旧的用户消息，因为我们会在 handleSendMessageWithMessages 中添加新的用户消息
    const updatedMessages = messages.slice(0, userMessageIndex);
    
    // 直接调用 handleSendMessageWithMessages，它会处理消息添加
    // 使用 message_id（数据库中的真实ID）而不是前端临时生成的id
    handleSendMessageWithMessages(updatedMessages, userMessage.content, userMessage.message_id || userMessage.id, userMessage.extra_content);
  };

  const getChatbotAvatar = (chatbot: Chatbot): string => {
    if (chatbot.avatar) {
      return chatbot.avatar;
    }
    return getDefaultAvatar();
  };

  // 根据文件类型获取图标
  const getFileIcon = (fileName: string) => {
    if (!fileName) return <FileTextOutlined />;
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return <FileTextOutlined />;
    
    switch (extension) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ color: '#1890ff' }} />;
      case 'txt':
      case 'md':
      case 'json':
      case 'yaml':
      case 'yml':
      case 'xml':
      case 'csv':
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <FileImageOutlined style={{ color: '#722ed1' }} />;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
      case 'aac':
      case 'm4a':
      case 'aiff':
      case 'ape':
      case 'wma':
        return <SoundOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <FileTextOutlined />;
    }
  };

  const renderConfigParam = (param: ConfigParam) => {
    const value = modelConfig[param.key] ?? param.default;
    
    switch (param.type) {
      case 'slider':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider
                style={{ flex: 1 }}
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              />
              <InputNumber
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
                style={{ width: 80 }}
              />
            </div>
          </div>
        );
      case 'input':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <Input
              value={value}
              onChange={(e) => setModelConfig({ ...modelConfig, [param.key]: e.target.value })}
            />
          </div>
        );
      case 'switch':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
                <Tooltip title={param.description}>
                  <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
                </Tooltip>
              </div>
              <Switch
                checked={value}
                onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              />
            </div>
          </div>
        );
      case 'select':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <Select
              value={value}
              onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              style={{ width: '100%' }}
            >
              {param.options?.map(opt => (
                <Select.Option key={opt} value={opt}>{opt}</Select.Option>
              ))}
            </Select>
          </div>
        );
      case 'number':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}>
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <InputNumber
              min={param.min}
              max={param.max}
              step={param.step || 1}
              value={value}
              onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })}
              style={{ width: '100%' }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const currentConfigParams = configParams[selectedModel?.model_type || 'text'] || [];

  const handleSelectModel = (model: LLMModel) => {
    setSelectedModel(model);
    setSelectedChatbot(null);
    setSelectedType('model');
    if (model.config) {
      setModelConfig(model.config);
    } else {
      setModelConfig({});
    }
  };

  const handleSelectChatbot = (chatbot: Chatbot) => {
    setSelectedChatbot(chatbot);
    setSelectedModel(null);
    setSelectedType('chatbot');
  };

  const getDropdownItems = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [];

    if (models.length > 0) {
      items.push({
        key: 'model-group',
        type: 'group',
        label: (
          <div className={`dropdown-group-label ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span>模型</span>
          </div>
        ),
      });
      
      models.forEach((model) => {
        items.push({
          key: `model-${model.id}`,
          label: (
            <div 
              className={`dropdown-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedModel?.id === model.id ? 'selected' : ''}`}
            >
              <img 
                src={getProviderAvatar(model.provider)} 
                alt={model.provider} 
                className="dropdown-item-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
              <div className="dropdown-item-content">
                <div className="dropdown-item-name">{model.name}</div>
                <div className="dropdown-item-provider">
                  <span className="dropdown-item-tag">{model.model_type || 'text'}</span>
                  {model.tags && model.tags.split(',').map((tag, index) => (
                    <span key={index} className="dropdown-item-tag">{tag.trim()}</span>
                  ))}
                </div>
              </div>
              {selectedModel?.id === model.id && (
                <span className="dropdown-item-check">✓</span>
              )}
            </div>
          ),
          onClick: () => handleSelectModel(model),
        });
      });
    }

    if (chatbots.length > 0) {
      items.push({
        key: 'chatbot-group',
        type: 'group',
        label: (
          <div className={`dropdown-group-label ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span>机器人</span>
          </div>
        ),
      });
      
      chatbots.forEach((chatbot) => {
        items.push({
          key: `chatbot-${chatbot.id}`,
          label: (
            <div 
              className={`dropdown-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedChatbot?.id === chatbot.id ? 'selected' : ''}`}
            >
              <img 
                src={getChatbotAvatar(chatbot)} 
                alt={chatbot.name} 
                className="dropdown-item-avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
              <div className="dropdown-item-content">
                <div className="dropdown-item-name">{chatbot.name}</div>
                {chatbot.description && (
                  <div className="dropdown-item-provider">{chatbot.description}</div>
                )}
              </div>
              {selectedChatbot?.id === chatbot.id && (
                <span className="dropdown-item-check">✓</span>
              )}
            </div>
          ),
          onClick: () => handleSelectChatbot(chatbot),
        });
      });
    }

    return items;
  };

  const getCurrentSelection = () => {
    if (selectedType === 'model' && selectedModel) {
      return {
        avatar: getProviderAvatar(selectedModel.provider),
        name: selectedModel.name,
        type: 'model' as const
      };
    }
    if (selectedType === 'chatbot' && selectedChatbot) {
      return {
        avatar: getChatbotAvatar(selectedChatbot),
        name: selectedChatbot.name,
        type: 'chatbot' as const
      };
    }
    return null;
  };

  const currentSelection = getCurrentSelection();
  const hasModelsOrChatbots = models.length > 0 || chatbots.length > 0;

  const groupMessagesByAssistantId = () => {
    const groups: { assistantId: string; messages: Message[] }[] = [];
    let currentGroup: { assistantId: string; messages: Message[] } | null = null;
    
    messages.forEach((msg) => {
      if (msg.role === 'user') {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groups.push({ assistantId: '', messages: [msg] });
      } else if (msg.role === 'assistant') {
        const assistantId = msg.message_id || msg.id;
        if (currentGroup && currentGroup.assistantId === assistantId) {
          currentGroup.messages.push(msg);
        } else {
          if (currentGroup) {
            groups.push(currentGroup);
          }
          currentGroup = { assistantId, messages: [msg] };
        }
      } else if (msg.role === 'tool') {
        if (currentGroup) {
          currentGroup.messages.push(msg);
        } else {
          groups.push({ assistantId: '', messages: [msg] });
        }
      }
    });
    
    if (currentGroup) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const renderAssistantMessageContent = (msg: Message) => {
    if (msg.role !== 'assistant') return null;

    return (
      <>
        {/* 分析问题阶段 */}
        {(msg.step === 'analyze_query' || msg.extra_content?.step === 'analyze_query') && (
          <>
            {msg.status === 'start' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>分析问题中...</span>
                </div>
              </div>
            )}
            {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>分析问题中</span>
                  {thinkingDuration[msg.step_id || msg.id] && (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>分析问题</span>
                  {msg.reasoning_time != null ? (
                    <span className="reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  ) : thinkingDuration[msg.step_id || msg.id] ? (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  ) : null}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 用户发送消息后，在获取后端接口返回之前默认显示 等待转换图标 + "思考中..." */}
        {/* 只有当消息没有任何步骤信息时才显示默认的"思考中..." */}
        {msg.status === 'start' && !msg.step && !msg.extra_content?.step && !msg.step_id && (
          <div className="message-reasoning">
            <div className="reasoning-header">
              <LoadingOutlined spin />
              <BulbOutlined />
              <span>思考中...</span>
            </div>
          </div>
        )}

        {/* 任务规划阶段 */}
        {(msg.step === 'task_planning' || msg.extra_content?.step === 'task_planning') && (
          <>
            {msg.status === 'start' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>任务规划中...</span>
                </div>
              </div>
            )}
            {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>任务规划中</span>
                  {thinkingDuration[msg.step_id || msg.id] && (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
              <div className={`message-reasoning ${theme === 'dark' ? 'dark' : 'light'}`}>
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>任务规划</span>
                  {msg.reasoning_time != null ? (
                    <span className="reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  ) : thinkingDuration[msg.step_id || msg.id] ? (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  ) : null}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
                {msg.task_plan && msg.task_plan.length > 0 && (
                  <div className="reasoning-text">
                    <div className="task-plan-list">
                      {msg.task_plan.map((task) => (
                        <div key={task.id} className="task-item">
                          <div className={`task-status ${task.status}`}>
                            {task.status === 'done' ? '✓' : task.status === 'running' ? <LoadingOutlined spin style={{ fontSize: 12 }} /> : '○'}
                          </div>
                          <div className="task-content">
                            <div className="task-name">{task.name}</div>
                            <div className="task-description">{task.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 预处理阶段 */}
        {(msg.step === 'pre_process' || msg.extra_content?.step === 'pre_process') && (
          <>
            {msg.status === 'start' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <LoadingOutlined spin />
                  <span>正在预处理...</span>
                </div>
              </div>
            )}
            {msg.status === 'done' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <CheckCircleOutlined />
                  <span>预处理完成</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 任务列表阶段 - 使用步骤条组件展示 */}
        {(msg.step === 'task_list' || msg.extra_content?.step === 'task_list') && (
          <>
            {msg.status === 'start' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <FileTextOutlined />
                  <span>任务列表</span>
                </div>
              </div>
            )}
            {msg.task_plan && msg.task_plan.length > 0 && (
              <div className="message-reasoning">
                <div className="task-list-container">
                  <div className="task-list-header" onClick={() => toggleTaskPlan(msg.step_id || msg.id)}>
                    <FileTextOutlined />
                    <span>任务列表</span>
                    <DownOutlined className={`expand-icon ${expandedTaskPlans.has(msg.step_id || msg.id) ? 'expanded' : ''}`} />
                  </div>
                  {expandedTaskPlans.has(msg.step_id || msg.id) && (
                    <div className="task-list-steps">
                      {msg.task_plan.map((task, index) => (
                        <div key={task.id} className="task-step-item">
                          <div className="step-connector">
                            <div className={`step-icon ${task.status}`}>
                              {task.status === 'done' ? <CheckCircleOutlined /> : task.status === 'running' ? <LoadingOutlined spin /> : <ClockCircleOutlined />}
                            </div>
                            {index < msg.task_plan.length - 1 && (
                              <div className={`step-line ${task.status === 'done' ? 'done' : ''}`} />
                            )}
                          </div>
                          <div className="step-content">
                            <div className="step-name">{task.name}</div>
                            <div className="step-description">{task.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* 模型回答阶段 */}
        {(msg.step === 'model_answer' || msg.extra_content?.step === 'model_answer') && (
          <>
            {msg.status === 'start' && (
              <div className="message-reasoning">
                <div className="reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>正在思考中...</span>
                </div>
              </div>
            )}
            {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>正在思考中</span>
                  {thinkingDuration[msg.step_id || msg.id] && (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>思考过程</span>
                  {msg.reasoning_time != null ? (
                    <span className="reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  ) : thinkingDuration[msg.step_id || msg.id] ? (
                    <span className="reasoning-duration">
                      ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                    </span>
                  ) : null}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {msg.content && (msg.status !== 'start' || !msg.status) && (
              <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor.Markdown
                  source={msg.content}
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            )}
          </>
        )}

        {/* 工具调用阶段 */}
        {(msg.step === 'tool_call' || msg.extra_content?.step === 'tool_call') && msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="tool-calls-container">
            {msg.tool_calls.map((tc, tcIndex) => (
              <div key={tc.tool_call_id || `tc-${tcIndex}`} className={`tool-call-card tool-call-${tc.status}`}>
                <div className="tool-call-header" onClick={() => toggleToolCall(tc.tool_call_id || `tc-${tcIndex}`)}>
                  <div className="tool-call-header-left">
                    {tc.status === 'start' && <LoadingOutlined spin className="tool-call-icon-start" />}
                    {tc.status === 'running' && <LoadingOutlined spin className="tool-call-icon-running" />}
                    {tc.status === 'success' && <span className="tool-call-icon-success">✓</span>}
                    {tc.status === 'error' && <span className="tool-call-icon-error">✗</span>}
                    {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                      <DownOutlined style={{ fontSize: 10 }} />
                    ) : (
                      <RightOutlined style={{ fontSize: 10 }} />
                    )}
                    {tc.task_name && <span className="tool-call-task-name">{tc.task_name}</span>}
                  </div>
                  <div className="tool-call-header-right">
                    {tc.elapsed_ms != null && tc.elapsed_ms > 0 && (
                      <span className="tool-call-elapsed">
                        {(tc.elapsed_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
                {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                  <div className="tool-call-content">
                    {/* 思考过程 - 直接展示内容，不显示标题文字 */}
                    {tc.reasoning_content && (
                      <div className={`tool-call-reasoning-text ${theme === 'dark' ? 'dark' : 'light'}`}>
                        <MDEditor.Markdown
                          source={tc.reasoning_content}
                          className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                        />
                      </div>
                    )}
                    {/* 工具结果展开收起 */}
                    {(tc.message || tc.result) && (
                      <>
                        {/* 分隔线 */}
                        {tc.reasoning_content && <div className="tool-call-divider" />}
                        {/* 工具结果头部 */}
                        <div 
                          className="tool-call-result-header" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleToolCallResult(tc.tool_call_id || `tc-${tcIndex}`);
                          }}
                        >
                          {expandedToolCallResults.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                            <DownOutlined style={{ fontSize: 10 }} />
                          ) : (
                            <RightOutlined style={{ fontSize: 10 }} />
                          )}
                          <span className="tool-call-result-title">工具结果</span>
                        </div>
                        {/* 工具结果内容 */}
                        {expandedToolCallResults.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                          <>
                            {/* 工具调用消息 */}
                            {tc.message && (
                              <div className={`tool-call-message ${theme === 'dark' ? 'dark' : 'light'}`}>
                                <MDEditor.Markdown
                                  source={tc.message}
                                  className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                                />
                              </div>
                            )}
                            {/* 工具调用结果 */}
                            {tc.result && (
                              <div className={`tool-call-result ${theme === 'dark' ? 'dark' : 'light'}`}>
                                <MDEditor.Markdown
                                  source={typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                                  className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 任务执行阶段 */}
        {(msg.step === 'task_execution' || msg.extra_content?.step === 'task_execution') && msg.tool_calls && msg.tool_calls.length > 0 && (
          <div className="tool-calls-container">
            {msg.tool_calls.map((tc, tcIndex) => (
              <div key={tc.tool_call_id || `tc-${tcIndex}`} className={`tool-call-card tool-call-${tc.status}`}>
                <div className="tool-call-header" onClick={() => toggleToolCall(tc.tool_call_id || `tc-${tcIndex}`)}>
                  <div className="tool-call-header-left">
                    {tc.status === 'start' && <LoadingOutlined spin className="tool-call-icon-start" />}
                    {tc.status === 'running' && <LoadingOutlined spin className="tool-call-icon-running" />}
                    {tc.status === 'success' && <span className="tool-call-icon-success">✓</span>}
                    {tc.status === 'error' && <span className="tool-call-icon-error">✗</span>}
                    {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                      <DownOutlined style={{ fontSize: 10 }} />
                    ) : (
                      <RightOutlined style={{ fontSize: 10 }} />
                    )}
                    {tc.task_name && <span className="tool-call-task-name">{tc.task_name}</span>}
                  </div>
                  <div className="tool-call-header-right">
                    {tc.elapsed_ms != null && tc.elapsed_ms > 0 && (
                      <span className="tool-call-elapsed">
                        {(tc.elapsed_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
                {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                  <div className="tool-call-content">
                    {tc.message && (
                      <div className={`tool-call-message ${theme === 'dark' ? 'dark' : 'light'}`}>
                        <MDEditor.Markdown
                          source={tc.message}
                          className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                        />
                      </div>
                    )}
                    {tc.result && (
                      <div className={`tool-call-result ${theme === 'dark' ? 'dark' : 'light'}`}>
                        <MDEditor.Markdown
                          source={JSON.stringify(tc.result, null, 2)}
                          className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 结果总结阶段 */}
        {(msg.step === 'result_summary' || msg.extra_content?.step === 'result_summary') && msg.content && (msg.status !== 'start' || !msg.status) && (
          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
            <MDEditor.Markdown
              source={msg.content}
              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
            />
          </div>
        )}

        {/* 没有step的情况，显示内容和思考过程 */}
        {!msg.step && !msg.extra_content?.step && (
          <>
            {/* 历史消息显示思考过程 */}
            {(!msg.status || msg.status === 'done' || msg.status === 'stop') && msg.reasoning_content && (
              <div className="message-reasoning">
                <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>思考过程</span>
                  {msg.reasoning_time != null && (
                    <span className="reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="reasoning-text">
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.reasoning_content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {msg.content && (msg.status !== 'start' || !msg.status) && (
              <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor.Markdown
                  source={msg.content}
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderGroupedMessages = () => {
    const groups = groupMessagesByAssistantId();
    return groups.map((group, groupIndex) => {
      if (!group.assistantId) {
        // 用户消息组
        const msg = group.messages[0];
        return renderMessage(msg, groupIndex);
      }
      
      // 助手消息组
      return (
        <div key={group.assistantId} className="message assistant">
          <div className={`message-avatar ${theme === 'dark' ? 'dark' : 'light'}`}>
            <img 
              src={resolveAvatarPath(group.messages[0]?.avatar) || currentSelection?.avatar || getDefaultAvatar()} 
              alt="AI" 
              className="avatar-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getDefaultAvatar();
              }}
            />
          </div>
          <div className="message-content">
            {group.messages.map((msg, msgIndex) => (
              <div 
                key={msg.step_id || msg.id || msgIndex}
                id={msg.step_id || undefined}
                className="step-container"
              >
                {msg.role === 'tool' ? renderToolMessage(msg) : renderAssistantMessageContent(msg)}
              </div>
            ))}
            <div className="message-footer">
              <span className="message-time">
                {group.messages[0]?.created_at ? new Date(group.messages[0].created_at).toLocaleString('zh-CN', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit',
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false 
                }) : ''}
              </span>
              <div className="message-actions">
                {group.assistantId && (
                  <>
                    {/* 检查group中是否有消息还在运行中（status不是done或stop） */}
                    {group.messages.some(m => m.status && m.status !== 'done' && m.status !== 'stop') ? (
                      <Tooltip title="正在生成中">
                        <Button
                          type="text"
                          size="small"
                          icon={<LoadingOutlined spin />}
                        />
                      </Tooltip>
                    ) : (
                      group.messages.some(m => m.content) && (
                        <>
                          <Tooltip title="重新回答">
                            <Button
                              type="text"
                              size="small"
                              icon={<ReloadOutlined />}
                              onClick={() => handleRegenerate(groupIndex)}
                            />
                          </Tooltip>
                          <Tooltip title="复制回答">
                            <Button
                              type="text"
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => {
                                const content = group.messages.map(m => m.content).filter(Boolean).join('\n');
                                copyToClipboard(content, '回答');
                              }}
                            />
                          </Tooltip>
                        </>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderToolMessage = (msg: Message) => {
    const toolCall = msg.extra_content?.tool_call;
    const toolCallId = toolCall?.tool_call_id || msg.id;
    const hasReasoning = toolCall?.reasoning_content;
    const hasResult = toolCall?.result != null;
    const hasMessage = msg.content;

    return (
      <div className={`tool-call-card tool-call-${toolCall?.status || 'success'}`}>
        <div className="tool-call-header" onClick={() => toggleToolCall(toolCallId)}>
          <div className="tool-call-header-left">
            {toolCall?.status === 'start' && <LoadingOutlined spin className="tool-call-icon-start" />}
            {toolCall?.status === 'running' && <LoadingOutlined spin className="tool-call-icon-running" />}
            {toolCall?.status === 'success' && <span className="tool-call-icon-success">✓</span>}
            {toolCall?.status === 'error' && <span className="tool-call-icon-error">✗</span>}
            {expandedToolCalls.has(toolCallId) ? (
              <DownOutlined style={{ fontSize: 10 }} />
            ) : (
              <RightOutlined style={{ fontSize: 10 }} />
            )}
            <span className="tool-call-task-name">{toolCall?.task_name || toolCall?.name || '工具调用'}</span>
          </div>
          <div className="tool-call-header-right">
            {toolCall?.elapsed_ms != null && toolCall.elapsed_ms > 0 && (
              <span className="tool-call-elapsed">
                {(toolCall.elapsed_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
        {expandedToolCalls.has(toolCallId) && (
          <div className="tool-call-content">
            {hasReasoning && (
              <div className={`tool-call-reasoning-text ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor.Markdown
                  source={toolCall.reasoning_content}
                  className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            )}
            {(hasMessage || hasResult) && (
              <>
                {hasReasoning && <div className="tool-call-divider" />}
                <div 
                  className="tool-call-result-header" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleToolCallResult(toolCallId);
                  }}
                >
                  {expandedToolCallResults.has(toolCallId) ? (
                    <DownOutlined style={{ fontSize: 10 }} />
                  ) : (
                    <RightOutlined style={{ fontSize: 10 }} />
                  )}
                  <span className="tool-call-result-title">工具结果</span>
                </div>
                {expandedToolCallResults.has(toolCallId) && (
                  <>
                    {hasMessage && (
                      <div className={`tool-call-message ${theme === 'dark' ? 'dark' : 'light'}`}>
                        <MDEditor.Markdown
                          source={msg.content}
                          className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                        />
                      </div>
                    )}
                    {hasResult && (
                      <div className={`tool-call-result ${theme === 'dark' ? 'dark' : 'light'}`}>
                        <MDEditor.Markdown
                          source={typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
                          className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMessage = (msg: Message, index: number) => {
    if (msg.role === 'tool') {
      return (
        <div 
          key={msg.id} 
          id={msg.step_id || undefined}
          className={`message tool`}
        >
          <div className="message-content">
            {renderToolMessage(msg)}
          </div>
        </div>
      );
    }
    
    const isUser = msg.role === 'user';
    
    let files: FileInfo[] = [];
    if (msg.extra_content && msg.extra_content.files) {
      files = msg.extra_content.files.map((file: any) => ({
        type: file.type,
        file_name: file.file_name,
        file_size: file.file_size,
        base64_content: file.type === 'local' ? file.base64_content : undefined,
        datasource_id: file.type === 'datasource' ? file.datasource_id : undefined,
        bucket: file.type === 'datasource' ? file.bucket : undefined,
        location: file.type === 'datasource' ? file.location : undefined
      }));
    }
    
    return (
      <div 
        key={msg.id} 
        id={msg.step_id || undefined}
        className={`message ${msg.role}`}
      >
        <div className={`message-avatar ${theme === 'dark' ? 'dark' : 'light'}`}>
          {isUser ? '👤' : (
            <img 
              src={resolveAvatarPath(msg.avatar) || currentSelection?.avatar || getDefaultAvatar()} 
              alt="AI" 
              className="avatar-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getDefaultAvatar();
              }}
            />
          )}
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && (
            <>
              {/* 分析问题阶段 */}
              {(msg.step === 'analyze_query' || msg.extra_content?.step === 'analyze_query') && (
                <>
                  {msg.status === 'start' && (
                    <div className="message-reasoning">
                      <div className="reasoning-header">
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>分析问题中...</span>
                      </div>
                    </div>
                  )}
                  {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>分析问题中</span>
                        {thinkingDuration[msg.step_id || msg.id] && (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        {expandedReasoning.has(msg.step_id || msg.id) ? (
                          <DownOutlined />
                        ) : (
                          <RightOutlined />
                        )}
                        <BulbOutlined />
                        <span>分析问题</span>
                        {msg.reasoning_time != null ? (
                          <span className="reasoning-duration">
                            ({(msg.reasoning_time / 1000).toFixed(1)}s)
                          </span>
                        ) : thinkingDuration[msg.step_id || msg.id] ? (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        ) : null}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* 用户发送消息后，在获取后端接口返回之前默认显示 等待转换图标 + "思考中..." */}
              {/* 只有当消息没有任何步骤信息时才显示默认的"思考中..." */}
              {msg.status === 'start' && !msg.step && !msg.extra_content?.step && !msg.step_id && (
                <div className="message-reasoning">
                  <div className="reasoning-header">
                    <LoadingOutlined spin />
                    <BulbOutlined />
                    <span>思考中...</span>
                  </div>
                </div>
              )}

              {/* 预处理阶段 */}
              {(msg.step === 'pre_process' || msg.extra_content?.step === 'pre_process') && (
                <>
                  {msg.status === 'start' && (
                    <div className="message-reasoning">
                      <div className="reasoning-header">
                        <LoadingOutlined spin />
                        <span>正在预处理...</span>
                      </div>
                    </div>
                  )}
                  {msg.status === 'done' && (
                    <div className="message-reasoning">
                      <div className="reasoning-header">
                        <CheckCircleOutlined />
                        <span>预处理完成</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 任务规划阶段 */}
              {(msg.step === 'task_planning' || msg.extra_content?.step === 'task_planning') && (
                <>
                  {msg.status === 'start' && (
                    <div className="message-reasoning">
                      <div className="reasoning-header">
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>任务规划中...</span>
                      </div>
                    </div>
                  )}
                  {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>任务规划中</span>
                        {thinkingDuration[msg.step_id || msg.id] && (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
                    <div className={`message-reasoning ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        {expandedReasoning.has(msg.step_id || msg.id) ? (
                          <DownOutlined />
                        ) : (
                          <RightOutlined />
                        )}
                        <BulbOutlined />
                        <span>任务规划</span>
                        {msg.reasoning_time != null ? (
                          <span className="reasoning-duration">
                            ({(msg.reasoning_time / 1000).toFixed(1)}s)
                          </span>
                        ) : thinkingDuration[msg.step_id || msg.id] ? (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        ) : null}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.task_plan && msg.task_plan.length > 0 && (msg.status === 'done' || msg.status === 'stop' || !msg.status) && (
                    <div className={`message-reasoning ${theme === 'dark' ? 'dark' : 'light'}`} style={{ marginTop: 8 }}>
                      <div className="reasoning-header" onClick={() => toggleTaskPlan(msg.id)}>
                        {expandedTaskPlans.has(msg.id) ? (
                          <DownOutlined />
                        ) : (
                          <RightOutlined />
                        )}
                        <BulbOutlined />
                        <span>任务步骤条</span>
                        <span className="reasoning-duration">({msg.task_plan.length}个任务)</span>
                      </div>
                      {expandedTaskPlans.has(msg.id) && (
                        <div className="reasoning-text">
                          <div className="task-plan-steps">
                            {msg.task_plan.map((task, taskIndex) => (
                              <div key={task.id || `task-${taskIndex}`} className={`task-step task-step-${task.status}`}>
                                <div className="task-step-icon">
                                  {task.status === 'pending' && <span className="step-icon-pending">○</span>}
                                  {task.status === 'running' && <LoadingOutlined spin className="step-icon-running" />}
                                  {task.status === 'done' && <span className="step-icon-done">✓</span>}
                                </div>
                                <div className="task-step-content">
                                  <div className="task-step-name">{task.name}</div>
                                  {task.description && (
                                  <div className="task-step-description">{task.description}</div>
                                )}
                              </div>
                              {taskIndex < (msg.task_plan?.length || 0) - 1 && (
                                <div className="task-step-connector" />
                              )}
                            </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* 模型回答阶段 */}
              {(msg.step === 'model_answer' || msg.extra_content?.step === 'model_answer') && (
                <>
                  {msg.status === 'start' && (
                    <div className="message-reasoning">
                      <div className="reasoning-header">
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>正在思考中...</span>
                      </div>
                    </div>
                  )}
                  {msg.status === 'running' && msg.reasoning_content && !msg.reasoning_end && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        <LoadingOutlined spin />
                        <BulbOutlined />
                        <span>正在思考中</span>
                        {thinkingDuration[msg.step_id || msg.id] && (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(msg.status !== 'start' || !msg.status) && msg.reasoning_content && (msg.reasoning_end || msg.status === 'done' || msg.status === 'stop') && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        {expandedReasoning.has(msg.step_id || msg.id) ? (
                          <DownOutlined />
                        ) : (
                          <RightOutlined />
                        )}
                        <BulbOutlined />
                        <span>思考过程</span>
                        {msg.reasoning_time != null ? (
                          <span className="reasoning-duration">
                            ({(msg.reasoning_time / 1000).toFixed(1)}s)
                          </span>
                        ) : thinkingDuration[msg.step_id || msg.id] ? (
                          <span className="reasoning-duration">
                            ({(thinkingDuration[msg.step_id || msg.id] / 1000).toFixed(1)}s)
                          </span>
                        ) : null}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.content && (msg.status !== 'start' || !msg.status) && (
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  )}
                </>
              )}

              {/* 任务执行阶段 */}
              {(msg.step === 'task_execution' || msg.extra_content?.step === 'task_execution') && msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="tool-calls-container">
                  {msg.tool_calls.map((tc, tcIndex) => (
                    <div key={tc.tool_call_id || `tc-${tcIndex}`} className={`tool-call-card tool-call-${tc.status}`}>
                      <div className="tool-call-header" onClick={() => toggleToolCall(tc.tool_call_id || `tc-${tcIndex}`)}>
                        <div className="tool-call-header-left">
                          {tc.status === 'start' && <LoadingOutlined spin className="tool-call-icon-start" />}
                          {tc.status === 'running' && <LoadingOutlined spin className="tool-call-icon-running" />}
                          {tc.status === 'success' && <span className="tool-call-icon-success">✓</span>}
                          {tc.status === 'error' && <span className="tool-call-icon-error">✗</span>}
                          {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) ? (
                            <DownOutlined style={{ fontSize: 10 }} />
                          ) : (
                            <RightOutlined style={{ fontSize: 10 }} />
                          )}
                          <span className="tool-call-name">{tc.name}</span>
                          {tc.task_name && <span className="tool-call-task-name">: {tc.task_name}</span>}
                        </div>
                        <div className="tool-call-header-right">
                          {tc.elapsed_ms != null && tc.elapsed_ms > 0 && (
                            <span className="tool-call-elapsed">
                              {tc.elapsed_ms >= 1000
                                ? `${(tc.elapsed_ms / 1000).toFixed(1)}s`
                                : `${tc.elapsed_ms}ms`}
                            </span>
                          )}
                        </div>
                      </div>
                      {expandedToolCalls.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                        <div className="tool-call-body">
                          {tc.status === 'start' && (
                            <div className="tool-call-start-text">准备调用工具...</div>
                          )}
                          {tc.status === 'running' && (
                            <div className="tool-call-running-text">正在执行工具调用...</div>
                          )}
                          {tc.status === 'success' && tc.result != null && (
                            <div className="tool-call-result">
                              <pre>{typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}</pre>
                            </div>
                          )}
                          {tc.status === 'error' && tc.message && (
                            <div className="tool-call-error-text">{tc.message}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 结果总结阶段 */}
              {(msg.step === 'result_summary' || msg.extra_content?.step === 'result_summary') && msg.content && (msg.status !== 'start' || !msg.status) && (
                <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                  <MDEditor.Markdown
                    source={msg.content}
                    className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                  />
                </div>
              )}

              {/* 没有step的情况，显示内容和思考过程 */}
              {!msg.step && !msg.extra_content?.step && (
                <>
                  {/* 历史消息显示思考过程 */}
                  {(!msg.status || msg.status === 'done' || msg.status === 'stop') && msg.reasoning_content && (
                    <div className="message-reasoning">
                      <div className="reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                        {expandedReasoning.has(msg.step_id || msg.id) ? (
                          <DownOutlined />
                        ) : (
                          <RightOutlined />
                        )}
                        <BulbOutlined />
                        <span>思考过程</span>
                        {msg.reasoning_time != null && (
                          <span className="reasoning-duration">
                            ({(msg.reasoning_time / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </div>
                      {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                        <div className="reasoning-text">
                          <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                            <MDEditor.Markdown
                              source={msg.reasoning_content}
                              className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.content && (msg.status !== 'start' || !msg.status) && (
                    <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                      <MDEditor.Markdown
                        source={msg.content}
                        className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
          
          {/* 用户消息显示内容 */}
          {editingMessageId === msg.id ? (
            <>
              {/* 显示文件列表（在编辑框上方） */}
              {editingFiles.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editingFiles.map((file, index) => {
                    // 计算文件大小（使用实际文件大小）
                    let fileSize = '';
                    if (file.file_size) {
                      const size = file.file_size;
                      if (size < 1024) {
                        fileSize = `${size.toFixed(0)} B`;
                      } else if (size < 1024 * 1024) {
                        fileSize = `${(size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    } else if (file.base64_content) {
                      // Base64 编码的文件大小（作为后备）
                      const base64Size = file.base64_content.length * 3 / 4;
                      if (base64Size < 1024) {
                        fileSize = `${base64Size.toFixed(0)} B`;
                      } else if (base64Size < 1024 * 1024) {
                        fileSize = `${(base64Size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(base64Size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    }
                    
                    // 获取文件扩展名
                    const fileName = file.file_name || '';
                    const extension = fileName.split('.').pop()?.toUpperCase() || '';
                    
                    return (
                      <div
                        key={fileName || `file-${index}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 6,
                          backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ marginRight: 12, fontSize: 20 }}>
                          {getFileIcon(fileName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: 14, 
                            fontWeight: 500, 
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {fileName}
                          </div>
                          <div style={{ 
                            fontSize: 12, 
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                          }}>
                            {extension} {fileSize ? `· ${fileSize}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="message-edit-area">
                <TextArea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  style={{ width: '100%' }}
                />
                <div className="edit-actions">
                  <Button size="small" onClick={handleCancelEdit}>取消</Button>
                  <Button size="small" type="primary" onClick={() => handleSaveEdit(msg.id)}>发送</Button>
                </div>
              </div>
            </>
          ) : isUser && msg.content ? (
            <>
              {/* 显示文件列表（在文本消息上方） */}
              {files.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {files.map((file, index) => {
                    // 计算文件大小（使用实际文件大小）
                    let fileSize = '';
                    if (file.file_size) {
                      const size = file.file_size;
                      if (size < 1024) {
                        fileSize = `${size.toFixed(0)} B`;
                      } else if (size < 1024 * 1024) {
                        fileSize = `${(size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    } else if (file.base64_content) {
                      // Base64 编码的文件大小（作为后备）
                      const base64Size = file.base64_content.length * 3 / 4;
                      if (base64Size < 1024) {
                        fileSize = `${base64Size.toFixed(0)} B`;
                      } else if (base64Size < 1024 * 1024) {
                        fileSize = `${(base64Size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(base64Size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    }
                    
                    // 获取文件扩展名
                    const fileName = file.file_name || '';
                    const extension = fileName.split('.').pop()?.toUpperCase() || '';
                    
                    return (
                      <div
                        key={fileName || `file-${index}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 6,
                          backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                          border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ marginRight: 12, fontSize: 20 }}>
                          {getFileIcon(fileName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: 14, 
                            fontWeight: 500, 
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {fileName}
                          </div>
                          <div style={{ 
                            fontSize: 12, 
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                          }}>
                            {extension} {fileSize ? `· ${fileSize}` : ''}
                          </div>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownloadFile(file)}
                          style={{
                            color: theme === 'dark' ? 'var(--primary-color)' : '#1890ff'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 显示用户消息内容 */}
              <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor.Markdown
                  source={msg.content}
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            </>
          ) : null}
          
          {/* 显示文件列表 */}
          {!isUser && files.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {files.map((file, fileIndex) => {
                  // 计算文件大小（使用实际文件大小）
                  let fileSize = '';
                  if (file.file_size) {
                    const size = file.file_size;
                    if (size < 1024) {
                      fileSize = `${size.toFixed(0)} B`;
                    } else if (size < 1024 * 1024) {
                      fileSize = `${(size / 1024).toFixed(2)} KB`;
                    } else {
                      fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                    }
                  } else if (file.base64_content) {
                    // Base64 编码的文件大小（作为后备）
                    const base64Size = file.base64_content.length * 3 / 4;
                    if (base64Size < 1024) {
                      fileSize = `${base64Size.toFixed(0)} B`;
                    } else if (base64Size < 1024 * 1024) {
                      fileSize = `${(base64Size / 1024).toFixed(2)} KB`;
                    } else {
                      fileSize = `${(base64Size / (1024 * 1024)).toFixed(2)} MB`;
                    }
                  }
                  
                  // 获取文件扩展名
                  const fileName = file.file_name || '';
                  const extension = fileName.split('.').pop()?.toUpperCase() || '';
                  
                  return (
                    <div
                      key={fileName || `file-${fileIndex}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: 6,
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ marginRight: 12, fontSize: 20 }}>
                        {getFileIcon(fileName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: 14, 
                          fontWeight: 500, 
                          marginBottom: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {fileName}
                        </div>
                        <div style={{ 
                          fontSize: 12, 
                          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)'
                        }}>
                          {extension} {fileSize ? `· ${fileSize}` : ''}
                        </div>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownloadFile(file)}
                        style={{
                          color: theme === 'dark' ? 'var(--primary-color)' : '#1890ff'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          <div className="message-footer">
            <span className="message-time">
              {msg.created_at ? new Date(msg.created_at).toLocaleString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
              }) : ''}
            </span>
            <div className="message-actions">
              {msg.role === 'assistant' && msg.content && (
                <>
                  <Tooltip title="重新回答">
                    <Button 
                      type="text" 
                      size="small"
                      icon={<ReloadOutlined />} 
                      onClick={() => handleRegenerate(index)}
                    />
                  </Tooltip>
                  <Tooltip title="复制回答">
                    <Button 
                      type="text" 
                      size="small"
                      icon={<CopyOutlined />} 
                      onClick={() => copyToClipboard(msg.content, '回答')}
                    />
                  </Tooltip>
                </>
              )}
              {msg.role === 'user' && !editingMessageId && (
                <>
                  <Tooltip title="编辑问题">
                    <Button 
                      type="text" 
                      size="small"
                      icon={<EditOutlined />} 
                      onClick={() => handleEditMessage(msg.id, msg.content)}
                    />
                  </Tooltip>
                  <Tooltip title="复制问题">
                    <Button 
                      type="text" 
                      size="small"
                      icon={<CopyOutlined />} 
                      onClick={() => copyToClipboard(msg.content, '问题')}
                    />
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="empty-chat">
      <div className="welcome-icon">💬</div>
      <div className="welcome-text">
        {currentSelection 
          ? (currentSelection.type === 'chatbot' && selectedChatbot?.greeting 
              ? selectedChatbot.greeting 
              : `开始与 ${currentSelection.name} 对话`)
          : '请选择模型或机器人'
        }
      </div>
      <div className="welcome-hint">输入消息开始体验</div>
    </div>
  );

  return (
    <div className={`chat-conversation ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="chat-header">
        <div className="chat-title">
          {hasModelsOrChatbots ? (
            <Dropdown
              menu={{ 
                items: getDropdownItems(),
                className: `chat-selector-dropdown ${theme === 'dark' ? 'dark' : 'light'}`,
                style: { maxHeight: 600, overflowY: 'auto' }
              }}
              trigger={['click']}
              placement="bottomLeft"
            >
              <div className={`chat-selector ${theme === 'dark' ? 'dark' : 'light'}`}>
                <img 
                  src={currentSelection?.avatar || getDefaultAvatar()} 
                  alt={currentSelection?.name || 'default'} 
                  className="selector-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getDefaultAvatar();
                  }}
                />
                <span className="selector-name">
                  {currentSelection?.name || '请选择模型或机器人'}
                </span>
                <DownOutlined className="selector-arrow" />
              </div>
            </Dropdown>
          ) : (
            <div className={`chat-selector ${theme === 'dark' ? 'dark' : 'light'}`}>
              <img 
                src={getDefaultAvatar()} 
                alt="default" 
                className="selector-avatar"
              />
              <span className="selector-name">请选择模型或机器人</span>
            </div>
          )}
        </div>
        <div className="chat-actions">
          {selectedType === 'model' && selectedModel && (
            <Tooltip title="模型配置">
              <Button 
                type="text" 
                icon={<SettingOutlined />} 
                onClick={() => setIsConfigModalVisible(true)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确认清空"
            description="确定要清空当前对话吗？"
            onConfirm={handleClearMessages}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="清空对话">
              <Button 
                type="text" 
                icon={<ClearOutlined />} 
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      <div className={`chat-messages ${theme === 'dark' ? 'dark' : 'light'}`} ref={messagesContainerRef}>
        {loading && messages.length === 0 ? (
          <div className="loading-container">
            <LoadingOutlined style={{ fontSize: 32, color: 'var(--primary-color)' }} />
          </div>
        ) : messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {renderGroupedMessages()}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <div style={{ position: 'relative' }}>
            {/* 已选择的文件显示（内联方式） */}
            {selectedFiles.length > 0 && (
              <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedFiles.map((file, index) => {
                  // 根据文件类型获取文件名和大小
                  let fileName = '';
                  let fileSize = '';
                  
                  if (file.type === 'file_base64') {
                    fileName = file.file_name || '';
                    // 优先使用实际文件大小，否则使用base64计算
                    if (file.file_size) {
                      const size = file.file_size;
                      if (size < 1024) {
                        fileSize = `${size.toFixed(0)} B`;
                      } else if (size < 1024 * 1024) {
                        fileSize = `${(size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    } else if (file.content) {
                      const base64Size = file.content.length * 3 / 4;
                      if (base64Size < 1024) {
                        fileSize = `${base64Size.toFixed(0)} B`;
                      } else if (base64Size < 1024 * 1024) {
                        fileSize = `${(base64Size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(base64Size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    }
                  } else if (file.type === 'document') {
                    const content = file.content as Record<string, any>;
                    fileName = content?.file_name || '';
                    if (content?.file_size) {
                      const size = content.file_size;
                      if (size < 1024) {
                        fileSize = `${size.toFixed(0)} B`;
                      } else if (size < 1024 * 1024) {
                        fileSize = `${(size / 1024).toFixed(2)} KB`;
                      } else {
                        fileSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
                      }
                    }
                  }
                  
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 4,
                        backgroundColor: theme === 'dark' ? 'rgba(90, 111, 214, 0.2)' : 'rgba(90, 111, 214, 0.1)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(90, 111, 214, 0.3)' : 'rgba(90, 111, 214, 0.2)'}`,
                        fontSize: 12
                      }}
                    >
                      {getFileIcon(fileName)}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{fileName}</div>
                        {fileSize && (
                          <div style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                            {fileSize}
                          </div>
                        )}
                      </div>
                      <Button 
                        type="text" 
                        size="small" 
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => handleRemoveFile(index)}
                        style={{ marginLeft: 4 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            
            <TextArea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息... (Shift+Enter换行，Enter发送)"
              autoSize={{ minRows: 5, maxRows: 12 }}
              className={`chat-input ${theme === 'dark' ? 'dark' : 'light'}`}
            />
          </div>
          <div className="chat-input-inner-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div 
                className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} 
                onClick={() => setDeepThinking(!deepThinking)}
              >
                <BulbOutlined className={deepThinking ? 'bulb-active' : ''} />
                <span>深度思考</span>
                <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
              </div>
              
              {/* 上传文件下拉菜单 */}
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'local',
                      label: (
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            padding: '8px 16px',
                            height: '36px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <UploadOutlined />
                          <span>上传本地文件</span>
                        </div>
                      ),
                      onClick: () => {
                        // 触发文件选择
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) {
                            Array.from(files).forEach(file => handleLocalFileUpload(file));
                          }
                        };
                        input.click();
                      }
                    },
                    {
                      key: 'datasource',
                      label: (
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            padding: '8px 16px', 
                            height: '36px',
                            boxSizing: 'border-box',
                            cursor: 'pointer'
                          }}
                          onClick={() => setIsDataSourceModalVisible(true)}
                        >
                          <InboxOutlined />
                          <span>从数据源选择文件</span>
                        </div>
                      )
                    }
                  ]
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button icon={<PaperClipOutlined />} type="text" />
              </Dropdown>
            </div>
          </div>
          <Button
            type="primary"
            icon={loading ? <StopOutlined /> : <SendOutlined />}
            onClick={loading ? handleStop : handleSend}
            className="input-send-button"
          />
        </div>
      </div>
      
      {/* 数据源选择文件弹窗 */}
      <DataSourceFileSelector
        visible={isDataSourceModalVisible}
        onCancel={() => setIsDataSourceModalVisible(false)}
        onConfirm={handleDataSourceFileConfirm}
        theme={theme}
      />

      <Modal
        title="模型配置"
        open={isConfigModalVisible}
        onCancel={() => setIsConfigModalVisible(false)}
        footer={null}
        width={500}
        className={`chat-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>系统提示词</span>
              <Tooltip title="设置AI助手的角色和行为方式">
                <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
              </Tooltip>
            </div>
            <TextArea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="请输入系统提示词，定义AI助手的角色和行为方式..."
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{ width: '100%' }}
            />
          </div>
          {currentConfigParams.length > 0 ? (
            currentConfigParams.map(param => renderConfigParam(param))
          ) : (
          <div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', textAlign: 'center' }}>
            该模型类型暂无可配置参数
          </div>
          )}
        </div>
        <div className="config-actions">
          <Button onClick={() => setIsConfigModalVisible(false)}>取消</Button>
          <Button type="primary" onClick={async () => {
            // 如果有对话，更新对话的系统提示词
            if (conversation) {
              try {
                await chatService.updateConversationConfig(conversation.id, {
                  system_prompt: systemPrompt,
                  config: modelConfig
                });
                message.success('配置已保存');
              } catch (error) {
                console.error('Failed to save config:', error);
                message.error('保存配置失败，请重试');
                return;
              }
            }
            setIsConfigModalVisible(false);
          }}>
            保存
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ChatConversation;
