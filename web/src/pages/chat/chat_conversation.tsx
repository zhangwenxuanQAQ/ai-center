import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Switch, Modal, Slider, message, Popconfirm, Tooltip, Dropdown, Empty, Spin, Popover, InputNumber, Select, Steps, Upload, List } from 'antd';
import { SendOutlined, ClearOutlined, SettingOutlined, RobotOutlined, BulbOutlined, LoadingOutlined, DownOutlined, RightOutlined, CopyOutlined, ReloadOutlined, EditOutlined, InfoCircleOutlined, StopOutlined, PaperClipOutlined, FolderOpenOutlined, FileTextOutlined, UploadOutlined, CloseCircleOutlined, InboxOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined, DownloadOutlined } from '@ant-design/icons';
import DataSourceFileSelector from '../datasource/datasource data_select';
import type { MenuProps, UploadProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { chatbotService, Chatbot } from '../../services/chatbot';
import { chatService, Conversation, Message, QueryItem, FileInfo } from '../../services/chat';
import { datasourceService, Datasource } from '../../services/datasource';

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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
  reasoning_content?: string;
  reasoning_time?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  extra_content?: any;
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingFiles, setEditingFiles] = useState<any[]>([]); // 保存编辑消息的文件信息
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const isCreatingNewConversation = useRef(false);
  
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
      fetchMessages(conversation.id);
      fetchConversationConfig(conversation.id);
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
  }, [conversation, models, chatbots]);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const mappedMessages = result.items.map((msg: any) => ({
        id: msg.message_id || msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        reasoning_content: msg.reasoning_content,
        reasoning_time: msg.reasoning_time,
        usage: msg.usage,
        extra_content: msg.extra_content
      }));
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

  const handleStop = () => {
    chatService.stopCurrentRequest();
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
      created_at: new Date().toISOString(),
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
          setMessages(prev => prev.map(msg => {
            if (msg.id === idTracker.assistant) {
              const updates: any = {
                ...msg,
                content: data.full_text,
                reasoning_content: data.full_reasoning
              };
              if (data.assistant_message_id) {
                idTracker.assistant = data.assistant_message_id;
                updates.id = data.assistant_message_id;
                setThinkingMessageId(data.assistant_message_id);
              }
              return updates;
            }
            if (data.user_message_id && msg.id === idTracker.user) {
              idTracker.user = data.user_message_id;
              return { ...msg, id: data.user_message_id };
            }
            return msg;
          }));
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
    messageId?: string
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
      let extraContent = undefined;
      
      // 检查是否有编辑文件
      if (editingFiles.length > 0) {
        extraContent = { files: editingFiles };
      } else {
        // 如果没有编辑文件，使用旧消息的 extra_content
        const lastOldUserMessage = previousMessages[previousMessages.length - 1];
        extraContent = lastOldUserMessage?.extra_content;
      }
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString(),
        extra_content: extraContent
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
      created_at: new Date().toISOString()
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
        const idTracker = { assistant: assistantMessageId, user: currentUserMessageId };
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
            setMessages(prev => prev.map(msg => {
              if (msg.id === idTracker.assistant) {
                const updates: any = {
                  ...msg,
                  content: data.full_text,
                  reasoning_content: data.full_reasoning
                };
                if (data.assistant_message_id) {
                  idTracker.assistant = data.assistant_message_id;
                  updates.id = data.assistant_message_id;
                  setThinkingMessageId(data.assistant_message_id);
                }
                return updates;
              }
              if (data.user_message_id && idTracker.user && msg.id === idTracker.user) {
                idTracker.user = data.user_message_id;
                return { ...msg, id: data.user_message_id };
              }
              return msg;
            }));
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
            setLoading(false);
            setThinkingMessageId(null);
          }
        );
      } else {
        const idTracker = { assistant: assistantMessageId, user: currentUserMessageId };
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
            setMessages(prev => prev.map(msg => {
              if (msg.id === idTracker.assistant) {
                const updates: any = {
                  ...msg,
                  content: data.full_text,
                  reasoning_content: data.full_reasoning
                };
                if (data.assistant_message_id) {
                  idTracker.assistant = data.assistant_message_id;
                  updates.id = data.assistant_message_id;
                  setThinkingMessageId(data.assistant_message_id);
                }
                return updates;
              }
              if (data.user_message_id && idTracker.user && msg.id === idTracker.user) {
                idTracker.user = data.user_message_id;
                return { ...msg, id: data.user_message_id };
              }
              return msg;
            }));
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

    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;

    // Remove all messages after and including the current assistant message
    // 同时也删除旧的用户消息，因为我们会在 handleSendMessageWithMessages 中添加新的用户消息
    const updatedMessages = messages.slice(0, messageIndex - 1);
    
    // 直接调用 handleSendMessageWithMessages，它会处理消息添加
    handleSendMessageWithMessages(updatedMessages, userMessage.content, userMessage.id);
  };

  const getProviderAvatar = (provider: string): string => {
    if (!provider) {
      return '/src/assets/llm/default.svg';
    }
    const lowercaseProvider = provider.toLowerCase();
    return `/src/assets/llm/${lowercaseProvider}.svg`;
  };

  const getChatbotAvatar = (chatbot: Chatbot): string => {
    if (chatbot.avatar) {
      return chatbot.avatar;
    }
    return '/src/assets/llm/default.svg';
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
        return <FileTextOutlined style={{ color: '#fa8c16' }} />;
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
                  (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
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
                  (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
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

  const renderMessage = (msg: Message, index: number) => {
    // 跳过工具消息的显示
    if (msg.role === 'tool') {
      return null;
    }
    
    const isUser = msg.role === 'user';
    
    // 解析消息中的文件信息
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
      <div key={msg.id} className={`message ${msg.role}`}>
        <div className={`message-avatar ${theme === 'dark' ? 'dark' : 'light'}`}>
          {isUser ? '👤' : (
            <img 
              src={currentSelection?.avatar || '/src/assets/llm/default.svg'} 
              alt="AI" 
              className="avatar-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
              }}
            />
          )}
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && thinkingMessageId === msg.id && (
            <div className="message-reasoning">
              <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                <LoadingOutlined spin />
                <BulbOutlined /> 正在思考中
                {thinkingDuration[msg.id] && (
                  <span className="reasoning-duration">
                    ({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)
                  </span>
                )}
              </div>
              {expandedReasoning.has(msg.id) && msg.reasoning_content && (
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
          {msg.role === 'assistant' && msg.reasoning_content && thinkingMessageId !== msg.id && (
            <div className="message-reasoning">
              <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                {expandedReasoning.has(msg.id) ? (
                  <DownOutlined />
                ) : (
                  <RightOutlined />
                )}
                <BulbOutlined /> 思考过程
                {thinkingDuration[msg.id] && (
                  <span className="reasoning-duration">
                    ({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)
                  </span>
                )}
              </div>
              {expandedReasoning.has(msg.id) && msg.reasoning_content && (
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
          ) : msg.content ? (
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
                            color: theme === 'dark' ? '#667eea' : '#1890ff'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* 显示文本消息 */}
              <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <MDEditor.Markdown
                  source={msg.content}
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            </>
          ) : (
            // 无文本消息时只显示文件列表
            files.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((file) => {
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
                          color: theme === 'dark' ? '#667eea' : '#1890ff'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )
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
                className: `chat-selector-dropdown ${theme === 'dark' ? 'dark' : 'light'}`
              }}
              trigger={['click']}
              placement="bottomLeft"
            >
              <div className={`chat-selector ${theme === 'dark' ? 'dark' : 'light'}`}>
                <img 
                  src={currentSelection?.avatar || '/src/assets/llm/default.svg'} 
                  alt={currentSelection?.name || 'default'} 
                  className="selector-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
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
                src="/src/assets/llm/default.svg" 
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

      <div className={`chat-messages ${theme === 'dark' ? 'dark' : 'light'}`}>
        {loading && messages.length === 0 ? (
          <div className="loading-container">
            <LoadingOutlined style={{ fontSize: 32, color: '#667eea' }} />
          </div>
        ) : messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {messages.map((msg, index) => renderMessage(msg, index))}
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
                        backgroundColor: theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)',
                        border: `1px solid ${theme === 'dark' ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)'}`,
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
