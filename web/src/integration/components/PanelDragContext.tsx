import React from 'react';

/** 面板拖拽上下文：FloatingBall 提供拖拽方法，ChatArea header 消费 */
const PanelDragContext = React.createContext<((e: React.MouseEvent) => void) | null>(null);

export const PanelDragProvider = PanelDragContext.Provider;
export const usePanelDrag = () => React.useContext(PanelDragContext);
