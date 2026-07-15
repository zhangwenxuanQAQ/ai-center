import React from 'react';

/** 面板最小化上下文：FloatingBall 提供最小化状态，ChatArea 消费以隐藏内容 */
interface PanelMinimizeValue {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

const PanelMinimizeContext = React.createContext<PanelMinimizeValue | null>(null);

export const PanelMinimizeProvider = PanelMinimizeContext.Provider;
export const usePanelMinimize = () => React.useContext(PanelMinimizeContext);
