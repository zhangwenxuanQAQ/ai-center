import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Spin, message, Drawer, Tag, Descriptions } from 'antd';
import { DatabaseOutlined, SettingOutlined, FolderOutlined, SearchOutlined } from '@ant-design/icons';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import KnowledgebaseSetting from './knowledgebase_setting';
import KnowledgebaseDocument from './knowledgebase_document';
import KnowledgebaseRetrieval from './knowledgebase_retrieval';
import '../../styles/common.css';
import './knowledgebase.less';

const getProviderAvatar = (provider: string): string => {
  if (!provider) {
    return '/src/assets/llm/default.svg';
  }
  const lowercaseProvider = provider.toLowerCase();
  return `/src/assets/llm/${lowercaseProvider}.svg`;
};

const KnowledgebaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [knowledgebase, setKnowledgebase] = useState<Knowledgebase | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem(`knowledgebase_${id}_activeTab`) || 'setting';
  });
  const [viewModelDrawerVisible, setViewModelDrawerVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<LLMModel | null>(null);
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (id) {
      fetchKnowledgebase(id);
    }
    fetchModelTypes();
  }, [id]);

  const fetchKnowledgebase = async (kbId: string) => {
    setLoading(true);
    try {
      const data = await knowledgebaseService.getKnowledgebase(kbId);
      setKnowledgebase(data);
    } catch (error) {
      console.error('Failed to fetch knowledgebase:', error);
      message.error('获取知识库信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchModelTypes = async () => {
    try {
      const types = await llmModelService.getModelTypes();
      setModelTypes(types);
    } catch (error) {
      console.error('Failed to fetch model types:', error);
    }
  };

  const handleBack = () => {
    navigate('/knowledgebases');
  };

  const handleViewModel = (model: LLMModel) => {
    setCurrentModel(model);
    setViewModelDrawerVisible(true);
  };

  const getModelTypeName = (modelType: string): string => {
    return modelTypes[modelType] || modelType;
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (id) {
      localStorage.setItem(`knowledgebase_${id}_activeTab`, key);
    }
  };

  if (loading) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!knowledgebase) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          知识库不存在
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'setting',
      label: (
        <span>
          <SettingOutlined />
          知识库配置
        </span>
      ),
      children: <KnowledgebaseSetting knowledgebase={knowledgebase} onUpdate={fetchKnowledgebase} onViewModel={handleViewModel} />,
    },
    {
      key: 'document',
      label: (
        <span>
          <FolderOutlined />
          数据集
        </span>
      ),
      children: <KnowledgebaseDocument knowledgebase={knowledgebase} />,
    },
    {
      key: 'retrieval',
      label: (
        <span>
          <SearchOutlined />
          检索测试
        </span>
      ),
      children: <KnowledgebaseRetrieval knowledgebase={knowledgebase} />,
    },
  ];

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { 
            title: '知识库管理', 
            icon: <DatabaseOutlined />, 
            onClick: handleBack 
          },
          { title: knowledgebase.name }
        ]}
      />

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        type="card"
        className={`knowledgebase-detail-tabs ${theme === 'dark' ? 'dark' : 'light'}`}
        style={{
          height: 'calc(100% - 80px)', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '8px',
          marginBottom: 0,
          background: 'transparent'
        }}
      />

      {/* 模型查看抽屉 */}
      <Drawer
        title="模型详情"
        placement="right"
        onClose={() => setViewModelDrawerVisible(false)}
        open={viewModelDrawerVisible}
        width={600}
        getContainer={false}
        className={`chatbot-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {currentModel && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <img 
                src={getProviderAvatar(currentModel.provider || '')}
                alt={currentModel.provider}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/src/assets/llm/default.svg';
                }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                  {currentModel.name}
                </h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                  {currentModel.provider} · {getModelTypeName(currentModel.model_type)}
                </p>
              </div>
            </div>
            
            <Descriptions 
              bordered 
              column={{ xs: 1, sm: 1, md: 1, lg: 1, xl: 1, xxl: 1 }}
              style={{ 
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8'
              }}
            >
              <Descriptions.Item label="模型类型">
                {getModelTypeName(currentModel.model_type)}
              </Descriptions.Item>
              <Descriptions.Item label="端点地址">
                {currentModel.endpoint || '未配置'}
              </Descriptions.Item>
              <Descriptions.Item label="支持图片">
                {currentModel.support_image ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentModel.status ? 'green' : 'red'}>
                  {currentModel.status ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {currentModel.tags && (Array.isArray(currentModel.tags) ? currentModel.tags : JSON.parse(currentModel.tags)).map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px' }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="配置">
                <pre style={{ 
                  fontSize: '12px', 
                  color: theme === 'dark' ? '#ccc' : '#333',
                  backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto'
                }}>
                  {JSON.stringify(currentModel.config || {}, null, 2)}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {currentModel.created_at || '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {currentModel.updated_at || '未更新'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default KnowledgebaseDetail;