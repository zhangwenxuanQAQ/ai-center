import React from 'react';
import { Button, Input, Tree } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { TreeProps } from 'antd/es/tree';

interface CategorySidebarProps {
  title: string;
  addButtonText: string;
  onAdd: () => void;
  addButtonStyle?: React.CSSProperties;
  addButtonSize?: 'small' | 'middle' | 'large';
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  selectedKeys: React.Key[];
  expandedKeys: React.Key[];
  onSelect: TreeProps['onSelect'];
  onExpand: TreeProps['onExpand'];
  treeData: TreeProps['treeData'];
  showIcon?: boolean;
  theme: 'light' | 'dark';
  className?: string;
  treeContainerStyle?: React.CSSProperties;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  title,
  addButtonText,
  onAdd,
  addButtonStyle,
  addButtonSize = 'small',
  showSearch = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = '请输入',
  selectedKeys,
  expandedKeys,
  onSelect,
  onExpand,
  treeData,
  showIcon = true,
  theme,
  className,
  treeContainerStyle,
}) => {
  return (
    <>
      <div
        className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{title}</span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAdd}
          size={addButtonSize}
          style={addButtonStyle}
        >
          {addButtonText}
        </Button>
      </div>

      {showSearch && (
        <div className={`sidebar-search ${theme === 'dark' ? 'dark' : 'light'}`}>
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            prefix={<SearchOutlined />}
            style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
              border: 'none',
              borderRadius: '8px',
              height: '32px',
              color: theme === 'dark' ? '#ffffff' : '#000000',
              marginBottom: '12px',
            }}
          />
        </div>
      )}

      {treeContainerStyle ? (
        <div style={{ ...treeContainerStyle }} className="category-tree-container">
          <Tree
            showIcon={showIcon}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onSelect={onSelect}
            onExpand={onExpand}
            treeData={treeData}
            className={`category-tree ${theme === 'dark' ? 'dark' : 'light'} ${className || ''}`}
          />
        </div>
      ) : (
        <Tree
          showIcon={showIcon}
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onSelect={onSelect}
          onExpand={onExpand}
          treeData={treeData}
          className={`category-tree ${theme === 'dark' ? 'dark' : 'light'} ${className || ''}`}
        />
      )}
    </>
  );
};

export default CategorySidebar;