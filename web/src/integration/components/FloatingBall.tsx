import React, { useState, useRef, useEffect } from 'react';

interface FloatingBallProps {
  position?: string; // top-left, top-right, bottom-left, bottom-right
  theme?: string;
  themeMode?: string;
  size?: number;
  animation?: string; // bounce, fade, scale, none
  panelTitle?: string;
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
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelSize, setPanelSize] = useState({ width, height });
  const [ballPos, setBallPos] = useState<React.CSSProperties>(() => getInitialPosition(position, size));
  const dragStartRef = useRef<{ x: number; y: number; ballX: number; ballY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; panelW: number; panelH: number } | null>(null);
  const hasMovedRef = useRef(false);

  const animationClass = !isDragging && animation !== 'none' ? `animation-${animation}` : '';

  // 计算球体背景：渐变 or 纯色（使用径向渐变，圆心扩散）
  const ballBackground = gradientEnabled && gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : theme;

  // 计算控制按钮背景样式（使用径向渐变）
  const controlBtnBackground = gradientEnabled && gradientEndColor && gradientEndColor !== 'none'
    ? `radial-gradient(circle at center, ${theme} 0%, ${gradientEndColor} 100%)`
    : theme;

  // 最大化/还原
  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  // 关闭面板
  const handleClose = () => {
    setIsOpen(false);
    setIsMaximized(false);
  };

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
  // 垂直方向：下半区域向上打开，上半区域向下打开
  // 水平方向：左半区域右侧显示，右半区域左侧显示
  const panelOffset = size + 4;

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
  const isInLowerHalf = ballTop > window.innerHeight / 2;
  const isInRightHalf = ballLeft > window.innerWidth / 2;

  // 计算面板位置
  const panelPos: React.CSSProperties = isMaximized
    ? {} // 最大化时不使用定位
    : {
        // 根据球体在屏幕的水平位置决定面板左右位置
        ...(isInRightHalf
          ? { right: window.innerWidth - ballLeft } // 球体在右半区域，面板左侧显示（right定位）
          : { left: ballLeft + panelOffset } // 球体在左半区域，面板右侧显示（left定位）
        ),
        // 根据球体在屏幕的垂直位置决定面板打开方向
        ...(isInLowerHalf
          ? { bottom: window.innerHeight - ballTop + panelOffset } // 球体在下半区域，面板向上打开
          : { top: ballTop + panelOffset } // 球体在上半区域，面板向下打开
        ),
      };

  return (
    <>
      {/* Chat Panel */}
      <div
        className={`int-sidebar-panel ${isOpen ? 'visible' : 'hidden'} ${isMaximized ? 'maximized' : ''}`}
        style={{
          width: isMaximized ? 'auto' : `${panelSize.width}px`,
          height: isMaximized ? 'auto' : `${panelSize.height}px`,
          ...panelPos,
        }}
      >
        {/* 控制按钮区域 */}
        <div className="int-panel-controls">
          {/* 最大化按钮（配置允许时显示） */}
          {maximizable && (
            <button
              className="int-panel-control-btn"
              onClick={handleMaximize}
              title={isMaximized ? '还原' : '最大化'}
              style={{ background: controlBtnBackground }}
            >
              {isMaximized ? '⤓' : '⤢'}
            </button>
          )}
          {/* 关闭按钮 */}
          <button
            className="int-panel-control-btn"
            onClick={handleClose}
            title="关闭"
            style={{ background: controlBtnBackground }}
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="int-panel-content">
          {children}
        </div>

        {/* 缩放区域（配置允许时显示） */}
        {resizable && !isMaximized && (
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
        style={{
          ...ballPos,
          width: `${size}px`,
          height: `${size}px`,
          background: ballBackground,
          fontSize: `${Math.round(size * 0.46)}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title={isOpen ? '关闭' : '打开聊天（可拖拽）'}
      >
        {isOpen ? '✕' : '💬'}
      </div>
    </>
  );
};

export default FloatingBall;
