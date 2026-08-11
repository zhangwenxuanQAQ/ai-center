import React, { useState } from 'react';
import { Button, Input, Space, Tag, message } from 'antd';
import { QuestionCircleOutlined, CheckOutlined, EnterOutlined } from '@ant-design/icons';

interface IntegrationClarifyCardProps {
  result: any;
  chatId: string;
  apiKey: string;
  theme: 'light' | 'dark';
  toolCallId?: string;
  messageId?: string;
  disabled?: boolean;
  onResponded?: (toolCallId: string) => void;
}

/**
 * 获取API基础URL
 * 使用环境变量配置，与 integrationChat.ts 保持一致
 */
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl;
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

const IntegrationClarifyCard: React.FC<IntegrationClarifyCardProps> = ({
  result,
  chatId,
  apiKey,
  theme,
  toolCallId,
  messageId,
  disabled,
  onResponded,
}) => {
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const question = result?.question || '';
  const choices: string[] = result?.choices || [];
  const multiSelect: boolean = result?.multi_select || false;
  const hasChoices = choices.length > 0;

  const handleToggleChoice = (choice: string) => {
    if (submitted) return;
    if (multiSelect) {
      setSelectedChoices(prev =>
        prev.includes(choice) ? prev.filter(c => c !== choice) : [...prev, choice]
      );
    } else {
      setSelectedChoices([choice]);
    }
  };

  const handleSubmit = async () => {
    let responseText: string;

    if (showCustomInput && customInput.trim()) {
      responseText = customInput.trim();
    } else if (selectedChoices.length > 0) {
      responseText = Array.isArray(selectedChoices) ? selectedChoices.join('、') : selectedChoices;
    } else if (!hasChoices && customInput.trim()) {
      responseText = customInput.trim();
    } else {
      message.warning(hasChoices ? '请选择一个选项' : '请输入回复内容');
      return;
    }

    setSubmitting(true);
    try {
      // 通过集成聊天接口提交，后端检测到最新消息为 clarify 工具时会走澄清回复逻辑
      const res = await fetch(`${API_BASE_URL}/aicenter/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: [{ type: 'text', content: responseText }],
          chat_id: chatId,
          message_id: messageId,
          stream: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.code !== 200) throw new Error(data.message || '提交回复失败');
      setSubmitted(true);
      if (toolCallId) {
        onResponded?.(toolCallId);
      }
    } catch (e: any) {
      message.error(e?.message || '提交回复失败');
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`clarify-card ${isDark ? 'clarify-card-dark' : 'clarify-card-light'}`}>
      <div className="clarify-card-header">
        <QuestionCircleOutlined className="clarify-card-icon" />
        <span className="clarify-card-question">{question}</span>
      </div>

      {hasChoices && (
        <div className="clarify-card-choices">
          {choices.map((choice, idx) => {
            const isSelected = selectedChoices.includes(choice);
            return (
              <div
                key={idx}
                className={`clarify-card-choice ${isSelected ? 'clarify-card-choice-selected' : ''} ${(submitted || disabled) ? 'clarify-card-choice-disabled' : ''}`}
                onClick={() => !(submitted || disabled) && handleToggleChoice(choice)}
              >
                <div className={`clarify-card-choice-marker ${multiSelect ? 'checkbox' : 'radio'} ${isSelected ? 'checked' : ''}`} />
                <span className="clarify-card-choice-text">{choice}</span>
                {isSelected && <CheckOutlined className="clarify-card-choice-check" />}
              </div>
            );
          })}
          {/* 自定义输入选项 */}
          {!submitted && !disabled && (
            <div
              className={`clarify-card-choice ${showCustomInput ? 'clarify-card-choice-selected' : ''}`}
              onClick={() => setShowCustomInput(!showCustomInput)}
            >
              <div className={`clarify-card-choice-marker ${multiSelect ? 'checkbox' : 'radio'} ${showCustomInput ? 'checked' : ''}`} />
              <span className="clarify-card-choice-text">其他（自定义输入）</span>
              {showCustomInput && <CheckOutlined className="clarify-card-choice-check" />}
            </div>
          )}
        </div>
      )}

      {/* 自定义输入框（有选项时选择"其他"显示，无选项时始终显示） */}
      {(showCustomInput || !hasChoices) && !submitted && !disabled && (
        <div className="clarify-card-input-area">
          <Input.TextArea
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder="请输入你的回复..."
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={submitted}
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      )}

      {/* 已提交状态 */}
      {submitted && (
        <div className="clarify-card-submitted">
          <CheckOutlined style={{ marginRight: 6, color: '#52c41a' }} />
          <span>已回复：</span>
          <Tag color="blue" style={{ marginLeft: 4 }}>
            {Array.isArray(selectedChoices) && selectedChoices.length > 0
              ? selectedChoices.join('、')
              : customInput || '已提交'}
          </Tag>
        </div>
      )}

      {/* 提交按钮 */}
      {!submitted && !disabled && (
        <div className="clarify-card-footer">
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<EnterOutlined />}
              loading={submitting}
              onClick={handleSubmit}
            >
              提交回复
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default IntegrationClarifyCard;
