import React, { useState, useEffect } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { Input, Collapse } from 'antd';
import { agentService, AgentComponent } from '../../services/agent';
import { getComponentIcon, getDefaultComponentIcon } from '../../utils/component_icon';

const { Panel } = Collapse;

interface AgentComponentsProps {
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: any) => void;
}

interface CategoryGroup {
  name: string;
  displayName: string;
  components: AgentComponent[];
}

const getCategoryDisplayName = (category: string): string => {
  if (!category || category.toLowerCase() === 'default') {
    return '默认组件';
  }
  return category;
};

const AgentComponents: React.FC<AgentComponentsProps> = ({ onDragStart }) => {
  const [components, setComponents] = useState<AgentComponent[]>([]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const theme = document.body.getAttribute('data-theme') || 'dark';
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const data = await agentService.getComponents();
      setComponents(data);
      const categories = [...new Set(data.map(c => c.category))];
      setActiveKeys(categories.map(cat => cat || 'default'));
    } catch (error) {
      console.error('Failed to fetch components:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredComponents = components.filter(component => {
    if (!searchText) return true;
    const title = component.component_title || component.component_name || '';
    return title.toLowerCase().includes(searchText.toLowerCase());
  });

  const groupedComponents: CategoryGroup[] = filteredComponents.reduce((acc, component) => {
    const categoryKey = component.category || 'default';
    const existingGroup = acc.find(group => group.name === categoryKey);
    if (existingGroup) {
      existingGroup.components.push(component);
    } else {
      acc.push({
        name: categoryKey,
        displayName: getCategoryDisplayName(component.category),
        components: [component]
      });
    }
    return acc;
  }, [] as CategoryGroup[]);

  const sortedGroupedComponents = groupedComponents.sort((a, b) => {
    if (a.displayName === '基础组件') return -1;
    if (b.displayName === '基础组件') return 1;
    return 0;
  });

  const hoverBgColor = isDark ? '#2a2a2a' : '#f5f5f5';

  if (loading) {
    return (
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="ant-spin ant-spin-spinning">
          <span className="ant-spin-dot"></span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>
        {`
          .component-list-scroll::-webkit-scrollbar {
            display: none;
          }
          .ant-collapse-header {
            text-align: left !important;
          }
        `}
      </style>
      <div style={{ padding: '16px', paddingBottom: '8px' }}>
        <Input
          placeholder="搜索组件"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: '100%' }}
          allowClear
        />
      </div>
      <div 
        className="component-list-scroll"
        style={{ 
          padding: '4px 8px', 
          paddingTop: '8px',
          flex: 1, 
          overflowY: 'auto', 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none' 
        }}
      >
        {sortedGroupedComponents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
            {searchText ? '未找到匹配的组件' : '暂无可用组件'}
          </div>
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            ghost
            expandIconPosition="start"
          >
            {sortedGroupedComponents.map(group => (
              <Panel
                header={
                  <span style={{ fontWeight: 500, fontSize: '14px', textAlign: 'left', display: 'block' }}>
                    {group.displayName}
                    <span style={{ fontSize: '12px', color: '#999', fontWeight: 400, marginLeft: '8px' }}>
                      ({group.components.length})
                    </span>
                  </span>
                }
                key={group.name}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.components.map(component => (
                    <div
                      key={component.component_name}
                      draggable
                      onDragStart={(e) => onDragStart(e, component.component_name, { label: component.component_title || component.component_name, name: component.component_name })}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: 'grab',
                        transition: 'all 0.3s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hoverBgColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <img
                        src={component.icon || getComponentIcon(component.component_name)}
                        alt={component.component_name}
                        style={{ width: '27px', height: '27px' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== getDefaultComponentIcon()) {
                            target.src = getDefaultComponentIcon();
                          }
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>
                          {component.component_title || component.component_name}
                        </div>
                        {component.description && (
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {component.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    </div>
  );
};

export default AgentComponents;
