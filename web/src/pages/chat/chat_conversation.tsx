import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Switch, Modal, Slider, message, Popconfirm, Tooltip, Dropdown, Empty, Spin } from 'antd';
import { SendOutlined, ClearOutlined, SettingOutlined, RobotOutlined, BulbOutlined, LoadingOutlined, DownOutlined, RightOutlined, CopyOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { chatbotService, Chatbot } from '../../services/chatbot';
import { chatService, Conversation, Message } from '../../services/chat';

const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  reasoning_content?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(0.9);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchModels();
    fetchChatbots();
  }, []);

  useEffect(() => {
    if (conversation) {
      fetchMessages(conversation.id);
    } else {
      setMessages([]);
    }
  }, [conversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const result = await llmModelService.getLLMModels(1, 100, undefined, undefined, undefined, 'true');
      const textModels = result.data.filter((model: LLMModel) => 
        model.model_type === 'text' || model.model_type === 'vision' || model.model_type === 'multimodal'
      );
      setModels(textModels);
      if (textModels.length > 0) {
        setSelectedModel(textModels[0]);
        setSelectedType('model');
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

  const fetchMessages = async (conversationId: string) => {
    setLoading(true);
    try {
      const result = await chatService.getMessages(conversationId, 1, 50);
      setMessages(result.items);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      // 失败时显示空消息列表
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    let currentConversation = conversation;

    // 如果没有选中的对话，先创建一个新对话
    if (!currentConversation) {
      try {
        // 标题为用户问题的前20个字符
        const title = inputValue.trim().substring(0, 20);
        // 模型参数配置
        const config = {
          temperature,
          max_tokens: maxTokens,
          top_p: topP
        };
        
        currentConversation = await chatService.createConversation(
          title,
          selectedModel?.id,
          selectedChatbot?.id,
          config
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
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
      const responseMessage = await chatService.sendMessage(currentConversation.id, inputValue);
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? {
              ...responseMessage,
              id: assistantMessageId // 保持前端生成的ID一致
            }
          : msg
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
      message.error('发送失败，请重试');
      
      // 失败时显示错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: '抱歉，发送消息时出现错误，请重试',
              reasoning_content: undefined
            }
          : msg
      ));
    } finally {
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

  const handleClearMessages = () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空当前对话的所有消息吗？',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        setMessages([]);
        message.success('已清空对话');
      },
    });
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
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) {
      message.error('内容不能为空');
      return;
    }
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const updatedMessages = messages.slice(0, messageIndex);
    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent('');
    
    setInputValue(editingContent);
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages, editingContent);
    }, 100);
  };

  const handleSendMessageWithMessages = async (previousMessages: Message[], content: string) => {
    if (loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    const newMessages = [...previousMessages, userMessage];
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const replyContent = `这是一个模拟的回复。您的问题是：${content}`;

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              content: replyContent,
              reasoning_content: deepThinking ? '正在分析用户的问题...' : undefined,
              usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
            }
          : msg
      ));
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '抱歉，生成回复时出现错误' }
          : msg
      ));
    } finally {
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

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;
    
    const userMessage = messages[messageIndex - 1];
    if (userMessage.role !== 'user') return;
    
    const updatedMessages = messages.slice(0, messageIndex);
    setMessages(updatedMessages);
    
    setTimeout(() => {
      handleSendMessageWithMessages(updatedMessages.slice(0, -1), userMessage.content);
    }, 100);
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

  const handleSelectModel = (model: LLMModel) => {
    setSelectedModel(model);
    setSelectedChatbot(null);
    setSelectedType('model');
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
    const isUser = msg.role === 'user';
    
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
          {msg.role === 'assistant' && (thinkingMessageId === msg.id && deepThinking) && (
            <div className="message-reasoning">
              <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                <LoadingOutlined spin />
                <BulbOutlined /> 正在思考中
              </div>
              {expandedReasoning.has(msg.id) && msg.reasoning_content && (
                <div className="reasoning-text">{msg.reasoning_content}</div>
              )}
            </div>
          )}
          {msg.role === 'assistant' && msg.reasoning_content && !(thinkingMessageId === msg.id && deepThinking) && (
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
              {expandedReasoning.has(msg.id) && (
                <div className="reasoning-text">{msg.reasoning_content}</div>
              )}
            </div>
          )}
          {editingMessageId === msg.id ? (
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
          ) : (
            <div className={`message-text ${theme === 'dark' ? 'dark' : 'light'}`}>{msg.content}</div>
          )}
          <div className="message-footer">
            <span className="message-time">
              {new Date(msg.created_at).toLocaleTimeString()}
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
            {loading && thinkingMessageId && !messages.find(m => m.id === thinkingMessageId)?.content && (
              <div className="message assistant">
                <div className={`message-avatar ${theme === 'dark' ? 'dark' : 'light'}`}>
                  <img 
                    src={currentSelection?.avatar || '/src/assets/llm/default.svg'} 
                    alt="AI" 
                    className="avatar-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/src/assets/llm/default.svg';
                    }}
                  />
                </div>
                <div className="message-content">
                  <div className="thinking-indicator">
                    <LoadingOutlined spin />
                    <BulbOutlined /> 正在思考中...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Shift+Enter换行，Enter发送)"
            autoSize={{ minRows: 5, maxRows: 12 }}
            className={`chat-input ${theme === 'dark' ? 'dark' : 'light'}`}
          />
          <div className="chat-input-inner-footer">
            <div 
              className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} 
              onClick={() => setDeepThinking(!deepThinking)}
            >
              <BulbOutlined className={deepThinking ? 'bulb-active' : ''} />
              <span>深度思考</span>
              <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
            </div>
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim() || !currentSelection}
            className="input-send-button"
          />
        </div>
      </div>

      <Modal
        title="模型配置"
        open={isConfigModalVisible}
        onCancel={() => setIsConfigModalVisible(false)}
        footer={null}
        width={500}
        className={`chat-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div className="config-item">
          <label>Temperature (温度)</label>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={setTemperature}
            marks={{ 0: '0', 1: '1', 2: '2' }}
          />
          <span className="config-value">{temperature}</span>
        </div>
        <div className="config-item">
          <label>Max Tokens (最大令牌数)</label>
          <Slider
            min={256}
            max={8192}
            step={256}
            value={maxTokens}
            onChange={setMaxTokens}
            marks={{ 256: '256', 4096: '4096', 8192: '8192' }}
          />
          <span className="config-value">{maxTokens}</span>
        </div>
        <div className="config-item">
          <label>Top P</label>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={topP}
            onChange={setTopP}
            marks={{ 0: '0', 0.5: '0.5', 1: '1' }}
          />
          <span className="config-value">{topP}</span>
        </div>
        <div className="config-actions">
          <Button onClick={() => setIsConfigModalVisible(false)}>取消</Button>
          <Button type="primary" onClick={() => {
            message.success('配置已保存');
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
