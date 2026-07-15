import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PanelDragProvider } from './PanelDragContext';
import { PanelMinimizeProvider } from './PanelMinimizeContext';

interface FloatingBallProps {
  position?: string; // top-left, top-right, bottom-left, bottom-right
  theme?: string;
  themeMode?: string;
  colorTheme?: string;
  size?: number;
  animation?: string; // bounce, fade, scale, none
  width?: number;
  height?: number;
  gradientEnabled?: boolean;
  gradientEndColor?: string;
  resizable?: boolean; // 是否允许缩放聊天面板
  maximizable?: boolean; // 是否允许最大化聊天面板
  children: React.ReactNode; // The chat panel content
}

/** 根据位置字符串返回初始 CSS 定位对象（偏移量向屏幕中心靠拢） */
const getInitialPosition = (position: string, size: number): React.CSSProperties => {
  const offset = 48; // 距屏幕边缘的距离（比原来24px更靠中间）
  switch (position) {
    case 'top-left':    return { top: offset, left: offset };
    case 'top-right':   return { top: offset, right: offset };
    case 'bottom-left': return { bottom: offset, left: offset };
    case 'bottom-right':
    default:            return { bottom: offset, right: offset };
  }
};

const FloatingBall: React.FC<FloatingBallProps> = ({
  position = 'bottom-right',
  theme = '#1677ff',
  themeMode = 'light',
  colorTheme = 'default_blue',
  size = 52,
  animation = 'bounce',
  width = 400,
  height = 600,
  gradientEnabled = false,
  gradientEndColor = '',
  resizable = true,
  maximizable = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const panelDragMovedRef = useRef(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelSize, setPanelSize] = useState({ width, height });
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null); // 面板拖动位置
  const [ballPos, setBallPos] = useState<React.CSSProperties>(() => getInitialPosition(position, size));
  const dragStartRef = useRef<{ x: number; y: number; ballX: number; ballY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; panelW: number; panelH: number } | null>(null);
  const panelDragStartRef = useRef<{ x: number; y: number; panelX: number; panelY: number } | null>(null);
  const hasMovedRef = useRef(false);
  const minimizedHeaderTopRef = useRef<number | null>(null); // 最小化时保持 header 位置
  const HISTORY_WIDTH = 260; // 对话历史侧边栏宽度
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // 历史是否展开

  // 历史状态变化回调（传递给 ChatWidget）
  const handleHistoryChange = useCallback((open: boolean) => {
    setIsHistoryOpen(open);
  }, []);

  const animationClass = !isDragging && animation !== 'none' ? `animation-${animation}` : '';

  // 最大化/还原
  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // 最小化/还原（header 位置保持不变）
  const handleMinimize = () => {
    if (!isMinimized) {
      // 即将最小化：记录当前 header 顶部位置
      const defaultPos = getDefaultPanelPos();
      minimizedHeaderTopRef.current = (defaultPos.top as number) ?? null;
      setIsMinimized(true);
    } else {
      // 还原：清除记录的位置，让面板重新计算完整高度位置
      setIsMinimized(false);
      minimizedHeaderTopRef.current = null;
    }
  };

  // 关闭面板
  const handleClose = () => {
    setIsOpen(false);
    setIsMaximized(false);
    setIsMinimized(false);
    minimizedHeaderTopRef.current = null;
    setPanelPos(null); // 关闭时重置面板位置
  };

  // 面板拖动开始（仅对 header 区域的拖动生效，不影响按钮点击）
  const handlePanelDragStart = (e: React.MouseEvent) => {
    if (isMaximized) return;
    // 不拦截按钮等交互元素的点击
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, a')) return;
    panelDragMovedRef.current = false;
    const panel = document.getElementById('int-panel-el');
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panelDragStartRef.current = { x: e.clientX, y: e.clientY, panelX: rect.left, panelY: rect.top };
    setIsPanelDragging(true);
  };

  // 面板拖动事件
  useEffect(() => {
    if (!isPanelDragging) return;

    const handlePanelDragMove = (e: MouseEvent) => {
      if (!panelDragStartRef.current) return;
      const dx = e.clientX - panelDragStartRef.current.x;
      const dy = e.clientY - panelDragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        panelDragMovedRef.current = true;
        minimizedHeaderTopRef.current = null; // 拖动时清除最小化位置记忆
      }
      const currentH = isMinimized ? HEADER_HEIGHT : panelSize.height;
      const currentW = panelSize.width + (isHistoryOpen ? HISTORY_WIDTH : 0);
      const newX = Math.max(0, Math.min(window.innerWidth - currentW, panelDragStartRef.current.panelX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - currentH, panelDragStartRef.current.panelY + dy));
      setPanelPos({ x: newX, y: newY });
    };

    const handlePanelDragEnd = () => {
      setIsPanelDragging(false);
      panelDragStartRef.current = null;
      if (panelDragMovedRef.current) {
        // 阻止拖拽结束后的 click 事件触发按钮
        const preventClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    window.addEventListener('mousemove', handlePanelDragMove);
    window.addEventListener('mouseup', handlePanelDragEnd);
    return () => {
      window.removeEventListener('mousemove', handlePanelDragMove);
      window.removeEventListener('mouseup', handlePanelDragEnd);
    };
  }, [isPanelDragging, panelSize, isHistoryOpen]);

  // 缩放开始
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = { x: e.clientX, y: e.clientY, panelW: panelSize.width, panelH: panelSize.height };
  };

  // 缩放移动和结束
  useEffect(() => {
    if (!resizeStartRef.current) return;

    const handleResizeMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      const newW = Math.max(300, Math.min(800, resizeStartRef.current.panelW + dx));
      const newH = Math.max(400, Math.min(1000, resizeStartRef.current.panelH + dy));
      setPanelSize({ width: newW, height: newH });
    };

    const handleResizeEnd = () => {
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  // 将当前 CSS 定位转为 top/left 绝对像素（用于拖拽起始位置）
  const getBallRect = () => {
    const el = document.getElementById('floating-ball-el');
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    hasMovedRef.current = false;
    const { x, y } = getBallRect();
    dragStartRef.current = { x: e.clientX, y: e.clientY, ballX: x, ballY: y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
      }
      const newX = Math.max(0, Math.min(window.innerWidth - size, dragStartRef.current.ballX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - size, dragStartRef.current.ballY + dy));
      setBallPos({ top: newY, left: newX });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      if (hasMovedRef.current) {
        // 阻止拖拽结束后的 click 事件触发 toggle
        const preventClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', preventClick, { capture: true, once: true });
      } else {
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, size]);

  // 触摸支持
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    hasMovedRef.current = false;
    const { x, y } = getBallRect();
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, ballX: x, ballY: y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
        e.preventDefault();
      }
      const newX = Math.max(0, Math.min(window.innerWidth - size, dragStartRef.current.ballX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - size, dragStartRef.current.ballY + dy));
      setBallPos({ top: newY, left: newX });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      if (!hasMovedRef.current) {
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, size]);

  // 面板位置根据悬浮球在屏幕中的位置动态调整
  // 垂直方向：下半区域在悬浮球上方，上半区域在悬浮球下方
  // 水平方向：左半区域右侧显示，右半区域左侧显示，紧贴悬浮球
  const panelGap = 8; // 面板与悬浮球之间的间距
  const HEADER_HEIGHT = 45; // 聊天界面 header 高度（最小化时使用）

  // 获取悬浮球的实际垂直位置（像素值）
  const getBallTopValue = (): number => {
    if (ballPos.top !== undefined) {
      return ballPos.top as number;
    }
    if (ballPos.bottom !== undefined) {
      return window.innerHeight - (ballPos.bottom as number) - size;
    }
    return window.innerHeight - size - 48; // 默认bottom-right位置
  };

  // 获取悬浮球的实际水平位置（像素值）
  const getBallLeftValue = (): number => {
    if (ballPos.left !== undefined) {
      return ballPos.left as number;
    }
    if (ballPos.right !== undefined) {
      return window.innerWidth - (ballPos.right as number) - size;
    }
    return window.innerWidth - size - 48; // 默认bottom-right位置
  };

  const ballTop = getBallTopValue();
  const ballLeft = getBallLeftValue();
  const isInRightHalf = ballLeft > window.innerWidth / 2;
  const isInLowerHalf = ballTop > window.innerHeight / 2;

  // 计算面板默认位置（根据悬浮球位置，紧贴悬浮球）
  // effectiveWidth 包含历史侧边栏宽度，确保面板向左扩展而非向右
  const effectiveWidth = panelSize.width + (isHistoryOpen ? HISTORY_WIDTH : 0);
  const getDefaultPanelPos = (): React.CSSProperties => {
    const pw = effectiveWidth;
    const ph = isMinimized ? HEADER_HEIGHT : panelSize.height;
    // 水平位置：紧贴悬浮球左侧或右侧
    const left = isInRightHalf
      ? Math.max(0, ballLeft - pw - panelGap) // 球体在右半区域，面板左侧显示
      : Math.min(window.innerWidth - pw, ballLeft + size + panelGap); // 球体在左半区域，面板右侧显示
    // 垂直位置：下半区在悬浮球上方，上半区在悬浮球下方
    let top: number;
    if (isMinimized && minimizedHeaderTopRef.current !== null) {
      // 最小化时保持 header 位置不变（避免下半区面板收起时 header 跳动）
      top = minimizedHeaderTopRef.current;
    } else {
      top = isInLowerHalf
        ? Math.max(0, ballTop - ph - panelGap) // 球体在下半区域，面板在上方
        : Math.min(window.innerHeight - ph, ballTop + size + panelGap); // 球体在上半区域，面板在下方
    }
    return { left, top };
  };

  // 面板位置：优先使用用户拖动后的位置，否则使用默认位置
  const panelPosStyle: React.CSSProperties = isMaximized
    ? {}
    : panelPos
      ? { left: panelPos.x, top: panelPos.y }
      : getDefaultPanelPos();

  // 面板高度：最小化时只显示 header
  const panelHeightStyle = isMaximized
    ? 'auto'
    : isMinimized
      ? `${HEADER_HEIGHT}px`
      : `${panelSize.height}px`;

  const minimizeValue = { isMinimized, onToggleMinimize: handleMinimize };

  return (
    <PanelDragProvider value={isMaximized ? null : handlePanelDragStart}>
      <PanelMinimizeProvider value={minimizeValue}>
      {/* Chat Panel */}
      <div
        id="int-panel-el"
        className={`int-sidebar-panel ${isOpen ? 'visible' : 'hidden'} ${isMaximized ? 'maximized' : ''}`}
        data-color-theme={colorTheme}
        style={{
          width: isMaximized ? 'auto' : `${effectiveWidth}px`,
          height: panelHeightStyle,
          ...panelPosStyle,
        }}
      >
        {/* 控制按钮区域（可拖动） */}
        <div
          className="int-panel-controls"
          onMouseDown={handlePanelDragStart}
          style={{ cursor: isMaximized ? 'default' : 'move' }}
        >
          {/* 最小化按钮 */}
          {!isMaximized && (
            <button
              className="int-panel-control-btn"
              onClick={handleMinimize}
              title={isMinimized ? '还原' : '最小化'}
            >
              {isMinimized ? '▼' : '—'}
            </button>
          )}
          {/* 最大化按钮（配置允许时显示） */}
          {maximizable && (
            <button
              className="int-panel-control-btn"
              onClick={handleMaximize}
              title={isMaximized ? '还原' : '最大化'}
            >
              {isMaximized ? '⤓' : '⤢'}
            </button>
          )}
          {/* 关闭按钮 */}
          <button
            className="int-panel-control-btn"
            onClick={handleClose}
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="int-panel-content">
          {React.Children.map(children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<any>, { onHistoryChange: handleHistoryChange })
              : child
          )}
        </div>

        {/* 缩放区域（配置允许时显示，最小化和最大化时隐藏） */}
        {resizable && !isMaximized && !isMinimized && (
          <div className="int-panel-resize-handle" onMouseDown={handleResizeStart}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M14 14L10 14L14 10L14 14Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
        )}
      </div>

      {/* Floating Ball */}
      <div
        id="floating-ball-el"
        className={`int-floating-ball ${animationClass}`}
        data-color-theme={colorTheme}
        style={{
          ...ballPos,
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.round(size * 0.46)}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title={isOpen ? '关闭' : '打开聊天（可拖拽）'}
      >
        {isOpen ? '✕' : '💬'}
      </div>
      </PanelMinimizeProvider>
    </PanelDragProvider>
  );
};

export default FloatingBall;
