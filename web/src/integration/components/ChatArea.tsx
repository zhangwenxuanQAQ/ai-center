import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PaperClipOutlined, CopyOutlined, EditOutlined, ReloadOutlined, CheckOutlined, BulbOutlined, DownOutlined, RightOutlined, LoadingOutlined, FilePdfOutlined, FileWordOutlined, FileImageOutlined, FileTextOutlined, SoundOutlined, DownloadOutlined } from '@ant-design/icons';
import { Tooltip, message } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import ChatMarkdown from '../../components/ChatMarkdown';
import WebSearchResult from '../../components/WebSearchResult';
import PPTDownloadCard from '../../components/PPTDownloadCard';
import IntegrationClarifyCard from './IntegrationClarifyCard';
import ChatScrollNavigator, { UserMessageAnchor } from '../../components/ChatScrollNavigator';
import { integrationChatService, IntegrationMessage, IntegrationQueryItem } from '../services/integrationChat';
import { usePanelDrag } from './PanelDragContext';
import { usePanelMinimize } from './PanelMinimizeContext';
import { getDefaultAvatar } from '../../utils/avatar';

interface ChatAreaProps {
  apiKey: string;
  chatId?: string;
  title?: string;
  theme?: string;
  themeMode?: string;
  colorTheme?: string;
  gradientEndColor?: string;
  inputPlaceholder?: string;
  maxInputLength?: number;
  welcomeMessages?: string[];
  userAvatar?: string;  // 用户头像
  botAvatar?: string;   // 机器人头像
  historyCollapsed: boolean;
  onToggleHistory: () => void;
  onChatIdChange: (chatId: string) => void;
  onMessageSent: () => void;
  temporary?: boolean;
  newChatTrigger?: number;
  previewToken?: string; // 预览token，用于不同预览token之间的数据隔离
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

interface DisplayMessage {
  id: string;
  message_id?: string;
  role: 'user' | 'assistant' | 'tool' | 'tool_response';
  content: string;
  created_at?: string;
  reasoning_content?: string;
  reasoning_time?: number;
  reasoning_end?: boolean;
  tool_calls?: ToolCallStep[];
  status?: 'start' | 'streaming' | 'done';
  step?: 'pre_process' | 'task_planning' | 'task_list' | 'model_answer' | 'task_execution' | 'result_summary';
  step_id?: string;
  extra_content?: any;
  files?: Array<{ file_name?: string; file_size?: number; mime_type?: string; type?: string; base64_content?: string }>;
}

interface SelectedFile {
  type: 'file_base64';
  content: string;
  mime_type: string;
  file_name: string;
  file_size?: number;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  apiKey,
  chatId,
  title = 'AI助手',
  theme = '#1677ff',
  themeMode = 'light',
  colorTheme = 'default_blue',
  gradientEndColor = 'none',
  inputPlaceholder = '请输入您的问题...',
  maxInputLength = 4000,
  welcomeMessages = [],
  userAvatar = '',
  botAvatar = '',
  historyCollapsed,
  onToggleHistory,
  onChatIdChange,
  onMessageSent,
  temporary = false,
  newChatTrigger = 0,
  previewToken,
}) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true); // 搜索引擎是否可用
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatId);
  const [randomWelcome, setRandomWelcome] = useState<string>('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [collapsedReasoning, setCollapsedReasoning] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedToolCallResults, setExpandedToolCallResults] = useState<Set<string>>(new Set());
  // 记录已回复的澄清问题 tool_call_id，避免用户在等待澄清回复时发送新消息
  const [respondedClarifyIds, setRespondedClarifyIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messagesPadding, setMessagesPadding] = useState<number>(16);
  const [messagesPaddingTop, setMessagesPaddingTop] = useState<number>(24);

  // 流式消息断点续传：按 chatId 存储流式过程中的完整消息数组
  const streamingMessagesRef = useRef<Record<string, DisplayMessage[]>>({});
  // 追踪当前显示的对话ID，用于隔离不同对话的流式消息更新
  const currentChatIdRef = useRef<string>('');

  // 更新流式消息：同时更新ref和state（仅当当前对话匹配时更新state）
  // 这样切换对话后流式消息仍会在ref中更新，切回来时可以恢复
  const updateStreamingMessages = useCallback((chatId: string, updater: (prev: DisplayMessage[]) => DisplayMessage[]) => {
    if (!chatId) return;
    const prev = streamingMessagesRef.current[chatId] || [];
    const newMsgs = updater(prev);
    streamingMessagesRef.current[chatId] = newMsgs;
    // 仅当当前显示的对话是流式对话时才更新state，避免污染其他对话的显示
    if (currentChatIdRef.current === chatId) {
      setMessages(newMsgs);
    }
  }, []);

  // 检测是否在底部
  const isAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // 随机选择欢迎语
  const selectRandomWelcome = useCallback(() => {
    if (welcomeMessages && welcomeMessages.length > 0) {
      const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
      setRandomWelcome(welcomeMessages[randomIndex]);
    } else {
      setRandomWelcome('你好，有什么可以帮助您的吗？');
    }
  }, [welcomeMessages]);

  useEffect(() => {
    selectRandomWelcome();
  }, [selectRandomWelcome]);

  // 获取网络搜索引擎状态
  useEffect(() => {
    const fetchWebSearchConfig = async () => {
      try {
        const response = await fetch('/aicenter/v1/llm_model/web_search_config');
        const result = await response.json();
        if (result.code === 200 && result.data) {
          const enabled = result.data.enabled !== false;
          setWebSearchEnabled(enabled);
          if (!enabled) {
            setWebSearch(false);
          }
        }
      } catch (error) {
        console.error('获取网络搜索配置失败:', error);
      }
    };
    fetchWebSearchConfig();
  }, []);

  // 动态计算消息区域左右padding
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const calculatePadding = () => {
      const width = container.clientWidth;
      const contentMaxWidth = 800;
      const horizontalPadding = Math.max(16, Math.floor((width - contentMaxWidth) / 2));
      const padding = Math.floor(horizontalPadding * 2 / 3);
      const paddingTop = Math.max(24, Math.floor(width * 0.03));
      setMessagesPadding(padding);
      setMessagesPaddingTop(paddingTop);
    };

    calculatePadding();

    const resizeObserver = new ResizeObserver(() => {
      calculatePadding();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', calculatePadding);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculatePadding);
    };
  }, []);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && chatId !== currentChatId) {
      // 切换到已有对话：先保存当前对话的消息到ref
      if (currentChatIdRef.current && messages.length > 0) {
        streamingMessagesRef.current[currentChatIdRef.current] = messages;
      }

      // 更新当前显示的对话ID
      currentChatIdRef.current = chatId;

      // 优先从ref恢复（包含完整的步骤、工具调用等状态）
      const refMessages = streamingMessagesRef.current[chatId];
      const streamingCache = integrationChatService.getStreamingCache(chatId);

      if (refMessages && refMessages.length > 0) {
        // 有ref消息：直接恢复完整的消息状态
        setCurrentChatId(chatId);
        setMessages(refMessages);
        if (streamingCache && streamingCache.isStreaming) {
          setLoading(true);
        } else {
          // 检查后端是否仍有正在进行的流式任务（如等待澄清输入），如有则重连并显示停止按钮
          integrationChatService.getStreamingStatus(apiKey, chatId).then((statusResult) => {
            const statusData = (statusResult as any)?.data || statusResult;
            if (statusData?.is_streaming) {
              setLoading(true);
              checkAndReconnectStream(chatId);
            } else {
              setLoading(false);
            }
          }).catch(() => {
            setLoading(false);
          });
        }
        setTimeout(() => { scrollToBottomInstant(); }, 100);
      } else if (streamingCache && streamingCache.isStreaming) {
        // 有流式缓存但无ref（兼容旧逻辑）：从后端加载并合并缓存
        setCurrentChatId(chatId);
        setLoading(true);
        loadMessages(chatId).then(() => {
          if (streamingCache.currentContent || streamingCache.currentReasoningContent) {
            setMessages(prev => {
              const lastAssistantIndex = prev.map((m, i) => ({ ...m, index: i })).reverse().find(m => m.role === 'assistant');
              if (lastAssistantIndex) {
                return prev.map((msg, idx) => {
                  if (idx === lastAssistantIndex.index) {
                    return {
                      ...msg,
                      content: streamingCache.currentContent || msg.content,
                      reasoning_content: streamingCache.currentReasoningContent || msg.reasoning_content,
                      status: 'running',
                    };
                  }
                  return msg;
                });
              }
              return prev;
            });
          }
        });
      } else {
        // 无内存缓存：可能是F5刷新或首次进入
        // 检查后端是否有正在进行的流式任务，如果有则重连
        setCurrentChatId(chatId);
        checkAndReconnectStream(chatId);
      }
    } else if (!chatId && currentChatId) {
      // 切换到新对话：保存当前消息到ref（流式仍在后台继续）
      if (currentChatIdRef.current && messages.length > 0) {
        streamingMessagesRef.current[currentChatIdRef.current] = messages;
      }
      currentChatIdRef.current = '';
      setCurrentChatId(undefined);
      setMessages([]);
      setInputValue('');
      setSelectedFiles([]);
      setEditingMessageId(null);
      setEditingContent('');
      setExpandedReasoning(new Set());
      setExpandedToolCalls(new Set());
      setExpandedToolCallResults(new Set());
      setLoading(false);
      // 重新随机选择欢迎语
      selectRandomWelcome();
    }
  }, [chatId, currentChatId, selectRandomWelcome]);

  // 监听新对话触发器，清空消息并重新选择欢迎语
  useEffect(() => {
    if (newChatTrigger > 0) {
      // 保存当前消息到ref（流式仍在后台继续）
      if (currentChatIdRef.current && messages.length > 0) {
        streamingMessagesRef.current[currentChatIdRef.current] = messages;
      }
      currentChatIdRef.current = '';
      setMessages([]);
      setInputValue('');
      setSelectedFiles([]);
      setEditingMessageId(null);
      setEditingContent('');
      setExpandedReasoning(new Set());
      setExpandedToolCalls(new Set());
      setExpandedToolCallResults(new Set());
      setCurrentChatId(undefined);
      setLoading(false);
      selectRandomWelcome();
    }
  }, [newChatTrigger, selectRandomWelcome]);

  // 只有在底部时才自动滚动
  useEffect(() => {
    if (isAtBottom()) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  /**
   * 将后端 IntegrationMessage 映射为前端 DisplayMessage
   * - 解析 extra_content（字符串 -> 对象）
   * - 从 extra_content.tool_call 恢复 tool_calls 数组
   * 返回 null 表示该消息应被过滤掉
   */
  const mapIntegrationMessage = (m: IntegrationMessage): DisplayMessage | null => {
    let parsedExtraContent = m.extra_content;
    if (typeof m.extra_content === 'string' && m.extra_content) {
      try {
        parsedExtraContent = JSON.parse(m.extra_content);
      } catch (e) {
        console.error('Failed to parse extra_content:', e);
      }
    }
    // 从 extra_content.tool_call 恢复 tool_calls
    let tool_calls: ToolCallStep[] | undefined;
    let step_id: string | undefined;
    let step: DisplayMessage['step'] | undefined;
    if (parsedExtraContent && typeof parsedExtraContent === 'object') {
      if (parsedExtraContent.step_id) step_id = parsedExtraContent.step_id;
      if (parsedExtraContent.step) step = parsedExtraContent.step;
      if (parsedExtraContent.step === 'tool_call' && parsedExtraContent.tool_call) {
        const tc = parsedExtraContent.tool_call;
        tool_calls = [{
          tool_call_id: tc.tool_call_id,
          name: tc.name,
          task_name: tc.task_name,
          status: tc.status,
          result: tc.result,
          message: tc.message,
          elapsed_ms: tc.elapsed_ms,
        }];
      }
    }
    return {
      id: step_id || m.id,
      message_id: m.message_id || m.id,
      role: m.role as DisplayMessage['role'],
      content: m.content,
      reasoning_content: m.reasoning_content,
      reasoning_time: m.reasoning_time,
      reasoning_end: !!m.reasoning_content,
      status: 'done',
      created_at: m.created_at,
      extra_content: parsedExtraContent,
      files: parsedExtraContent?.files || undefined,
      tool_calls,
      step_id,
      step,
    };
  };

  const loadMessages = async (id: string) => {
    try {
      const result = await integrationChatService.getMessages(apiKey, id, previewToken);
      const displayMsgs: DisplayMessage[] = (result.items || [])
        .map(mapIntegrationMessage)
        .filter((m): m is DisplayMessage => m !== null);
      setMessages(displayMsgs);
      // 同步到ref，用于后续切换对话时恢复
      streamingMessagesRef.current[id] = displayMsgs;
      setTimeout(() => {
        scrollToBottomInstant();
      }, 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxInputLength) {
      setInputValue(val);
      // Auto-resize
      const ta = e.target;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  /**
   * 检查并重连流式输出（F5刷新后恢复）
   * 加载历史消息后检查后端是否有正在进行的流式任务，如果有则重连获取流式数据
   */
  const checkAndReconnectStream = async (reconnectChatId: string) => {
    try {
      // 加载历史消息
      const result = await integrationChatService.getMessages(apiKey, reconnectChatId, previewToken);
      const displayMsgs: DisplayMessage[] = (result.items || [])
        .map(mapIntegrationMessage)
        .filter((m): m is DisplayMessage => m !== null);
      setMessages(displayMsgs);
      streamingMessagesRef.current[reconnectChatId] = displayMsgs;
      setTimeout(() => { scrollToBottomInstant(); }, 100);

      // 检查后端是否有正在进行的流式任务
      const statusData = await integrationChatService.getStreamingStatus(apiKey, reconnectChatId);
      if (statusData?.is_streaming) {
        // 后端有正在进行的流式任务，重连获取流式数据
        setLoading(true);
        const idTracker = { assistant: '', user: '' };

        const controller = new AbortController();
        abortControllerRef.current = controller;

        integrationChatService.reconnectStream(
          apiKey,
          reconnectChatId,
          (data: any) => {
            // 处理重连接收到的SSE数据
            if (data.assistant_message_id) idTracker.assistant = data.assistant_message_id;
            if (data.user_message_id) idTracker.user = data.user_message_id;

            const status = data.status || 'running';
            const stepId = data.step_id;

            if (status === 'error') {
              updateStreamingMessages(reconnectChatId, prev => {
                let updated = [...prev];
                if (data.user_message_id) {
                  updated = prev.map(msg => {
                    if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                      idTracker.user = data.user_message_id;
                      return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                    }
                    return msg;
                  });
                }
                const existingMsg = updated.find(msg =>
                  msg.role === 'assistant' &&
                  (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
                );
                if (existingMsg) {
                  return updated.map(msg => {
                    if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                      return { ...msg, content: data.text || '抱歉，处理您的请求时出现错误。', status: 'error' as any, reasoning_content: undefined, reasoning_end: undefined };
                    }
                    return msg;
                  });
                }
                const errorMsg: DisplayMessage = {
                  id: stepId || idTracker.assistant,
                  message_id: data.assistant_message_id,
                  role: 'assistant',
                  content: data.text || '抱歉，处理您的请求时出现错误。',
                  created_at: new Date().toISOString(),
                  status: 'error' as any,
                  step: data.step,
                  step_id: stepId,
                };
                return [...updated, errorMsg];
              });
              return;
            }

            if (status === 'start' && stepId && data.step) {
              updateStreamingMessages(reconnectChatId, prev => {
                let updated = [...prev];
                if (data.user_message_id) {
                  updated = prev.map(msg => {
                    if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                      idTracker.user = data.user_message_id;
                      return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                    }
                    return msg;
                  });
                }
                const existingStepMsg = updated.find(msg => msg.step_id === stepId && (msg.role === 'assistant' || msg.role === 'tool'));
                if (existingStepMsg) {
                  return updated.map(msg => {
                    if (msg.role === 'user') return processReconnectSSEUpdate(msg, data, idTracker);
                    if (msg.step_id === stepId) return processReconnectSSEUpdate(msg, data, idTracker);
                    return msg;
                  });
                }
                const initialMsgIndex = updated.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
                if (initialMsgIndex >= 0) {
                  return updated.map((msg, idx) => {
                    if (idx === initialMsgIndex) {
                      return { ...msg, message_id: data.assistant_message_id, status: 'start', step: data.step, step_id: stepId, tool_calls: data.tool_call ? [data.tool_call] : [] };
                    }
                    return msg;
                  });
                }
                const newStepMsg: DisplayMessage = {
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
                  tool_calls: data.tool_call ? [data.tool_call] : [],
                };
                return [...updated, newStepMsg];
              });
            } else {
              updateStreamingMessages(reconnectChatId, prev => prev.map(msg => {
                if (msg.role === 'user') return processReconnectSSEUpdate(msg, data, idTracker);
                if (!stepId) return processReconnectSSEUpdate(msg, data, idTracker);
                if (msg.step_id === stepId) return processReconnectSSEUpdate(msg, data, idTracker);
                return msg;
              }));
            }
          },
          (err: any) => {
            console.error('重连流式输出失败:', err);
            updateStreamingMessages(reconnectChatId, prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            if (currentChatIdRef.current === reconnectChatId) {
              setLoading(false);
            }
          },
          () => {
            updateStreamingMessages(reconnectChatId, prev => prev.map(msg => {
              if (msg.role === 'assistant' && msg.status !== 'done' && msg.status !== 'stop') {
                return { ...msg, status: 'done' };
              }
              return msg;
            }));
            if (currentChatIdRef.current === reconnectChatId) {
              setLoading(false);
            }
            onMessageSent();
          },
          controller.signal
        );
      }
    } catch (error) {
      console.error('检查流式状态失败:', error);
    }
  };

  /**
   * 重连时的SSE消息更新处理（与sendMessageInternal中的processSSEMessageUpdate类似）
   */
  const processReconnectSSEUpdate = (msg: DisplayMessage, data: any, idTracker: { assistant: string; user: string }): DisplayMessage => {
    if (msg.role === 'user') {
      if (data.user_message_id && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
        idTracker.user = data.user_message_id;
        return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
      }
      return msg;
    }
    if (msg.role === 'assistant') {
      const dataStepId = data.step_id;
      const msgStepId = msg.step_id;
      const dataHasStepId = dataStepId !== undefined && dataStepId !== null && dataStepId !== '';
      const msgHasStepId = msgStepId !== undefined && msgStepId !== null && msgStepId !== '';
      if (dataHasStepId) {
        if (!msgHasStepId || dataStepId !== msgStepId) return msg;
      } else {
        if (msgHasStepId) return msg;
      }
      const updates: any = { ...msg };
      if (data.assistant_message_id) updates.message_id = data.assistant_message_id;
      updates.status = data.status || 'running';
      if (data.step) updates.step = data.step;
      if (data.step_id) updates.step_id = data.step_id;
      if (!msg.reasoning_end && data.reasoning_content) {
        updates.reasoning_content = (msg.reasoning_content || '') + data.reasoning_content;
      }
      if (data.text) updates.content = (msg.content || '') + data.text;
      if (data.reasoning_end) updates.reasoning_end = true;
      if (data.tool_call) {
        const tc = data.tool_call;
        const existingCalls = updates.tool_calls || [];
        const existingIndex = existingCalls.findIndex((c: any) => c.tool_call_id === tc.tool_call_id);
        if (existingIndex >= 0) {
          existingCalls[existingIndex] = { ...existingCalls[existingIndex], ...tc };
        } else {
          existingCalls.push(tc);
        }
        updates.tool_calls = [...existingCalls];
      }
      if (data.reasoning_time != null) updates.reasoning_time = data.reasoning_time;
      updates.created_at = new Date().toISOString();
      return updates;
    }
    return msg;
  };

  // 批量校验文件（大小 + 数量）
  const validateFilesBatch = (files: File[]): boolean => {
    const maxSize = 15 * 1024 * 1024;
    const maxCount = 10;
    if (selectedFiles.length + files.length > maxCount) {
      message.warning(`单次提问最多上传${maxCount}个文件，当前已有${selectedFiles.length}个`);
      return false;
    }
    for (const f of files) {
      if (f.size > maxSize) {
        message.warning(`文件 "${f.name}" 超过15MB限制，已取消本次上传`);
        return false;
      }
    }
    return true;
  };

  // 文件上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArr = Array.from(files);
    if (!validateFilesBatch(fileArr)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    fileArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64Content = base64.split(',')[1];

        const selectedFile: SelectedFile = {
          type: 'file_base64',
          content: base64Content,
          mime_type: file.type,
          file_name: file.name,
          file_size: file.size,
        };
        setSelectedFiles(prev => [...prev, selectedFile]);
      };
      reader.readAsDataURL(file);
    });

    // 清空input，允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除已选文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 根据文件名获取图标
  const getFileIcon = (fileName: string) => {
    if (!fileName) return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
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
      case 'aiff':
      case 'ape':
      case 'wma':
        return <SoundOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 处理文件下载
  const handleDownloadFile = async (file: any) => {
    try {
      await integrationChatService.downloadFile(
        apiKey,
        file.type || 'local',
        file.file_name || '',
        file.base64_content,
        file.datasource_id,
        file.bucket,
        file.location
      );
      message.success('文件下载成功');
    } catch (error) {
      console.error('Failed to download file:', error);
      message.error('文件下载失败');
    }
  };

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim();
    // 有文件或有文本时都可以发送
    if ((selectedFiles.length === 0 && !text) || loading) return;

    // Build query items
    const query: IntegrationQueryItem[] = [];

    // Add files first
    selectedFiles.forEach(file => {
      query.push({
        type: file.type,
        content: file.content,
        mime_type: file.mime_type,
        file_name: file.file_name,
        file_size: file.file_size,
      });
    });

    // Add text
    if (text) {
      query.push({ type: 'text', content: text });
    }

    const filesForDisplay = [...selectedFiles];

    // Build display content: 只用文本，文件单独显示
    const displayContent = text || (filesForDisplay.length > 0 ? `${filesForDisplay.length} 个文件` : '');

    // 清空输入框和文件（只有普通发送时清空）
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setSelectedFiles([]);

    sendMessageInternal(query, displayContent, filesForDisplay);
  };

  /**
   * 内部发送消息方法
   */
  const sendMessageInternal = async (
    query: IntegrationQueryItem[],
    displayContent: string,
    filesForDisplay: any[],
    editMessageId?: string,
    skipUserMessage?: boolean
  ) => {
    const idTracker = { assistant: '', user: '' };
    // 捕获当前消息，用于初始化ref
    const currentMessages = messages;
    const newMessages: DisplayMessage[] = [];

    // 新对话：先创建对话，确保对话列表已更新，再发送消息
    let activeChatId = currentChatId;
    if (!activeChatId) {
      try {
        // 用用户首条消息文本作为对话标题
        const title = displayContent?.substring(0, 20) || '新对话';
        const created = await integrationChatService.createChat(apiKey, temporary, previewToken, title);
        activeChatId = created.id;
        setCurrentChatId(activeChatId);
        onChatIdChange(activeChatId);
        // 对话创建成功后立即刷新历史列表
        onMessageSent();
      } catch (err) {
        console.error('创建对话失败:', err);
        // 创建失败则回退到旧逻辑，流式响应中获取chat_id
      }
    }

    // skipUserMessage=true：编辑模式，前端已移除旧用户消息，不需要重新添加
    // skipUserMessage=false或未设置：普通发送和重新回答，需要添加用户消息
    if (!skipUserMessage) {
      // Add user message
      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayContent,
        status: 'done',
        created_at: new Date().toISOString(),
        files: filesForDisplay.map(f => ({
          file_name: f.file_name,
          file_size: f.file_size,
          mime_type: f.mime_type,
          type: f.type,
          base64_content: f.content // 保存base64内容用于下载
        })),
      };
      idTracker.user = userMsg.id;
      newMessages.push(userMsg);

      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();
    }

    // Add placeholder for assistant
    const assistantMsg: DisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      status: 'start',
      created_at: new Date().toISOString(),
      reasoning_content: '',
      reasoning_end: false,
      tool_calls: [],
    };
    idTracker.assistant = assistantMsg.id;
    newMessages.push(assistantMsg);

    setMessages((prev) => [...prev, assistantMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 设置流式缓存（用于切换对话后恢复）
    const cacheChatId = activeChatId || `temp-${Date.now()}`;
    // 用于跟踪流式过程中的实际chatId（新对话时可能变化）
    let streamingChatId = cacheChatId;
    integrationChatService.setStreamingCache(cacheChatId, {
      isStreaming: true,
      messages: [],
      assistantMessageId: assistantMsg.id,
      abortController: controller,
    });

    // 初始化流式消息ref，包含当前消息 + 新添加的用户/助手消息
    // 编辑/重新回答模式下，currentMessages可能仍包含已被前端删除的消息
    // （setMessages异步未生效），需从editMessageId处截断以避免重复
    let baseMessages = currentMessages;
    if (editMessageId) {
      const editIdx = currentMessages.findIndex(m => m.id === editMessageId || m.message_id === editMessageId);
      if (editIdx >= 0) {
        baseMessages = currentMessages.slice(0, editIdx);
      }
    }
    streamingMessagesRef.current[streamingChatId] = [...baseMessages, ...newMessages];
    currentChatIdRef.current = streamingChatId;

    let newChatId = activeChatId;

    const processSSEMessageUpdate = (msg: DisplayMessage, data: any): DisplayMessage => {
      if (msg.role === 'user') {
        if (data.user_message_id && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
          idTracker.user = data.user_message_id;
          return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
        }
        return msg;
      }

      if (msg.role === 'assistant') {
        const dataStepId = data.step_id;
        const msgStepId = msg.step_id;

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

        if (data.tool_call) {
          const tc = data.tool_call;
          const existingCalls = updates.tool_calls || [];
          const existingIndex = existingCalls.findIndex((c: any) => c.tool_call_id === tc.tool_call_id);
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

        updates.created_at = new Date().toISOString();
        return updates;
      }

      return msg;
    };

    try {
      await integrationChatService.sendMessageStream(
        apiKey,
        query,
        activeChatId,
        (data: any) => {
          if (data.chat_id && !newChatId) {
            newChatId = data.chat_id;
            setCurrentChatId(newChatId);
            onChatIdChange(newChatId);
            // 新对话创建成功：将ref从临时key迁移到真实chatId
            if (streamingChatId !== newChatId) {
              streamingMessagesRef.current[newChatId] = streamingMessagesRef.current[streamingChatId] || [];
              delete streamingMessagesRef.current[streamingChatId];
              streamingChatId = newChatId;
              currentChatIdRef.current = newChatId;
            }
          }

          const status = data.status || 'running';
          const stepId = data.step_id;

          if (status === 'error') {
            updateStreamingMessages(streamingChatId, prev => {
              let updated = [...prev];
              if (data.user_message_id) {
                updated = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              const existingMsg = updated.find(msg =>
                msg.role === 'assistant' &&
                (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)
              );
              if (existingMsg) {
                return updated.map(msg => {
                  if (msg.role === 'assistant' && (msg.step_id === stepId || msg.message_id === data.assistant_message_id || msg.id === idTracker.assistant)) {
                    return { ...msg, content: data.text || '抱歉，处理您的请求时出现错误。', status: 'error' as any, reasoning_content: undefined, reasoning_end: undefined };
                  }
                  return msg;
                });
              } else {
                const errorMsg: DisplayMessage = {
                  id: stepId || idTracker.assistant,
                  message_id: data.assistant_message_id,
                  role: 'assistant',
                  content: data.text || '抱歉，处理您的请求时出现错误。',
                  created_at: new Date().toISOString(),
                  status: 'error' as any,
                  step: data.step,
                  step_id: stepId,
                };
                return [...updated, errorMsg];
              }
            });
            return;
          }

          if (status === 'start' && stepId && data.step) {
            updateStreamingMessages(streamingChatId, prev => {
              let updated = [...prev];
              if (data.user_message_id) {
                updated = prev.map(msg => {
                  if (msg.role === 'user' && (msg.id === idTracker.user || msg.message_id === idTracker.user)) {
                    idTracker.user = data.user_message_id;
                    return { ...msg, id: data.user_message_id, message_id: data.user_message_id };
                  }
                  return msg;
                });
              }
              const existingStepMsg = updated.find(msg => msg.step_id === stepId && msg.role === 'assistant');
              if (existingStepMsg) {
                return updated.map(msg => {
                  if (msg.role === 'user') return processSSEMessageUpdate(msg, data);
                  if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data);
                  return msg;
                });
              }
              const initialMsgIndex = updated.findIndex(msg => msg.role === 'assistant' && !msg.step_id && msg.status === 'start');
              if (initialMsgIndex >= 0) {
                return updated.map((msg, idx) => {
                  if (idx === initialMsgIndex) {
                    return {
                      ...msg,
                      // 不更新 id，保持原来的临时 id
                      message_id: data.assistant_message_id,
                      status: 'start',
                      step: data.step,
                      step_id: stepId,
                      tool_calls: data.tool_call ? [data.tool_call] : [],
                    };
                  }
                  return msg;
                });
              }
              const newStepMsg: DisplayMessage = {
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
                tool_calls: data.tool_call ? [data.tool_call] : [],
              };
              return [...updated, newStepMsg];
            });
          } else {
            updateStreamingMessages(streamingChatId, prev => prev.map(msg => {
              if (msg.role === 'user') return processSSEMessageUpdate(msg, data);
              if (!stepId) return processSSEMessageUpdate(msg, data);
              if (msg.step_id === stepId) return processSSEMessageUpdate(msg, data);
              return msg;
            }));
          }
        },
        (err: any) => {
          console.error('Stream error:', err);
          const errorMessage = typeof err === 'string' ? err : err?.message || err?.error || '发生了未知错误';
          updateStreamingMessages(streamingChatId, (prev) => prev.map(msg => {
            if (msg.role === 'assistant' && msg.status && msg.status !== 'done' && msg.status !== 'stop') {
              return { ...msg, content: msg.content || errorMessage, status: 'done' };
            }
            // 标记工具消息 step_status 为 done，使澄清等待状态解除
            if (msg.role === 'tool' && msg.extra_content && msg.extra_content.step_status !== 'done') {
              return { ...msg, extra_content: { ...msg.extra_content, step_status: 'done' } };
            }
            return msg;
          }));
          if (currentChatIdRef.current === streamingChatId) {
            setLoading(false);
          }
          abortControllerRef.current = null;
          // 清理流式缓存
          integrationChatService.clearStreamingCache(cacheChatId);
        },
        () => {
          updateStreamingMessages(streamingChatId, (prev) => prev.map(msg => {
            if (msg.role === 'assistant' && msg.status !== 'done' && msg.status !== 'stop') {
              return { ...msg, status: 'done' };
            }
            // 标记工具消息 step_status 为 done，使澄清等待状态解除
            if (msg.role === 'tool' && msg.extra_content && msg.extra_content.step_status !== 'done') {
              return { ...msg, extra_content: { ...msg.extra_content, step_status: 'done' } };
            }
            return msg;
          }));
          if (currentChatIdRef.current === streamingChatId) {
            setLoading(false);
          }
          abortControllerRef.current = null;
          onMessageSent();
          // 清理流式缓存
          integrationChatService.clearStreamingCache(cacheChatId);
        },
        controller.signal,
        temporary,
        deepThinking,
        editMessageId,
        previewToken,
        webSearch
      );
    } catch (err: any) {
      console.error('Send message error:', err);
      const errorMessage = typeof err === 'string' ? err : err?.message || err?.error || '发生了未知错误';
      updateStreamingMessages(streamingChatId, (prev) => prev.map(msg => {
        if (msg.role === 'assistant' && msg.status && msg.status !== 'done') {
          return { ...msg, content: msg.content || errorMessage, status: 'done' };
        }
        return msg;
      }));
      if (currentChatIdRef.current === streamingChatId) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  };

  // Stop streaming
  const handleStop = async () => {
    const chatId = currentChatIdRef.current;
    // 调用后端停止接口，让后端保存停止状态
    if (chatId) {
      await integrationChatService.stopChat(apiKey, chatId);
    }
    // 同时中断前端流式请求
    abortControllerRef.current?.abort();
    setLoading(false);
    // 停止后重新查询消息记录，确保 UI 与后端状态一致
    if (chatId) {
      await loadMessages(chatId);
      // 额外保障：确保澄清工具消息 step_status 为 done（防止 DB 时序问题）
      setMessages(prev => prev.map(msg => {
        if (msg.role === 'tool' && msg.extra_content && msg.extra_content.step_status !== 'done') {
          const tc = msg.extra_content.tool_call;
          if (tc && tc.name === 'clarify') {
            return { ...msg, extra_content: { ...msg.extra_content, step_status: 'done' } };
          }
        }
        return msg;
      }));
    } else {
      const stopUpdater = (prev: DisplayMessage[]) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, status: 'done' };
        }
        // 标记工具消息 step_status 为 done，使澄清等待状态解除
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].role === 'tool' && updated[i].extra_content && updated[i].extra_content.step_status !== 'done') {
            updated[i] = { ...updated[i], extra_content: { ...updated[i].extra_content, step_status: 'done' } };
          }
        }
        return updated;
      };
      setMessages(stopUpdater);
    }
  };

  /**
   * 尝试解析内容是否为 widget_event JSON
   */
  const tryParseWidgetEvent = (content: string): { type: string; widgetId: string; widgetValue: any } | null => {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type === 'widget_event' && parsed.widgetId !== undefined) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  /**
   * 格式化 widget_value 为用户友好的显示文本
   */
  const formatWidgetValueForDisplay = (widgetId: string, widgetValue: any): string => {
    if (widgetValue == null) return '';
    if (typeof widgetValue === 'string') return widgetValue;
    if (typeof widgetValue === 'number' || typeof widgetValue === 'boolean') return String(widgetValue);
    if (Array.isArray(widgetValue)) return widgetValue.join(', ');
    if (typeof widgetValue === 'object') return JSON.stringify(widgetValue, null, 2);
    return String(widgetValue);
  };

  /**
   * 将 widget 交互值保存到对应助手消息的 extra_content 中
   * 用于重新进入对话时恢复组件的选中状态
   */
  const saveWidgetValueToMessage = useCallback((widgetId: string, widgetValue: any) => {
    setMessages(prev => prev.map(msg => {
      if (msg.role === 'assistant' && msg.content && msg.content.includes(widgetId)) {
        const existingWidgetValues = (msg.extra_content as any)?.widgetValues || {};
        return {
          ...msg,
          extra_content: {
            ...msg.extra_content,
            widgetValues: {
              ...existingWidgetValues,
              [widgetId]: widgetValue
            }
          }
        };
      }
      return msg;
    }));
  }, []);

  /**
   * 处理 Markdown-UI 组件交互事件
   * 将组件事件数据作为新的用户消息发送给后端
   */
  const handleWidgetEvent = (event: any) => {
    // 先保存交互值到对应助手消息的 extra_content 中
    if (event.widgetId !== undefined) {
      saveWidgetValueToMessage(event.widgetId, event.widgetValue);
    }

    const eventData = {
      type: event.type || 'widget_event',
      widgetId: event.widgetId,
      widgetValue: event.widgetValue
    };
    const jsonContent = JSON.stringify(eventData, null, 2);
    const displayContent = formatWidgetValueForDisplay(event.widgetId, event.widgetValue);
    sendMessageInternal(
      [{ type: 'text', content: jsonContent }],
      displayContent,
      []
    );
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter 或 Shift+Enter 换行（不发送）
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      // 默认行为就是换行，不需要处理
      return;
    }
    // 仅 Enter 发送（如果正在回答或等待澄清则不发送）
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      if (!loading && !clarifyPending) {
        handleSend();
      }
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        message.success(`${type}已复制`);
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
        message.success(`${type}已复制`);
      } else {
        message.error('复制失败，请手动复制');
      }
    } catch (err) {
      message.error('复制失败，请手动复制');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  // 自动调整编辑输入框高度
  const autoResizeEditTextarea = useCallback(() => {
    if (editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${Math.min(editTextareaRef.current.scrollHeight, 200)}px`;
    }
  }, []);

  // 编辑消息
  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    setTimeout(() => {
      autoResizeEditTextarea();
      editTextareaRef.current?.focus();
    }, 0);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // 保存编辑并发送
  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return;

    // 找到这条消息
    const message = messages.find(m => m.id === messageId || m.message_id === messageId);
    if (!message) return;

    // 获取原始消息ID（用于后端删除）
    const originalMessageId = message.message_id || message.id;

    // 前端删除这条消息及其后面的所有消息
    const messageIndex = messages.findIndex(m => m.id === messageId || m.message_id === messageId);
    if (messageIndex === -1) return;
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);

    // 取消编辑状态
    setEditingMessageId(null);
    setEditingContent('');

    // 构建query，发送消息（传递 editMessageId）
    const query: IntegrationQueryItem[] = [];
    // 保留原始消息中的文件（兼容当前会话 type='file_base64' 和历史加载 type='local'）
    (message.files || []).forEach(f => {
      const b64 = f.base64_content;
      if (b64 && (f.type === 'local' || f.type === 'file_base64')) {
        query.push({
          type: 'file_base64',
          content: b64,
          mime_type: f.mime_type,
          file_name: f.file_name,
          file_size: f.file_size,
        });
      }
    });
    query.push({ type: 'text', content: editingContent });
    // 保留文件信息用于显示
    const editFiles = (message.files || []).map(f => ({
      file_name: f.file_name,
      file_size: f.file_size,
      mime_type: f.mime_type,
      type: f.type,
      content: f.base64_content,
    }));
    sendMessageInternal(query, editingContent, editFiles, originalMessageId);
  };

  // 重新回答
  const handleRegenerate = async (groupIndex: number) => {
    if (loading) return;

    const groups = groupMessagesByAssistantId();
    if (groupIndex >= groups.length) return;

    // 找到该助手消息组对应的用户消息
    let userMessage: DisplayMessage | null = null;
    let userMsgIndexInMessages = -1;

    for (let i = groupIndex - 1; i >= 0; i--) {
      const group = groups[i];
      if (!group.assistantId && group.messages.length > 0) {
        userMessage = group.messages[0];
        userMsgIndexInMessages = messages.findIndex(m => m.id === userMessage!.id || m.message_id === userMessage!.id);
        break;
      }
    }

    if (!userMessage || userMsgIndexInMessages === -1) return;

    // 前端删除从用户消息起的所有后续消息（包含用户消息和助手回复）。
    // sendMessageInternal 会重新添加用户消息和助手占位消息。
    const newMessages = messages.slice(0, userMsgIndexInMessages);
    setMessages(newMessages);

    // 将用户消息 ID 作为 editMessageId 传给后端，
    // 后端从该消息起删除后续所有消息，再重新保存用户消息+新回复
    const userMsgId = userMessage.message_id || userMessage.id;
    const query: IntegrationQueryItem[] = [];
    // 将原始文件加入 query，使后端能够处理文件（兼容当前会话 type='file_base64' 和历史加载 type='local'）
    (userMessage.files || []).forEach(f => {
      const b64 = f.base64_content;
      if (b64 && (f.type === 'local' || f.type === 'file_base64')) {
        query.push({
          type: 'file_base64',
          content: b64,
          mime_type: f.mime_type,
          file_name: f.file_name,
          file_size: f.file_size,
        });
      }
    });
    if (userMessage.content) {
      query.push({ type: 'text', content: userMessage.content });
    }
    // 保留原始用户消息的文件信息（含 base64_content）用于显示和下载
    const originalFiles = (userMessage.files || []).map(f => ({
      file_name: f.file_name,
      file_size: f.file_size,
      mime_type: f.mime_type,
      type: f.type,
      content: f.base64_content,
    }));
    sendMessageInternal(query, userMessage.content, originalFiles, userMsgId);
  };

  // 切换思考过程展开/收起
  const toggleReasoning = (messageId: string, isRunning: boolean = false) => {
    if (isRunning) {
      setCollapsedReasoning(prev => {
        const newSet = new Set(prev);
        if (newSet.has(messageId)) {
          newSet.delete(messageId);
        } else {
          newSet.add(messageId);
        }
        return newSet;
      });
    } else {
      setExpandedReasoning(prev => {
        const newSet = new Set(prev);
        if (newSet.has(messageId)) {
          newSet.delete(messageId);
        } else {
          newSet.add(messageId);
        }
        return newSet;
      });
    }
  };

  // 切换工具调用展开/收起
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

  // 切换工具调用结果展开/收起
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

  const groupMessagesByAssistantId = () => {
    const groups: { assistantId: string; stableId: string; messages: DisplayMessage[] }[] = [];
    let currentGroup: { assistantId: string; stableId: string; messages: DisplayMessage[] } | null = null;
    let groupCounter = 0;

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groupCounter++;
        groups.push({ assistantId: '', stableId: `user-${groupCounter}`, messages: [msg] });
      } else if (msg.role === 'assistant') {
        const assistantId = msg.message_id || msg.id;
        if (currentGroup && currentGroup.assistantId === assistantId) {
          currentGroup.messages.push(msg);
        } else {
          if (currentGroup) {
            groups.push(currentGroup);
          }
          groupCounter++;
          currentGroup = { assistantId, stableId: `assistant-${groupCounter}`, messages: [msg] };
        }
      } else if (msg.role === 'tool' || msg.role === 'tool_response') {
        // tool 和 tool_response 消息归入当前 assistant 组
        if (currentGroup) {
          currentGroup.messages.push(msg);
        } else {
          // 没有 assistant 父组时，创建一个虚拟 assistant 组（而非 user 组）
          groupCounter++;
          currentGroup = { assistantId: msg.message_id || msg.id, stableId: `${msg.role}-${groupCounter}`, messages: [msg] };
        }
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  };

  // 检查消息组中是否存在未回复的澄清问题
  const hasPendingClarify = (groupMessages: DisplayMessage[]): boolean => {
    for (const msg of groupMessages) {
      const isStepDone = msg.extra_content?.step_status === 'done';
      if (isStepDone) continue;
      const toolCalls = msg.tool_calls || [];
      for (const tc of toolCalls) {
        if (tc.name === 'clarify' && tc.result && !respondedClarifyIds.has(tc.tool_call_id)) {
          return true;
        }
      }
      const tc = msg.extra_content?.tool_call;
      if (tc?.name === 'clarify' && tc.result && !respondedClarifyIds.has(tc.tool_call_id)) {
        return true;
      }
    }
    return false;
  };

  // 检查全局是否存在任何未回复的澄清问题（用于禁用输入区）
  const hasAnyPendingClarify = (): boolean => {
    for (const msg of messages) {
      const isStepDone = msg.extra_content?.step_status === 'done';
      if (isStepDone) continue;
      const toolCalls = msg.tool_calls || [];
      for (const tc of toolCalls) {
        if (tc.name === 'clarify' && tc.result && !respondedClarifyIds.has(tc.tool_call_id)) {
          return true;
        }
      }
      const tc = msg.extra_content?.tool_call;
      if (tc?.name === 'clarify' && tc.result && !respondedClarifyIds.has(tc.tool_call_id)) {
        return true;
      }
    }
    return false;
  };

  // 标记某个澄清问题已回复
  const handleClarifyResponded = (toolCallId: string) => {
    setRespondedClarifyIds(prev => {
      const next = new Set(prev);
      next.add(toolCallId);
      return next;
    });
  };

  // 判断助手消息是否有可见内容（避免渲染空的 step-container）
  const hasAssistantVisibleContent = (msg: DisplayMessage): boolean => {
    if (msg.role !== 'assistant') return true;
    // 有文本内容
    if (msg.content) return true;
    // 有思考过程内容
    if (msg.reasoning_content) return true;
    // 有工具调用
    if (msg.tool_calls && msg.tool_calls.length > 0) return true;
    // start 状态总会显示加载提示
    if (msg.status === 'start' || (!msg.reasoning_content && !msg.content && msg.status !== 'done' && msg.status !== 'stop')) return true;
    return false;
  };

  const renderAssistantMessageContent = (msg: DisplayMessage, groupMessages?: DisplayMessage[]) => {
    return (
      <div className="int-step-container">
        <div className="int-md-editor-container">
          <>
            {(msg.status === 'start' || (!msg.reasoning_content && !msg.content && msg.status !== 'done' && msg.status !== 'stop')) && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header">
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>思考中...</span>
                </div>
              </div>
            )}

            {msg.status !== 'start' && msg.status !== 'done' && msg.status !== 'stop' && !msg.reasoning_end && msg.reasoning_content && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id, true)}>
                  {collapsedReasoning.has(msg.step_id || msg.id) ? (
                    <RightOutlined />
                  ) : (
                    <DownOutlined />
                  )}
                  <LoadingOutlined spin />
                  <BulbOutlined />
                  <span>正在思考中...</span>
                </div>
                {!collapsedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="int-reasoning-text">
                    <ChatMarkdown source={msg.reasoning_content} />
                  </div>
                )}
              </div>
            )}

            {(msg.status === 'done' || msg.status === 'stop' || !msg.status) && msg.reasoning_content && msg.reasoning_end && (
              <div className="int-message-reasoning">
                <div className="int-reasoning-header" onClick={() => toggleReasoning(msg.step_id || msg.id)}>
                  {expandedReasoning.has(msg.step_id || msg.id) ? (
                    <DownOutlined />
                  ) : (
                    <RightOutlined />
                  )}
                  <BulbOutlined />
                  <span>思考过程</span>
                  {msg.reasoning_time != null && (
                    <span className="int-reasoning-duration">
                      ({(msg.reasoning_time / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                {expandedReasoning.has(msg.step_id || msg.id) && msg.reasoning_content && (
                  <div className="int-reasoning-text">
                    <ChatMarkdown source={msg.reasoning_content} />
                  </div>
                )}
              </div>
            )}

            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="int-tool-calls-container">
                {msg.tool_calls.map((tc, tcIndex) => {
                  const tcId = tc.tool_call_id || `tc-${tcIndex}`;
                  const isClarify = tc.name === 'clarify';
                  // 从 groupMessages 中查找匹配的 tool_response 消息（通过 tool_call_id 匹配）
                  const toolResponse = groupMessages?.find(
                    (m) => m.role === 'tool_response' && m.extra_content?.tool_call?.tool_call_id === tcId
                  );
                  return (
                  <div key={tcId} className={`int-tool-call-card int-tool-call-${tc.status}${tc.name === 'web_search' ? ' int-tool-call-web-search' : ''}${tc.name === 'generate_ppt' ? ' int-tool-call-generate-ppt' : ''}${isClarify ? ' int-tool-call-clarify' : ''}`}>
                    <div className="int-tool-call-header" onClick={() => !isClarify && toggleToolCall(tcId)}>
                      <div className="int-tool-call-header-left">
                        {tc.status === 'start' && <LoadingOutlined spin className="int-tool-call-icon-start" />}
                        {tc.status === 'running' && <LoadingOutlined spin className="int-tool-call-icon-running" />}
                        {tc.status === 'success' && <span className="int-tool-call-icon-success">✓</span>}
                        {tc.status === 'error' && <span className="int-tool-call-icon-error">✗</span>}
                        {!isClarify && (expandedToolCalls.has(tcId) ? (
                          <DownOutlined style={{ fontSize: 10 }} />
                        ) : (
                          <RightOutlined style={{ fontSize: 10 }} />
                        ))}
                        {tc.task_name && <span className="int-tool-call-task-name">{tc.task_name}</span>}
                      </div>
                      <div className="int-tool-call-header-right">
                        {tc.elapsed_ms != null && tc.elapsed_ms > 0 && (
                          <span className="int-tool-call-elapsed">
                            {(tc.elapsed_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                    {/* clarify 工具：在卡片外部直接渲染交互组件，无需展开 */}
                    {isClarify && tc.result && (
                      <div className="int-tool-call-content int-tool-call-clarify-content">
                        <IntegrationClarifyCard
                          result={tc.result}
                          chatId={currentChatId || ''}
                          apiKey={apiKey}
                          theme={themeMode === 'dark' ? 'dark' : 'light'}
                          toolCallId={tc.tool_call_id}
                          messageId={msg.message_id}
                          disabled={!!toolResponse || msg.extra_content?.step_status === 'done'}
                          onResponded={handleClarifyResponded}
                          userResponse={toolResponse?.content}
                          temporary={temporary}
                          previewToken={previewToken}
                        />
                      </div>
                    )}
                    {!isClarify && expandedToolCalls.has(tcId) && (
                      <div className="int-tool-call-content">
                        {/* web_search/generate_ppt不显示原始消息 */}
                        {tc.message && tc.name !== 'web_search' && tc.name !== 'generate_ppt' && (
                          <div className="int-tool-call-message">
                            <ChatMarkdown source={tc.message} />
                          </div>
                        )}
                        {tc.result && (
                          <>
                            {tc.message && tc.name !== 'web_search' && tc.name !== 'generate_ppt' && <div className="int-tool-call-divider" />}
                            <div
                              className="int-tool-call-result-header"
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
                              <span className="int-tool-call-result-title">工具结果</span>
                            </div>
                            {expandedToolCallResults.has(tc.tool_call_id || `tc-${tcIndex}`) && (
                              <div className="int-tool-call-result">
                                {tc.name === 'web_search' ? (
                                  <WebSearchResult result={tc.result} theme={theme} />
                                ) : tc.name === 'generate_ppt' ? (
                                  <PPTDownloadCard result={tc.result} theme={theme} />
                                ) : (
                                  <ChatMarkdown
                                    source={typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                                  />
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {msg.content && !(msg.role === 'tool' && msg.tool_calls) && (
              (() => {
                const widgetEvent = msg.role === 'user' ? tryParseWidgetEvent(msg.content) : null;
                const displaySource = widgetEvent
                  ? formatWidgetValueForDisplay(widgetEvent.widgetId, widgetEvent.widgetValue)
                  : msg.content;
                return <ChatMarkdown source={displaySource} onWidgetEvent={handleWidgetEvent} widgetValues={(msg.extra_content as any)?.widgetValues} />;
              })()
            )}
          </>
        </div>
      </div>
    );
  };

  const renderGroupedMessages = () => {
    const groups = groupMessagesByAssistantId();
    const lastAssistantGroupIndex = [...groups].reverse().findIndex(g => g.assistantId !== '');
    const lastAssistantGroupIdx = lastAssistantGroupIndex >= 0 ? groups.length - 1 - lastAssistantGroupIndex : -1;

    return groups.map((group, groupIndex) => {
      if (!group.assistantId) {
        const msg = group.messages[0];
        return renderUserMessage(msg, groupIndex);
      }

      const firstMsg = group.messages[0];
      const isRunning = loading && groupIndex === lastAssistantGroupIdx;
      const hasContent = group.messages.some(m => m.content);

      return (
        <div key={group.stableId} className={`int-message assistant`}>
          <div className={`int-msg-avatar assistant`}>
            {botAvatar ? (
              <img src={botAvatar} alt="AI" />
            ) : (
              <img src={getDefaultAvatar()} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div className="int-msg-content">
            {group.messages.map((msg, msgIndex) => (
              hasAssistantVisibleContent(msg) && msg.role !== 'tool_response' && (
              <div
                key={msgIndex}
                id={msg.step_id || undefined}
                className="int-step-wrapper"
              >
                {renderAssistantMessageContent(msg, group.messages)}
              </div>
              )
            ))}
            <div className="int-msg-footer">
              <span className="int-msg-time">
                {firstMsg.created_at ? new Date(firstMsg.created_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }) : ''}
              </span>
              <div className="int-msg-actions">
                {isRunning ? (
                  <Tooltip title="正在生成中">
                    <button className="int-msg-action-btn" disabled>
                      <LoadingOutlined spin />
                    </button>
                  </Tooltip>
                ) : hasPendingClarify(group.messages) ? (
                  <Tooltip title="等待澄清回复">
                    <button className="int-msg-action-btn" disabled>
                      <LoadingOutlined spin />
                    </button>
                  </Tooltip>
                ) : (
                  hasContent && (
                    <>
                      <Tooltip title="重新回答">
                        <button
                          className="int-msg-action-btn"
                          onClick={() => handleRegenerate(groupIndex)}
                          disabled={loading}
                        >
                          <ReloadOutlined />
                        </button>
                      </Tooltip>
                      <Tooltip title="复制回答">
                        <button
                          className="int-msg-action-btn"
                          onClick={() => {
                            const content = group.messages.map(m => m.content).filter(Boolean).join('\n');
                            copyToClipboard(content, '回答');
                          }}
                        >
                          <CopyOutlined />
                        </button>
                      </Tooltip>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderUserMessage = (msg: DisplayMessage, index: number) => {
    return (
      <div key={`user-${index}`} className={`int-message user`} data-user-msg-id={msg.message_id || msg.id}>
        <div className={`int-msg-avatar user`}>
          {userAvatar ? (
            <img src={userAvatar} alt="用户" />
          ) : (
            <span style={{ fontSize: '20px' }}>👤</span>
          )}
        </div>
        <div className="int-msg-content">
          {editingMessageId === msg.id ? (
            <div className="int-msg-edit">
              <textarea
                ref={editTextareaRef}
                value={editingContent}
                onChange={(e) => {
                  setEditingContent(e.target.value);
                  autoResizeEditTextarea();
                }}
              />
            </div>
          ) : (
            <>
              {/* 显示文件列表 */}
              {msg.files && msg.files.length > 0 && (
                <div className="int-msg-files">
                  {msg.files.map((file, fileIndex) => {
                    const fileName = file.file_name || '';
                    const extension = fileName.split('.').pop()?.toUpperCase() || '';
                    const fileSize = formatFileSize(file.file_size);
                    return (
                      <div key={fileName || `file-${fileIndex}`} className="int-msg-file-card">
                        <span className="int-msg-file-icon">{getFileIcon(fileName)}</span>
                        <div className="int-msg-file-info">
                          <span className="int-msg-file-name">{fileName}</span>
                          <span className="int-msg-file-meta">{extension}{fileSize ? ` · ${fileSize}` : ''}</span>
                        </div>
                        <Tooltip title="下载文件">
                          <button
                            className="int-msg-file-download"
                            onClick={() => handleDownloadFile(file)}
                          >
                            <DownloadOutlined />
                          </button>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 显示用户消息文本 - 纯文本，不使用markdown渲染 */}
              {msg.content && (
                <div className="int-user-message-text">
                  {msg.content}
                </div>
              )}
            </>
          )}
          <div className="int-msg-footer">
            <span className="int-msg-time">
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
            <div className="int-msg-actions">
              {editingMessageId === msg.id ? (
                <div className="int-msg-edit-actions">
                  <button onClick={handleCancelEdit}>取消</button>
                  <button onClick={() => handleSaveEdit(msg.id)}>发送</button>
                </div>
              ) : (
                <>
                  <Tooltip title="编辑问题">
                    <button
                      className="int-msg-action-btn"
                      onClick={() => handleEditMessage(msg.id, msg.content)}
                    >
                      <EditOutlined />
                    </button>
                  </Tooltip>
                  <Tooltip title="复制问题">
                    <button
                      className="int-msg-action-btn"
                      onClick={() => copyToClipboard(msg.content, '问题')}
                    >
                      <CopyOutlined />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const showWelcome = messages.length === 0 && !loading;

  // 构建用户消息锚点列表（用于右侧导航）
  const userMessageAnchors: UserMessageAnchor[] = useMemo(() => {
    return messages
      .filter(msg => msg.role === 'user')
      .map(msg => ({
        id: msg.message_id || msg.id,
        label: msg.content ? msg.content.replace(/[\n\r]/g, ' ').trim().substring(0, 30) : '',
      }));
  }, [messages]);

  // 面板拖拽处理（从 FloatingBall 通过 Context 传入）
  const panelDrag = usePanelDrag();
  const panelMinimize = usePanelMinimize();
  const minimized = panelMinimize?.isMinimized ?? false;

  // 是否存在未回复的澄清问题（用于禁用输入区）
  const clarifyPending = hasAnyPendingClarify();

  return (
    <div className="int-chat-area" data-theme={themeMode} data-color-theme={colorTheme}>
      {/* Header（支持拖拽移动面板） */}
      <div
        className="int-chat-header"
        onMouseDown={panelDrag || undefined}
        style={{ cursor: panelDrag ? 'move' : undefined }}
      >
        <button className="int-toggle-history-btn" onClick={onToggleHistory} title={historyCollapsed ? '展开历史' : '收起历史'}>
          ☰
        </button>
        <div className="int-chat-header-title">{title}</div>
      </div>

      {/* 最小化时隐藏消息和输入区域 */}
      {!minimized && (
        <>
      {/* Messages or Welcome */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          className="int-messages"
          ref={messagesContainerRef}
          style={{ paddingLeft: messagesPadding, paddingRight: messagesPadding, paddingTop: messagesPaddingTop }}
        >
          {showWelcome ? (
            <div className="int-welcome-area">
              <div className="int-welcome-icon">💬</div>
              <div className="int-welcome-text">{randomWelcome}</div>
              <div className="int-welcome-hint">输入消息开始对话</div>
            </div>
          ) : (
            renderGroupedMessages()
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatScrollNavigator
          containerRef={messagesContainerRef}
          userMessages={userMessageAnchors}
          theme={themeMode as 'light' | 'dark'}
        />
      </div>

      {/* Input */}
      <div className="int-input-area">
        {/* 已选择的文件显示 */}
        {selectedFiles.length > 0 && (
          <div className="int-selected-files">
            {selectedFiles.map((file, index) => (
              <div key={index} className="int-selected-file">
                <span className="int-file-icon">{getFileIcon(file.file_name)}</span>
                <div className="int-file-info">
                  <span className="int-file-name">{file.file_name}</span>
                  <span className="int-file-size">{formatFileSize(file.file_size)}</span>
                </div>
                <button
                  className="int-file-remove"
                  onClick={() => handleRemoveFile(index)}
                  title="移除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="int-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`${inputPlaceholder}（Ctrl/Shift+Enter换行，Enter发送）`}
            rows={1}
          />
          {/* 输入框底部工具栏 */}
          <div className="int-input-toolbar">
            <div className="int-input-tools-left">
              {/* 深度思考开关 */}
              <div
                className={`int-deep-thinking ${deepThinking ? 'active' : ''}`}
                onClick={() => setDeepThinking(!deepThinking)}
                title="深度思考"
              >
                <span className="int-deep-thinking-icon">💡</span>
                <span className="int-deep-thinking-label">深度思考</span>
                <span className={`int-deep-thinking-switch ${deepThinking ? 'on' : ''}`}></span>
              </div>

              <Tooltip title={!webSearchEnabled ? '网络搜索引擎不可用' : (webSearch ? '网络搜索已开启' : '网络搜索已关闭')}>
                <div
                  className={`int-web-search-icon ${webSearch ? 'active' : ''}`}
                  style={!webSearchEnabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  onClick={() => webSearchEnabled && setWebSearch(!webSearch)}
                >
                  🌐
                </div>
              </Tooltip>
              {/* 文件上传按钮 */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                className="int-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="上传文件"
              >
                <PaperClipOutlined />
              </button>
            </div>
            {/* 发送/停止按钮 */}
            {(loading || clarifyPending) ? (
              <button className="int-send-btn stop" onClick={handleStop} title="停止">
                ■
              </button>
            ) : (
              <button
                className="int-send-btn"
                onClick={handleSend}
                disabled={selectedFiles.length === 0 && !inputValue.trim()}
                title="发送"
              >
                ➤
              </button>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default ChatArea;