import React, { useState, useEffect } from 'react';
import { Layout, Slider, Select, Input, Button, Card, Tag, Spin, Empty } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import { RETRIEVAL_CONFIGS } from '../../constants/knowledgebase';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

interface KnowledgebaseRetrievalProps {
  knowledgebase: Knowledgebase;
}

interface RetrievalConfig {
  [key: string]: any;
}

interface RetrievalResult {
  id: string;
  content: string;
  score: number;
  document_id?: string;
  document_name?: string;
  position?: number;
}

const KnowledgebaseRetrieval: React.FC<KnowledgebaseRetrievalProps> = ({ knowledgebase }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [retrievalConfig, setRetrievalConfig] = useState<RetrievalConfig>({});
  const [results, setResults] = useState<RetrievalResult[]>([]);

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
    const defaultConfig: RetrievalConfig = {};
    RETRIEVAL_CONFIGS.forEach(config => {
      defaultConfig[config.key] = config.default;
    });
    if (knowledgebase.retrieval_config) {
      Object.entries(knowledgebase.retrieval_config).forEach(([key, value]) => {
        defaultConfig[key] = value;
      });
    }
    setRetrievalConfig(defaultConfig);
  }, [knowledgebase.retrieval_config]);

  const handleRetrieval = async () => {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    try {
      const data = await knowledgebaseService.retrieve(
        knowledgebase.id,
        query,
        retrievalConfig
      );
      setResults(data || []);
    } catch (error) {
      console.error('Failed to retrieve:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.5) return 'warning';
    return 'error';
  };

  return (
    <Layout className="knowledgebase-layout" style={{ height: '100%' }}>
      <LeftSider
        width={320}
        className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`}>
          检索配置
        </div>
        <div style={{ padding: '20px 16px', overflowY: 'auto' }}>
          {RETRIEVAL_CONFIGS.map(config => (
            <div key={config.key} style={{ marginBottom: '24px' }}>
              <div className={`config-label ${theme === 'dark' ? 'dark' : 'light'}`}>
                {config.label}
              </div>
              {config.type === 'slider' ? (
                <Slider
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={retrievalConfig[config.key]}
                  onChange={(value) => setRetrievalConfig({ ...retrievalConfig, [config.key]: value })}
                  style={{ marginTop: '8px' }}
                />
              ) : (
                <Select
                  value={retrievalConfig[config.key]}
                  onChange={(value) => setRetrievalConfig({ ...retrievalConfig, [config.key]: value })}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {config.options?.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              )}
            </div>
          ))}
        </div>
      </LeftSider>

      <Content className={`knowledgebase-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <Input
            placeholder="请输入检索问题"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRetrieval();
              }
            }}
            prefix={<SearchOutlined />}
            style={{
              flex: 1,
              height: '44px',
              borderRadius: '22px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
            className="no-border-input"
          />
          <Button
            type="primary"
            onClick={handleRetrieval}
            loading={loading}
            style={{
              height: '44px',
              padding: '0 32px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              boxShadow: 'none',
              fontSize: '16px'
            }}
          >
            开始检索
          </Button>
        </div>

        <div style={{ 
          flex: 1, 
          minHeight: 0,
          overflowY: 'auto', 
          marginBottom: '0',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {loading ? (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          ) : results.length === 0 ? (
            <Empty 
              description="请输入问题并点击开始检索" 
              className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {results.map((result, index) => (
                <Card
                  key={result.id}
                  className={`knowledgebase-document-card ${theme === 'dark' ? 'dark' : 'light'}`}
                  style={{ border: 'none', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileTextOutlined style={{ fontSize: '20px', color: '#667eea' }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                          {result.document_name || '未命名文档'}
                        </div>
                        {result.position !== undefined && (
                          <div style={{ fontSize: '13px', opacity: 0.7 }}>
                            位置: {result.position}
                          </div>
                        )}
                      </div>
                    </div>
                    <Tag color={getScoreColor(result.score)}>
                      相似度: {(result.score * 100).toFixed(1)}%
                    </Tag>
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    lineHeight: 1.8, 
                    opacity: 0.9 
                  }}>
                    {result.content}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default KnowledgebaseRetrieval;
