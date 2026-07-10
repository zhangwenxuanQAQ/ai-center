import React, { useState, useEffect, useRef } from 'react';
import { Card, Pagination, Input, Select, Switch, Spin, Empty, Tag, Tooltip, message, Image, Popover, Button, Popconfirm } from 'antd';
import { SearchOutlined, ArrowLeftOutlined, DownOutlined, UpOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ChatMarkdown from '../../components/ChatMarkdown';
import { knowledgebaseService, KnowledgebaseDocument } from '../../services/knowledgebase';
import ChunkSetting from './chunk_setting';
import '../../styles/common.css';
import './knowledgebase.less';

const { Option } = Select;

interface ChunkItem {
  _id: string;
  doc_id: string;
  kb_id: string;
  doc_name: string;
  chunk_id: string;
  content_with_weight: string;
  content_ltks: string;
  image_base64?: string;
  available_int: number;
  token_num_int?: number;
  page_num_int?: number;
  position_int?: number;
  top_int?: number;
  create_time: string;
  create_timestamp_flt: number;
}

interface ChunksViewProps {
  document: KnowledgebaseDocument;
  knowledgebaseId: string;
  onBack?: () => void;
}

const ChunksView: React.FC<ChunksViewProps> = ({ document, knowledgebaseId, onBack }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [availableFilter, setAvailableFilter] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [chunkSettingVisible, setChunkSettingVisible] = useState(false);
  const [editingChunk, setEditingChunk] = useState<any>(null);
  const [chunkSettingMode, setChunkSettingMode] = useState<'create' | 'edit'>('create');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.document.body) return;
    
    const currentTheme = window.document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      if (!window.document.body) return;
      const newTheme = window.document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(window.document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (document && knowledgebaseId) {
      setCurrentPage(1);
    }
  }, [document, knowledgebaseId]);

  useEffect(() => {
    if (document && knowledgebaseId) {
      fetchChunks();
    }
  }, [document, knowledgebaseId, currentPage, pageSize, availableFilter, keyword]);

  const fetchChunks = async () => {
    if (!document || !knowledgebaseId) return;
    setLoading(true);
    try {
      const result = await knowledgebaseService.getChunks(
        knowledgebaseId,
        currentPage,
        pageSize,
        document.id,
        availableFilter,
        keyword || undefined
      );
      setChunks(result.items || []);
      setTotal(result.total || 0);
      setTotalPages(result.total_pages || 0);
      setExpandedChunks(new Set());
    } catch (error) {
      console.error('获取切片列表失败:', error);
      message.error('获取切片列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchInput !== keyword) {
      setKeyword(searchInput);
      setCurrentPage(1);
    }
  };

  const handleToggleAvailable = async (chunkId: string, newAvailable: number) => {
    try {
      await knowledgebaseService.toggleChunkAvailable(
        knowledgebaseId,
        chunkId,
        newAvailable
      );
      message.success(newAvailable === 1 ? '已启用' : '已停用');
      setChunks(prevChunks => prevChunks.map(chunk => 
        chunk._id === chunkId ? { ...chunk, available_int: newAvailable } : chunk
      ));
    } catch (error) {
      console.error('切换可用状态失败:', error);
      message.error('操作失败');
    }
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

  const handleCreateChunk = () => {
    setEditingChunk(null);
    setChunkSettingMode('create');
    setChunkSettingVisible(true);
  };

  const handleEditChunk = (chunk: any) => {
    setEditingChunk(chunk);
    setChunkSettingMode('edit');
    setChunkSettingVisible(true);
  };

  const handleDeleteChunk = async (chunkId: string) => {
    try {
      await knowledgebaseService.deleteChunk(knowledgebaseId, chunkId);
      message.success('切片删除成功');
      // 删除后刷新列表
      fetchChunks();
    } catch (error) {
      console.error('删除切片失败:', error);
      message.error('删除失败');
    }
  };

  const handleChunkSettingSuccess = (chunk?: any) => {
    if (chunk) {
      // 检查是否为新增（判断是否已存在）
      const isNew = !chunks.some(c => c._id === chunk._id);
      if (isNew) {
        // 新增切片，刷新列表
        fetchChunks();
      } else {
        // 更新单个切片，不刷新整个列表
        setChunks(prevChunks => 
          prevChunks.map(c => 
            c._id === chunk._id ? chunk : c
          )
        );
      }
    } else {
      // 无数据时刷新
      fetchChunks();
    }
  };

  const renderChunkCard = (chunk: ChunkItem) => {
    const isExpanded = expandedChunks.has(chunk._id);
    
    return (
      <ChunkCard
        key={chunk._id}
        chunk={chunk}
        theme={theme}
        isExpanded={isExpanded}
        onToggleExpand={() => toggleExpand(chunk._id)}
        onToggleAvailable={(checked: boolean) => handleToggleAvailable(chunk._id, checked ? 1 : 0)}
        onEdit={() => handleEditChunk(chunk)}
        onDelete={() => handleDeleteChunk(chunk._id)}
      />
    );
  };

  return (
    <div className="chunks-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {onBack && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
            >
              返回
            </Button>
          )}
          <span style={{ fontSize: 16, fontWeight: 500, marginLeft: onBack ? 0 : 0 }}>{document?.file_name || document?.name}</span>
          <Input
            placeholder="搜索切片内容"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            onBlur={() => {
              handleSearch();
            }}
            prefix={<SearchOutlined />}
            allowClear
            style={{
              width: '200px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
            className="no-border-input"
          />
          <Select
            placeholder="可用状态"
            value={availableFilter}
            onChange={(value) => {
              setAvailableFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 120, height: '36px' }}
            allowClear
          >
            <Option value={1}>启用</Option>
            <Option value={0}>停用</Option>
          </Select>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateChunk}
          style={{ marginRight: 32 }}
        >
          新增
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
        <Spin spinning={loading}>
          {chunks.length === 0 ? (
            <Empty description="暂无切片数据" />
          ) : (
            <div>
              {chunks.map(chunk => renderChunkCard(chunk))}
            </div>
          )}
        </Spin>
      </div>

      {total > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={(page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            }}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 条`}
            pageSizeOptions={['10', '20', '50']}
            locale={{
              items_per_page: '条/页',
              jump_to: '前往',
              jump_to_confirm: '确定',
              page: '页',
            }}
          />
        </div>
      )}

      <ChunkSetting
        visible={chunkSettingVisible}
        onCancel={() => setChunkSettingVisible(false)}
        onSuccess={handleChunkSettingSuccess}
        knowledgebaseId={knowledgebaseId}
        documentId={document.id}
        chunk={editingChunk}
        mode={chunkSettingMode}
      />
    </div>
  );
};

interface ChunkCardProps {
  chunk: ChunkItem;
  theme: 'light' | 'dark';
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleAvailable: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ChunkCard: React.FC<ChunkCardProps> = ({ chunk, theme, isExpanded, onToggleExpand, onToggleAvailable, onEdit, onDelete }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsGradient, setNeedsGradient] = useState(false);

  useEffect(() => {
    if (contentRef.current && !isExpanded) {
      const contentHeight = contentRef.current.scrollHeight;
      setNeedsGradient(contentHeight > 200);
    }
  }, [chunk.content_with_weight, isExpanded]);

  return (
    <Card
      className="chunk-card"
      style={{
        marginBottom: 12,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
      headStyle={{
        textAlign: 'left'
      }}
      title={
        <span style={{ fontWeight: 500, fontSize: 13 }}>字符数: {chunk.content_with_weight?.length || 0}</span>
      }
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={onToggleExpand}
          >
            {isExpanded ? '收起' : '展开'}
          </Button>
          <Switch
            checked={chunk.available_int === 1}
            onChange={(checked) => onToggleAvailable(checked)}
            checkedChildren="启用"
            unCheckedChildren="停用"
          />
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={onEdit}
              style={{ color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此切片吗？"
            onConfirm={onDelete}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                style={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>
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

export default ChunksView;
