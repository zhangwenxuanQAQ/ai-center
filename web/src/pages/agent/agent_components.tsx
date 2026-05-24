import React from 'react';
import { ApartmentOutlined, ThunderboltOutlined, SearchOutlined, DatabaseOutlined, CodeOutlined, MessageOutlined } from '@ant-design/icons';

interface AgentComponentsProps {
  onDragStart: (event: React.DragEvent, nodeType: string, nodeData: any) => void;
}

interface ComponentItem {
  name: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  description?: string;
}

const AgentComponents: React.FC<AgentComponentsProps> = ({ onDragStart }) => {
  const components: ComponentItem[] = [
    { name: 'Begin', label: '开始', category: '基础', icon: <ApartmentOutlined />, description: '工作流开始节点' },
    { name: 'Answer', label: '回答', category: '基础', icon: <MessageOutlined />, description: '工作流结束节点' },
    { name: 'Generate', label: '生成', category: 'LLM', icon: <ThunderboltOutlined />, description: '大模型生成节点' },
    { name: 'Retrieval', label: '检索', category: '知识库', icon: <SearchOutlined />, description: '知识库检索节点' },
    { name: 'KeywordExtract', label: '关键词提取', category: 'LLM', icon: <ThunderboltOutlined />, description: '关键词提取节点' },
    { name: 'WenCai', label: '问财', category: '数据源', icon: <DatabaseOutlined />, description: '问财数据查询' },
    { name: 'AkShare', label: 'AKShare', category: '数据源', icon: <DatabaseOutlined />, description: 'AKShare数据查询' },
    { name: 'Code', label: '代码执行', category: '工具', icon: <CodeOutlined />, description: '代码执行节点' },
  ];

  const categories = [...new Set(components.map(c => c.category))];

  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
      <h4 style={{ marginBottom: '16px', fontWeight: 500 }}>组件列表</h4>
      {categories.map(category => (
        <div key={category} style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontWeight: 500, 
            marginBottom: '8px', 
            fontSize: '12px',
            color: '#999',
            textTransform: 'uppercase'
          }}>
            {category}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {components
              .filter(comp => comp.category === category)
              .map(comp => (
                <div
                  key={comp.name}
                  draggable
                  onDragStart={(e) => onDragStart(e, comp.name, { label: comp.name, name: comp.label })}
                  style={{
                    padding: '12px',
                    border: '1px solid #e8e8e8',
                    borderRadius: '6px',
                    cursor: 'grab',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#1890ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#e8e8e8';
                  }}
                >
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}>
                    {comp.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{comp.label}</div>
                    {comp.description && (
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                        {comp.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentComponents;
