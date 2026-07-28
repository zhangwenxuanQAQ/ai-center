import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UpOutlined, DownOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import './ChatScrollNavigator.less';

export interface UserMessageAnchor {
  id: string;
  label?: string;
}

interface ChatScrollNavigatorProps {
  containerRef: React.RefObject<HTMLDivElement>;
  userMessages: UserMessageAnchor[];
  theme?: 'light' | 'dark';
  /** 滚动到消息时的偏移量（px），避免消息紧贴顶部 */
  scrollOffset?: number;
}

/**
 * 聊天区域滚动导航组件
 * - 置顶按钮：当滚动条不在顶部时显示
 * - 置底按钮：当滚动条不在底部时显示
 * - 右侧导航：为每条用户消息创建锚点，点击定位到对应消息
 *
 * 使用前提：父级容器需要 position: relative，用户消息元素需要 data-user-msg-id 属性
 */
const ChatScrollNavigator: React.FC<ChatScrollNavigatorProps> = ({
  containerRef,
  userMessages,
  theme = 'light',
  scrollOffset = 12,
}) => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string>('');
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldShowTopRef = useRef(false);
  const shouldShowBottomRef = useRef(false);

  // 检测滚动位置
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 60;

    const atTop = scrollTop <= threshold;
    const atBottom = scrollHeight - scrollTop - clientHeight <= threshold;

    const newShowTop = !atTop;
    const newShowBottom = !atBottom;
    const topChanged = newShowTop !== shouldShowTopRef.current;
    const bottomChanged = newShowBottom !== shouldShowBottomRef.current;

    shouldShowTopRef.current = newShowTop;
    shouldShowBottomRef.current = newShowBottom;

    // 滚动位置变化时重新显示按钮并重置3秒自动隐藏计时器
    if (topChanged || bottomChanged) {
      setShowScrollTop(newShowTop);
      setShowScrollBottom(newShowBottom);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      if (newShowTop || newShowBottom) {
        autoHideTimerRef.current = setTimeout(() => {
          if (shouldShowTopRef.current) setShowScrollTop(false);
          if (shouldShowBottomRef.current) setShowScrollBottom(false);
        }, 3000);
      }
    }

    // 计算当前可见的用户消息
    if (userMessages.length === 0) {
      setActiveMessageId('');
      return;
    }

    // 找到当前在视口中最靠近顶部的用户消息
    let closestId = '';
    let closestDist = Infinity;

    for (const um of userMessages) {
      const el = container.querySelector(`[data-user-msg-id="${um.id}"]`) as HTMLElement | null;
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // 消息顶部相对于容器顶部的距离
      const dist = rect.top - containerRect.top;

      // 优先选择已经滚动过去但离顶部最近的消息（dist <= scrollOffset）
      if (dist <= scrollOffset + 20 && Math.abs(dist) < closestDist) {
        closestDist = Math.abs(dist);
        closestId = um.id;
      }
    }

    // 如果没有找到在顶部附近的，找第一个在视口内的
    if (!closestId) {
      for (const um of userMessages) {
        const el = container.querySelector(`[data-user-msg-id="${um.id}"]`) as HTMLElement | null;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top >= containerRect.top && rect.bottom <= containerRect.bottom) {
          closestId = um.id;
          break;
        }
      }
    }

    // 如果滚动到底部，激活最后一条用户消息
    if (atBottom && userMessages.length > 0) {
      closestId = userMessages[userMessages.length - 1].id;
    }

    // 如果滚动到顶部，不激活任何
    if (atTop) {
      closestId = '';
    }

    setActiveMessageId(closestId);
  }, [containerRef, userMessages, scrollOffset]);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }, [containerRef]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [containerRef]);

  // 滚动到指定用户消息
  const scrollToMessage = useCallback((msgId: string) => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-user-msg-id="${msgId}"]`) as HTMLElement | null;
    if (!el) return;
    // 使用容器内滚动，而非 scrollIntoView（避免影响外层布局）
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top + container.scrollTop - scrollOffset;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }, [containerRef, scrollOffset]);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = setTimeout(() => {
        checkScrollPosition();
      }, 50);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // 初始检测
    checkScrollPosition();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [containerRef, checkScrollPosition]);

  // 消息变化时重新检测
  useEffect(() => {
    checkScrollPosition();
  }, [userMessages, checkScrollPosition]);

  // 获取用户消息完整标签
  const getMessageLabel = (msg: UserMessageAnchor): string => {
    return msg.label?.trim() || '';
  };

  const hasUserMessages = userMessages.length > 0;

  return (
    <div className={`chat-scroll-navigator ${theme === 'dark' ? 'dark' : 'light'}`}>
      {/* 置顶按钮 */}
      <Tooltip title="置顶" placement="top">
        <div
          className={`csn-scroll-btn csn-scroll-top ${showScrollTop ? 'visible' : ''}`}
          onClick={scrollToTop}
        >
          <UpOutlined />
        </div>
      </Tooltip>

      {/* 右侧用户消息导航 */}
      {hasUserMessages && (
        <div className="csn-nav-rail">
          {userMessages.map((um, idx) => (
            <Tooltip
              key={um.id}
              title={getMessageLabel(um) || `消息 ${idx + 1}`}
              placement="left"
            >
              <div
                className={`csn-nav-item ${activeMessageId === um.id ? 'active' : ''}`}
                onClick={() => scrollToMessage(um.id)}
              >
                <div className="csn-nav-dot" />
              </div>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 置底按钮 */}
      <Tooltip title="置底" placement="bottom">
        <div
          className={`csn-scroll-btn csn-scroll-bottom ${showScrollBottom ? 'visible' : ''}`}
          onClick={scrollToBottom}
        >
          <DownOutlined />
        </div>
      </Tooltip>
    </div>
  );
};

export default ChatScrollNavigator;
