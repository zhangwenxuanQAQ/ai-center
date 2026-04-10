import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Table, Input, Select, Button, Tag, Spin, Pagination, Empty, Row, Col } from 'antd';
import { SearchOutlined, PlusOutlined, FolderOutlined, FileTextOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { knowledgebaseService, Knowledgebase, KnowledgebaseDocument, KnowledgebaseDocumentCategory } from '../../services/knowledgebase';
import { DOCUMENT_RUNNING_STATUS, DOCUMENT_CHUNK_METHOD } from '../../constants/knowledgebase';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

interface KnowledgebaseDocumentProps {
  knowledgebase: Knowledgebase;
}

const KnowledgebaseDocumentPage: React.FC<KnowledgebaseDocumentProps> = ({ knowledgebase }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<KnowledgebaseDocumentCategory[]>([]);
  const [documents, setDocuments] = useState<KnowledgebaseDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [searchName, setSearchName] = useState<string>('');
  const [filterFileType, setFilterFileType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

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
    fetchCategories();
    fetchDocuments();
  }, [knowledgebase.id]);

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory, searchName, filterFileType, filterStatus, currentPage, pageSize]);

  const getAllCategoryKeys = (categories: KnowledgebaseDocumentCategory[]): string[] => {
    let keys: string[] = [];
    categories.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && Array.isArray(category.children) && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const fetchCategories = async () => {
    try {
      const data = await knowledgebaseService.getDocumentCategoryTree(knowledgebase.id);
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch document categories:', error);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await knowledgebaseService.getDocuments(
        knowledgebase.id,
        currentPage,
        pageSize,
        selectedCategory || undefined,
        searchName || undefined,
        filterFileType || undefined,
        filterStatus || undefined
      );
      setDocuments(response.data || []);
      setTotalDocs(response.total || 0);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
      setTotalDocs(0);
    } finally {
      setLoading(false);
    }
  };

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name">全部</div>
        </div>
      ),
      key: 'all',
    };

    const buildCategoryNode = (category: KnowledgebaseDocumentCategory): TreeDataNode => {
      return {
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer' }}>
            <div className="category-name" title={category.name}>{category.name}</div>
          </div>
        ),
        key: `category-${category.id}`,
        children: category.children && Array.isArray(category.children) && category.children.length > 0
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      };
    };

    const categoryNodes: TreeDataNode[] = categories.map(cat => buildCategoryNode(cat));

    return [allNode, ...categoryNodes];
  };

  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length === 0) return;
    const key = selectedKeys[0] as string;
    setSelectedKeys(selectedKeys as string[]);
    if (key === 'all') {
      setSelectedCategory(null);
    } else if (key.startsWith('category-')) {
      const categoryId = key.replace('category-', '');
      setSelectedCategory(categoryId);
    }
    setCurrentPage(1);
  };

  const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'success';
      case 'running':
        return 'processing';
      case 'pending':
      case 'schedule':
        return 'default';
      case 'fail':
      case 'cancel':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns = [
    {
      title: '文档名称',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text: string, record: KnowledgebaseDocument) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined />
          <span>{text || '未命名文档'}</span>
        </div>
      ),
    },
    {
      title: '文件类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 120,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '解析状态',
      dataIndex: 'running_status',
      key: 'running_status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {DOCUMENT_RUNNING_STATUS[status as keyof typeof DOCUMENT_RUNNING_STATUS] || status}
        </Tag>
      ),
    },
    {
      title: 'Chunk方法',
      dataIndex: 'chunk_method',
      key: 'chunk_method',
      width: 120,
      render: (method: string) => DOCUMENT_CHUNK_METHOD[method as keyof typeof DOCUMENT_CHUNK_METHOD] || method,
    },
    {
      title: 'Token数',
      dataIndex: 'token_num',
      key: 'token_num',
      width: 100,
    },
    {
      title: 'Chunk数',
      dataIndex: 'chunk_num',
      key: 'chunk_num',
      width: 100,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags && tags.length > 0 ? tags.map((tag, index) => (
            <Tag key={index} size="small">{tag}</Tag>
          )) : '-'}
        </div>
      ),
    },
  ];

  return (
    <Layout className="knowledgebase-layout" style={{ height: '100%' }}>
      <LeftSider
        width={260}
        className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>文档分类</span>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '0 12px',
              height: '28px',
              fontSize: '12px'
            }}
          >
            新增分类
          </Button>
        </div>
        <Tree
          showIcon
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onSelect={handleTreeSelect}
          onExpand={handleTreeExpand}
          treeData={buildTreeData()}
          className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`}
        />
      </LeftSider>

      <Content className={`knowledgebase-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="搜索文档名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
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
            placeholder="按文件类型筛选"
            value={filterFileType}
            onChange={setFilterFileType}
            allowClear
            style={{
              width: '150px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
          >
            {Object.entries(DOCUMENT_CHUNK_METHOD).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="按解析状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{
              width: '150px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
          >
            {Object.entries(DOCUMENT_RUNNING_STATUS).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
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
          ) : documents.length === 0 ? (
            <Empty 
              description="暂无文档" 
              className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
            />
          ) : (
            <Table
              columns={columns}
              dataSource={documents}
              rowKey="id"
              pagination={false}
              className={`knowledgebase-document-table ${theme === 'dark' ? 'dark' : 'light'}`}
            />
          )}
        </div>

        <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalDocs}
            onChange={(page) => {
              setCurrentPage(page);
            }}
            onShowSizeChange={(current, size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 条记录`}
            pageSizeOptions={['10', '20', '50', '100']}
            locale={{
              items_per_page: '条/页',
              jump_to: '前往',
              jump_to_confirm: '确定',
              page: '页',
            }}
            className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{ margin: 0 }}
          />
        </div>
      </Content>
    </Layout>
  );
};

export default KnowledgebaseDocumentPage;
