import React from 'react';
import classNames from 'classnames';
import styles from './node.module.less';
import { getComponentIcon, getDefaultComponentIcon } from '../../../utils/component_icon';

interface NodeBodyProps {
  label?: string;
  name?: string;
  icon?: string;
  iconSize?: number;
  className?: string;
  children?: React.ReactNode;
}

export function NodeBody({
  label,
  name,
  icon,
  iconSize = 27,
  className,
  children,
}: NodeBodyProps) {
  const nodeLabel = name || label || 'Node';
  const iconSrc = icon || getComponentIcon(label || '');

  return (
    <div className={classNames('flex flex-col', className)}>
      <div className={classNames('flex items-center gap-2 p-2', styles.nodeHeader)}>
        <img
          src={iconSrc}
          alt={nodeLabel}
          style={{ width: iconSize, height: iconSize, flexShrink: 0 }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== getDefaultComponentIcon()) {
              target.src = getDefaultComponentIcon();
            }
          }}
        />
        <span className="truncate text-center font-semibold text-sm flex-1">
          {nodeLabel}
        </span>
      </div>
      {children}
    </div>
  );
}

interface NodeContentProps {
  children: React.ReactNode;
  className?: string;
}

export function NodeContent({ children, className }: NodeContentProps) {
  return (
    <div className={classNames(styles.nodeText, className)}>
      {children}
    </div>
  );
}

interface NodeParametersProps {
  children: React.ReactNode;
  className?: string;
}

export function NodeParameters({ children, className }: NodeParametersProps) {
  return (
    <div className={classNames(styles.nodeText, 'p-2', className)}>
      {children}
    </div>
  );
}
