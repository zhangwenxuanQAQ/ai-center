import React, { useState, useEffect } from 'react';
import { Layout, Slider, Select, Input, Button, Card, Tag, Spin, Empty, Pagination, Image, Popover, InputNumber, Tooltip } from 'antd';
import { SearchOutlined, FileTextOutlined, DownOutlined, UpOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

interface KnowledgebaseRetrievalProps {
  knowledgebase: Knowledgebase;
}

interface RetrievalChunk {
  chunk_id: string;
  content_with_weight: string;
  content_ltks: string;
  doc_id: string;
  docnm_kwd: string;
  kb_id: string;
  important_kwd: string[];
  image_id: string;
  image_base64?: string;
  similarity: number;
  vector_similarity: number;
  term_similarity: number;
}

interface RetrievalConfig {
  [key: string]: any;
}

interface RetrievalConfigItem {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  options?: Array<{ value: string; label: string }>;
}

const ChunkCard: React.FC<{
  chunk: RetrievalChunk;
  theme: 'light' | 'dark';
  isExpanded: boolean;
  onToggleExpand: (chunkId: string) => void;
}> = ({ chunk, theme, isExpanded, onToggleExpand }) => {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [needsGradient, setNeedsGradient] = useState(false);

  useEffect(() => {
    if (contentRef.current && !isExpanded) {
      const contentHeight = contentRef.current.scrollHeight;
      setNeedsGradient(contentHeight > 200);
    }
  }, [chunk.content_with_weight, isExpanded]);

  return (
    <Card
      className={`knowledgebase-document-card ${theme === 'dark' ? 'dark' : 'light'}`}
      style={{
        borderRadius: 8,
        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
        border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8',
        marginBottom: 12,
      }}
      headStyle={{
        textAlign: 'left',
        borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined style={{ color: '#667eea' }} />
          <span style={{ fontWeight: 500, fontSize: 13 }}>
            {chunk.docnm_kwd || '未命名文档'}
          </span>
          <Tag style={{ marginLeft: 4, fontSize: 11 }}>
            字符数: {chunk.content_with_weight?.length || 0}
          </Tag>
        </div>
      }
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag>
            混合: {(chunk.similarity * 100).toFixed(1)}%
          </Tag>
          <Tag>
            向量: {(chunk.vector_similarity * 100).toFixed(1)}%
          </Tag>
          <Tag>
            关键词: {(chunk.term_similarity * 100).toFixed(1)}%
          </Tag>
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => onToggleExpand(chunk.chunk_id)}
          >
            {isExpanded ? '收起' : '展开'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {chunk.image_base64 && (
          <div style={{ minWidth: 100 }}>
            <Popover
              content={
                <Image
                  src={`data:image/png;base64,${chunk.image_base64}`}
                  style={{ maxWidth: 500, maxHeight: 500 }}
                  preview={true}
                />
              }
              title="切片图片"
              trigger="hover"
              placement="right"
            >
              <div style={{
                width: 80,
                height: 80,
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f5f5'
              }}>
                <img
                  src={`data:image/png;base64,${chunk.image_base64}`}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  alt="切片缩略图"
                />
              </div>
            </Popover>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            ref={contentRef}
            className={`md-editor-container ${theme}`}
            style={{
              maxHeight: isExpanded ? 'none' : 200,
              overflow: isExpanded ? 'visible' : 'hidden',
              position: 'relative'
            }}
          >
            <MDEditor.Markdown
              source={chunk.content_with_weight || ''}
              className={`md-editor ${theme}`}
            />
            {!isExpanded && needsGradient && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  background: theme === 'dark'
                    ? 'linear-gradient(to bottom, transparent, rgba(26,26,46,0.9))'
                    : 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.9))',
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const KnowledgebaseRetrieval: React.FC<KnowledgebaseRetrievalProps> = ({ knowledgebase }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [retrievalConfig, setRetrievalConfig] = useState<RetrievalConfig>({});
  const [retrievalConfigs, setRetrievalConfigs] = useState<RetrievalConfigItem[]>([]);
  const [results, setResults] = useState<RetrievalChunk[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

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
    const fetchRetrievalConfigs = async () => {
      setConfigLoading(true);
      try {
        const configs = await knowledgebaseService.getRetrievalConfigs();
        setRetrievalConfigs(configs);

        const defaultConfig: RetrievalConfig = {};
        configs.forEach(config => {
          defaultConfig[config.key] = config.default;
        });
        if (knowledgebase.retrieval_config) {
          Object.entries(knowledgebase.retrieval_config).forEach(([key, value]) => {
            defaultConfig[key] = value;
          });
        }
        setRetrievalConfig(defaultConfig);
      } catch (error) {
        console.error('Failed to fetch retrieval configs:', error);
      } finally {
        setConfigLoading(false);
      }
    };
    fetchRetrievalConfigs();
  }, [knowledgebase.retrieval_config]);

  const handleRetrieval = async (page: number = 1) => {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    try {
      const data = await knowledgebaseService.retrieve(
        [knowledgebase.id],
        query,
        {
          ...retrievalConfig,
          top_k: pageSize,
          page,
          page_size: pageSize,
        }
      );
      setResults(data?.chunks || []);
      setTotal(data?.total || 0);
      setCurrentPage(page);
      setExpandedChunks(new Set());
    } catch (error) {
      console.error('Failed to retrieve:', error);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryBlur = () => {
    if (query.trim()) {
      handleRetrieval(1);
    }
  };

  const handlePageChange = (page: number) => {
    handleRetrieval(page);
  };

  const toggleExpand = (chunkId: string) => {
    setExpandedChunks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chunkId)) {
        newSet.delete(chunkId);
      } else {
        newSet.add(chunkId);
      }
      return newSet;
    });
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
          {configLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Spin size="small" />
            </div>
          ) : (
            retrievalConfigs.filter(config => config.key !== 'top_k').map(config => (
              <div key={config.key} style={{ marginBottom: '24px' }}>
                <div className={`config-label ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {config.label}
                  {config.description && (
                    <Tooltip title={config.description}>
                      <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                    </Tooltip>
                  )}
                </div>
                {config.type === 'slider' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Slider
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      value={retrievalConfig[config.key]}
                      onChange={(value) => setRetrievalConfig({ ...retrievalConfig, [config.key]: value })}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      value={retrievalConfig[config.key]}
                      onChange={(value) => {
                        if (value !== null) {
                          setRetrievalConfig({ ...retrievalConfig, [config.key]: value });
                        }
                      }}
                      size="small"
                      style={{ width: 70 }}
                    />
                  </div>
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
            ))
          )}
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
                handleRetrieval(1);
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
            onClick={() => handleRetrieval(1)}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {results.map((chunk) => (
                <ChunkCard
                  key={chunk.chunk_id}
                  chunk={chunk}
                  theme={theme}
                  isExpanded={expandedChunks.has(chunk.chunk_id)}
                  onToggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={(page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
              }
              handleRetrieval(page);
            }}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 条`}
            pageSizeOptions={['5', '10', '20', '50']}
            locale={{
              items_per_page: '条/页',
              jump_to: '前往',
              jump_to_confirm: '确定',
              page: '页',
            }}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default KnowledgebaseRetrieval;
