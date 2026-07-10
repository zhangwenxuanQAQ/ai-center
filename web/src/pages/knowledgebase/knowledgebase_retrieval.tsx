import React, { useState, useEffect } from 'react';
import { Layout, Slider, Select, Input, Button, Card, Tag, Spin, Empty, Pagination, Image, Popover, InputNumber, Tooltip, message, Switch, DatePicker, Space } from 'antd';
import { SearchOutlined, FileTextOutlined, DownOutlined, UpOutlined, QuestionCircleOutlined, FilterOutlined } from '@ant-design/icons';
import ChatMarkdown from '../../components/ChatMarkdown';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import dayjs from 'dayjs';
import zhCN from 'antd/es/date-picker/locale/zh_CN';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;

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

interface MetadataField {
  field_name: string;
  field_label: string;
  field_type: string;
}

interface MetadataFilter {
  field_name: string;
  field_label: string;
  field_type: string;
  control_type: string;
  value: any;
  fuzzy?: boolean;
  relation?: string;
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
          <FileTextOutlined style={{ color: 'var(--primary-color)' }} />
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
            <ChatMarkdown
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
  const [savingConfig, setSavingConfig] = useState(false);
  const [query, setQuery] = useState('');
  const [retrievalConfig, setRetrievalConfig] = useState<RetrievalConfig>({});
  const [retrievalConfigs, setRetrievalConfigs] = useState<RetrievalConfigItem[]>([]);
  const [results, setResults] = useState<RetrievalChunk[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  
  // 元数据过滤相关状态
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [metadataFilters, setMetadataFilters] = useState<MetadataFilter[]>([]);
  const [metadataPopoverVisible, setMetadataPopoverVisible] = useState(false);

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
        // 确保top_k有默认值（如果配置项中没有，则使用配置项中的默认值）
        if (!defaultConfig.top_k) {
          const topKConfig = configs.find(c => c.key === 'top_k');
          defaultConfig.top_k = topKConfig?.default || 5;
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

  useEffect(() => {
    const fetchMetadataFields = async () => {
      try {
        const documents = await knowledgebaseService.getDocuments(knowledgebase.id);
        const fieldMap = new Map<string, MetadataField>();
        
        for (const doc of documents.data || []) {
          if (doc.metadatas) {
            try {
              const metadatasObj = typeof doc.metadatas === 'string' ? JSON.parse(doc.metadatas) : doc.metadatas;
              const schema = metadatasObj._schema || {};
              
              for (const [key, value] of Object.entries(metadatasObj)) {
                if (key === '_schema') continue;
                if (!fieldMap.has(key)) {
                  const fieldSchema = schema[key] || {};
                  fieldMap.set(key, {
                    field_name: key,
                    field_label: fieldSchema.label || key,
                    field_type: fieldSchema.type || 'text',
                  });
                }
              }
            } catch (e) {
              console.error('Failed to parse metadatas:', e);
            }
          }
        }
        
        const fields = Array.from(fieldMap.values());
        setMetadataFields(fields);
        setMetadataFilters(fields.map(field => ({
          ...field,
          value: undefined,
          fuzzy: field.field_type === 'text' ? false : undefined,
          relation: field.field_type.includes('_range') ? 'INTERSECTS' : undefined,
        })));
      } catch (error) {
        console.error('Failed to fetch metadata fields:', error);
      }
    };
    
    fetchMetadataFields();
  }, [knowledgebase.id]);

  const buildMetadataQuery = () => {
    const result: Record<string, any> = {};
    for (const filter of metadataFilters) {
      if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
        result[filter.field_name] = {
          value: filter.value,
          fuzzy: filter.fuzzy,
          relation: filter.relation,
        };
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };

  const handleRetrieval = async (page: number = 1) => {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    try {
      const metadataQuery = buildMetadataQuery();
      const data = await knowledgebaseService.retrieve(
        [knowledgebase.id],
        query,
        {
          ...retrievalConfig,
          top_k: retrievalConfig.top_k,
          page,
          page_size: pageSize,
          metadatas: metadataQuery,
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

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await knowledgebaseService.updateKnowledgebase(knowledgebase.id, {
        retrieval_config: retrievalConfig
      });
      message.success('检索配置已保存到知识库');
      
      const event = new CustomEvent('knowledgebaseConfigUpdated', {
        detail: {
          kbId: knowledgebase.id,
          retrievalConfig: retrievalConfig
        }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to save retrieval config:', error);
      message.error('保存失败');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleMetadataFilterChange = (index: number, field: string, value: any) => {
    const newFilters = [...metadataFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setMetadataFilters(newFilters);
  };

  const handleAddMetadataFilter = (field: MetadataField) => {
    if (metadataFilters.some(f => f.field_name === field.field_name)) {
      return;
    }
    const isRangeType = field.field_type.includes('_range');
    const isTextType = ['text', 'keyword'].includes(field.field_type);
    setMetadataFilters([...metadataFilters, {
      ...field,
      value: isRangeType ? [null, null] : '',
      fuzzy: isTextType ? false : undefined,
      relation: isRangeType ? 'INTERSECTS' : undefined,
    }]);
  };

  const handleRemoveMetadataFilter = (index: number) => {
    setMetadataFilters(metadataFilters.filter((_, i) => i !== index));
  };

  const renderMetadataValueInput = (filter: MetadataFilter, index: number) => {
    const inputStyle = {
      background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
      color: theme === 'dark' ? '#fff' : '#000',
    };

    switch (filter.field_type) {
      case 'boolean':
        return (
          <Select
            value={filter.value}
            onChange={(v) => handleMetadataFilterChange(index, 'value', v)}
            style={{ width: '100%' }}
            size="small"
            allowClear
          >
            <Option value={true}>true</Option>
            <Option value={false}>false</Option>
          </Select>
        );
      case 'long':
      case 'integer':
        return (
          <InputNumber
            value={filter.value}
            onChange={(v) => handleMetadataFilterChange(index, 'value', v)}
            style={{ width: '100%' }}
            precision={0}
            size="small"
          />
        );
      case 'float':
      case 'double':
        return (
          <InputNumber
            value={filter.value}
            onChange={(v) => handleMetadataFilterChange(index, 'value', v)}
            style={{ width: '100%' }}
            step={0.01}
            size="small"
          />
        );
      case 'date':
        return (
          <DatePicker
            value={filter.value ? dayjs(filter.value) : null}
            onChange={(_, ds) => handleMetadataFilterChange(index, 'value', ds)}
            style={{ width: '100%' }}
            showTime
            size="small"
            locale={zhCN}
          />
        );
      case 'integer_range':
      case 'long_range':
        return (
          <Space>
            <InputNumber
              value={Array.isArray(filter.value) ? filter.value[0] : null}
              onChange={(v) => handleMetadataFilterChange(index, 'value', [v, Array.isArray(filter.value) ? filter.value[1] : null])}
              precision={0}
              placeholder="最小值"
              size="small"
              style={{ width: 80 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999' }}>~</span>
            <InputNumber
              value={Array.isArray(filter.value) ? filter.value[1] : null}
              onChange={(v) => handleMetadataFilterChange(index, 'value', [Array.isArray(filter.value) ? filter.value[0] : null, v])}
              precision={0}
              placeholder="最大值"
              size="small"
              style={{ width: 80 }}
            />
          </Space>
        );
      case 'float_range':
        return (
          <Space>
            <InputNumber
              value={Array.isArray(filter.value) ? filter.value[0] : null}
              onChange={(v) => handleMetadataFilterChange(index, 'value', [v, Array.isArray(filter.value) ? filter.value[1] : null])}
              step={0.01}
              placeholder="最小值"
              size="small"
              style={{ width: 80 }}
            />
            <span style={{ color: theme === 'dark' ? '#aaa' : '#999' }}>~</span>
            <InputNumber
              value={Array.isArray(filter.value) ? filter.value[1] : null}
              onChange={(v) => handleMetadataFilterChange(index, 'value', [Array.isArray(filter.value) ? filter.value[0] : null, v])}
              step={0.01}
              placeholder="最大值"
              size="small"
              style={{ width: 80 }}
            />
          </Space>
        );
      case 'date_range':
        return (
          <RangePicker
            value={filter.value && filter.value[0] && filter.value[1] ? [dayjs(filter.value[0]), dayjs(filter.value[1])] : null}
            onChange={(_, ds) => handleMetadataFilterChange(index, 'value', ds)}
            style={{ width: '100%' }}
            showTime
            size="small"
            locale={zhCN}
          />
        );
      default:
        return (
          <Input
            value={filter.value}
            onChange={(e) => handleMetadataFilterChange(index, 'value', e.target.value)}
            placeholder="输入查询值"
            style={inputStyle}
            size="small"
          />
        );
    }
  };

  const handleClearAllMetadataFilters = () => {
    setMetadataFilters(metadataFields.map(field => ({
      ...field,
      value: undefined,
      fuzzy: field.field_type === 'text' ? false : undefined,
      relation: field.field_type.includes('_range') ? 'INTERSECTS' : undefined,
    })));
  };

  const renderMetadataFilterPopover = () => {
    return (
      <div style={{ width: 450, maxHeight: 400, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333' }}>
            元数据过滤条件
          </div>
          <Button
            type="text"
            size="small"
            onClick={handleClearAllMetadataFilters}
            style={{ color: theme === 'dark' ? '#aaa' : '#999' }}
          >
            清空
          </Button>
        </div>
        
        {metadataFilters.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {metadataFilters.map((filter, index) => (
              <div key={filter.field_name} style={{ 
                display: 'flex', 
                gap: 8, 
                marginBottom: 8, 
                alignItems: 'center',
                padding: '8px',
                background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa',
                borderRadius: 4,
              }}>
                <div style={{ width: 100, fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{filter.field_name}</div>
                  <div style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: 11 }}>{filter.field_label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {renderMetadataValueInput(filter, index)}
                </div>
                {filter.field_type === 'text' && (
                  <Tooltip title="模糊查询">
                    <Switch
                      checked={filter.fuzzy || false}
                      onChange={(v) => handleMetadataFilterChange(index, 'fuzzy', v)}
                      size="small"
                    />
                  </Tooltip>
                )}
                {filter.field_type.includes('_range') && (
                  <Select
                    value={filter.relation || 'INTERSECTS'}
                    onChange={(v) => handleMetadataFilterChange(index, 'relation', v)}
                    style={{ width: 100 }}
                    size="small"
                  >
                    <Option value="INTERSECTS">相交</Option>
                    <Option value="CONTAINS">包含</Option>
                    <Option value="WITHIN">被包含</Option>
                  </Select>
                )}
              </div>
            ))}
          </div>
        )}

        {metadataFields.length === 0 && (
          <div style={{ textAlign: 'center', color: theme === 'dark' ? '#aaa' : '#999', padding: 20 }}>
            暂无元数据字段
          </div>
        )}
      </div>
    );
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
        <div style={{ padding: '20px 16px', overflowY: 'auto', position: 'relative', paddingBottom: '80px' }}>
          {configLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Spin size="small" />
            </div>
          ) : (
            retrievalConfigs.map(config => (
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
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', paddingTop: '16px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', padding: '16px' }}>
            <Button
              type="primary"
              // size="small"
              onClick={handleSaveConfig}
              loading={savingConfig}
              style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)',
                border: 'none',
                boxShadow: 'none',
                borderRadius: '4px',
                width: '180px',
                margin: '0 auto',
                display: 'block'
              }}
            >
              设置到知识库配置
            </Button>
          </div>
        </div>
      </LeftSider>

      <Content className={`knowledgebase-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%',padding:"16px !important" }}>
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
          <Popover
            content={renderMetadataFilterPopover()}
            trigger="click"
            placement="bottomLeft"
            open={metadataPopoverVisible}
            onOpenChange={setMetadataPopoverVisible}
          >
            <Button
              style={{
                height: '44px',
                borderRadius: '22px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <FilterOutlined />
              {metadataFilters.length > 0 && (
                <Tag style={{ margin: 0, padding: '0 4px', fontSize: 10 }}>
                  {metadataFilters.length}
                </Tag>
              )}
            </Button>
          </Popover>
          <Button
            type="primary"
            onClick={() => handleRetrieval(1)}
            loading={loading}
            style={{
              height: '44px',
              padding: '0 32px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)',
              border: 'none',
              boxShadow: 'none',
              fontSize: '16px'
            }}
          >
            开始检索
          </Button>
          <Button
            type="default"
            onClick={() => {
              setQuery('');
              handleClearAllMetadataFilters();
            }}
            style={{
              height: '44px',
              padding: '0 24px',
              borderRadius: '22px',
              border: '1px solid',
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#d9d9d9',
              background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
              color: theme === 'dark' ? '#fff' : '#666',
              fontSize: '14px'
            }}
          >
            清空
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
