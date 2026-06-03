import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs } from 'antd';
import { Layout, Tree, Table, Input, Select, Button, Tag, Spin, Pagination, Empty, Row, Col, Tooltip, Switch, message, Modal, Popconfirm, Form, TreeSelect, Popover, Descriptions, Dropdown } from 'antd';
const { TextArea } = Input;
import { SearchOutlined, PlusOutlined, FolderOutlined, FileTextOutlined, PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, BarChartOutlined, EditOutlined, DownloadOutlined, DeleteOutlined, UpOutlined, DownOutlined, CloseOutlined, SettingOutlined, TagsOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { knowledgebaseService, Knowledgebase, KnowledgebaseDocument, KnowledgebaseDocumentCategory } from '../../services/knowledgebase';
import { DOCUMENT_CHUNK_METHOD } from '../../constants/knowledgebase';
import ChunkMethodModal from './chunk-method-modal';
import ChunksView from './chunks_view';
import KnowledgebaseDocumentFolderModal from './knowledgebase_document_folder_modal';
import KnowledgeModal from './knowledgebase_knowledge_modal';
import MetadataModal from './knowledgebase_document_metadata';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

interface KnowledgebaseDocumentProps {
  knowledgebase: Knowledgebase;
}

const KnowledgebaseDocumentPage: React.FC<KnowledgebaseDocumentProps> = ({ knowledgebase }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<KnowledgebaseDocumentCategory[]>([]);
  const [documents, setDocuments] = useState<KnowledgebaseDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [categorySearchValue, setCategorySearchValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalDocs, setTotalDocs] = useState(0);
  const [searchName, setSearchName] = useState<string>('');
  const [filterFileType, setFilterFileType] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterNewStatus, setFilterNewStatus] = useState<boolean | null>(null);
  const [editingDocument, setEditingDocument] = useState<KnowledgebaseDocument | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [documentConstants, setDocumentConstants] = useState<any>(null);
  const [chunkModalVisible, setChunkModalVisible] = useState(false);
  const [chunkModalDocument, setChunkModalDocument] = useState<KnowledgebaseDocument | null>(null);
  
  // 查看切片相关状态
  const [viewingChunks, setViewingChunks] = useState(false);
  const [selectedDocumentForChunks, setSelectedDocumentForChunks] = useState<KnowledgebaseDocument | null>(null);
  
  // 元数据设置相关状态
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [metadataDocument, setMetadataDocument] = useState<KnowledgebaseDocument | null>(null);
  
  // 分类管理相关状态
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [isDatasetModalVisible, setIsDatasetModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<any>(null);

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
    fetchDocumentConstants();
  }, [knowledgebase.id]);

  useEffect(() => {
    const docId = searchParams.get('documentId');
    const view = searchParams.get('view');
    
    if (view) {
      if (docId) {
        const doc = documents.find(d => d.id === docId);
        if (doc) {
          if (view === 'chunks' && !viewingChunks) {
            setSelectedDocumentForChunks(doc);
            setViewingChunks(true);
          }
        }
      }
    }
  }, [searchParams, knowledgebase.id, documents]);

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory, searchName, filterFileType, filterStatus, filterNewStatus, currentPage, pageSize]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [selectedCategory, searchName, filterFileType, filterStatus, filterNewStatus]);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const eventSource = new EventSource(`${apiBaseUrl}/aicenter/v1/knowledgebase/document_events/${knowledgebase.id}`);
    
    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setDocuments(prevDocs => {
          return prevDocs.map(doc => {
            if (doc.id === data.doc_id) {
              return {
                ...doc,
                running_status: data.running_status,
                task_progress: data.task_progress,
                task_progress_message: data.task_progress_message,
                chunk_num: data.chunk_num,
                token_num: data.token_num,
              };
            }
            return doc;
          });
        });
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, [knowledgebase.id]);

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

  // 递归查找目录（支持嵌套目录）
  const findCategoryById = (categories: KnowledgebaseDocumentCategory[], id: string): KnowledgebaseDocumentCategory | null => {
    for (const category of categories) {
      if (category.id === id) {
        return category;
      }
      if (category.children && Array.isArray(category.children) && category.children.length > 0) {
        const found = findCategoryById(category.children, id);
        if (found) {
          return found;
        }
      }
    }
    return null;
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

  const fetchDocumentConstants = async () => {
    try {
      const data = await knowledgebaseService.getDocumentConstants();
      setDocumentConstants(data);
    } catch (error) {
      console.error('Failed to fetch document constants:', error);
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
        undefined,  // chunkMethod - 文件类型过滤暂不支持
        filterStatus.length > 0 ? filterStatus : undefined,  // runningStatus - 解析状态
        filterNewStatus !== null ? String(filterNewStatus) : undefined  // status - 文档状态（转换为字符串）
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

    // 过滤目录（支持搜索）
    const filterCategories = (cats: KnowledgebaseDocumentCategory[]): KnowledgebaseDocumentCategory[] => {
      if (!categorySearchValue.trim()) {
        return cats;
      }
      const searchLower = categorySearchValue.toLowerCase();
      return cats.filter(category => {
        const matches = category.name.toLowerCase().includes(searchLower);
        if (matches) {
          return true;
        }
        // 检查子目录
        if (category.children && Array.isArray(category.children) && category.children.length > 0) {
          const filteredChildren = filterCategories(category.children);
          if (filteredChildren.length > 0) {
            category.children = filteredChildren;
            return true;
          }
        }
        return false;
      });
    };

    const buildCategoryNode = (category: any): TreeDataNode => {
      return {
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="category-name" title={category.name}>{category.name}</div>
            <div className="category-actions" style={{ display: 'flex', gap: '4px' }}>
              <Button
                type="text"
                icon={<UpOutlined />}
                size="small"
                title="上移"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategorySort(category, 'up');
                }}
              />
              <Button
                type="text"
                icon={<DownOutlined />}
                size="small"
                title="下移"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategorySort(category, 'down');
                }}
              />
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                title="编辑"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCategory(category);
                }}
              />
              <Popconfirm
                title="确认删除"
                description="确定要删除这个分类吗？"
                onConfirm={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(category);
                }}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  title="删除"
                  className="delete-category-btn"
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </div>
          </div>
        ),
        key: `category-${category.id}`,
        children: category.children && Array.isArray(category.children) && category.children.length > 0
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      };
    };

    const categoryNodes: TreeDataNode[] = [];

    // 使用过滤后的目录
    const filteredCategories = filterCategories([...categories]);
    const defaultCategories = filteredCategories.filter(category => category.is_default);
    const normalCategories = filteredCategories.filter(category => !category.is_default);

    defaultCategories.forEach(category => {
      categoryNodes.push({
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="category-name" title={category.name}>{category.name}</div>
          </div>
        ),
        key: `category-${category.id}`,
        children: category.children && Array.isArray(category.children) && category.children.length > 0
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      });
    });

    normalCategories.forEach(category => {
      categoryNodes.push(buildCategoryNode(category));
    });

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

  const handleOpenCategoryModal = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...flattenAllCategories(categories).map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      await knowledgebaseService.createDocumentCategory(knowledgebase.id, values);
      message.success('分类创建成功');
      setIsCategoryModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleEditCategory = (category: any) => {
    if (category.is_default) {
      message.warning('默认分类不能编辑');
      return;
    }
    setEditingCategory(category);
    setIsFolderModalVisible(true);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;

    try {
      const values = await categoryEditForm.validateFields();
      await knowledgebaseService.updateDocumentCategory(knowledgebase.id, editingCategory.id, values);
      message.success('分类更新成功');
      setIsCategoryEditModalVisible(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDeleteCategory = async (category: any) => {
    try {
      await knowledgebaseService.deleteDocumentCategory(knowledgebase.id, category.id);
      message.success('分类删除成功');
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      message.error(error.message || '删除分类失败');
    }
  };

  const flattenAllCategories = (cats: any[]): any[] => {
    let result: any[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && Array.isArray(cat.children) && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: any, direction: 'up' | 'down') => {
    try {
      // 检查是否是默认分类
      if (category.is_default) {
        message.warning('默认分类不能排序');
        return;
      }

      const allCategories = flattenAllCategories(categories);
      const siblingCategories = allCategories.filter(c => 
        !c.is_default && 
        c.parent_id === category.parent_id
      );
      siblingCategories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const currentIndex = siblingCategories.findIndex(c => c.id === category.id);

      if (direction === 'up' && currentIndex === 0) {
        message.warning('已经是第一个分类了');
        return;
      }
      if (direction === 'down' && currentIndex === siblingCategories.length - 1) {
        message.warning('已经是最后一个分类了');
        return;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetCategory = siblingCategories[targetIndex];

      await knowledgebaseService.updateDocumentCategory(knowledgebase.id, category.id, { sort_order: targetCategory.sort_order });
      await knowledgebaseService.updateDocumentCategory(knowledgebase.id, targetCategory.id, { sort_order: category.sort_order });

      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const buildCategoryTreeSelectData = () => {
    const buildTree = (category: KnowledgebaseDocumentCategory): any => {
      return {
        title: category.name,
        value: category.id,
        key: category.id,
        children: category.children && Array.isArray(category.children) && category.children.length > 0
          ? category.children.map(child => buildTree(child))
          : undefined
      };
    };
    return categories.map(cat => buildTree(cat));
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'done':
        return 'success';
      case 'running':
        return 'success';
      case 'waiting':
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
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const handleStatusChange = async (documentId: string, newStatus: string) => {
    try {
      // 先更新本地状态，提供即时反馈
      setDocuments(prevDocuments => 
        prevDocuments.map(doc => 
          doc.id === documentId ? { ...doc, status: newStatus } : doc
        )
      );
      
      // 调用API更新服务器状态
      await knowledgebaseService.updateDocument(knowledgebase.id, documentId, { status: newStatus });
      message.success('状态更新成功');
    } catch (error) {
      console.error('Failed to update document status:', error);
      message.error('状态更新失败');
      // 失败时恢复原始状态
      fetchDocuments();
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      await knowledgebaseService.deleteDocument(knowledgebase.id, documentId);
      message.success('文档删除成功');
      fetchDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      message.error('文档删除失败');
    }
  };

  const handleRunTask = async (documentId: string) => {
    try {
      await knowledgebaseService.runDocumentTask(knowledgebase.id, documentId);
      message.success('任务已提交');
      // 只更新解析状态列，不刷新整个表格
      setDocuments(prevDocuments => 
        prevDocuments.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                running_status: 'waiting', 
                task_progress: 0, 
                task_progress_message: '',
                task_begin_at: null,
                task_end_at: null,
                task_duration: 0
              } 
            : doc
        )
      );
    } catch (error: any) {
      console.error('Failed to run document task:', error);
      message.error(error.message || '任务提交失败');
    }
  };

  const handleStopTask = async (documentId: string) => {
    try {
      await knowledgebaseService.stopDocumentTask(knowledgebase.id, documentId);
      message.success('任务已停止');
      // 只更新解析状态列，不刷新整个表格
      setDocuments(prevDocuments => 
        prevDocuments.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                running_status: 'cancel', 
                task_progress: 0,
                task_progress_message: '任务已取消'
              } 
            : doc
        )
      );
    } catch (error: any) {
      console.error('Failed to stop document task:', error);
      message.error(error.message || '停止任务失败');
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文档');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个文档吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        knowledgebaseService.batchDeleteDocuments(knowledgebase.id, selectedRowKeys.map(key => key as string))
          .then(() => {
            message.success('批量删除成功');
            setSelectedRowKeys([]);
            setCurrentPage(1);
            fetchDocuments();
          })
          .catch(error => {
            console.error('Failed to batch delete documents:', error);
          });
      }
    });
  };

  const handleBatchRun = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要执行的文档');
      return;
    }
    Modal.confirm({
      title: '批量执行',
      content: `确定要执行选中的 ${selectedRowKeys.length} 个文档的切片任务吗？正在执行的任务将被忽略。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await knowledgebaseService.batchRunDocumentTasks(knowledgebase.id, selectedRowKeys.map(key => key as string));
          const successCount = result.success?.length || 0;
          const failedCount = result.failed?.length || 0;
          if (failedCount > 0) {
            message.warning(`批量执行完成: 成功${successCount}个, 失败${failedCount}个`);
          } else {
            message.success(`批量执行成功: ${successCount}个`);
          }
          setSelectedRowKeys([]);
          fetchDocuments();
        } catch (error: any) {
          message.error(error.message || '批量执行失败');
        }
      }
    });
  };

  const handleBatchStop = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要停止的文档');
      return;
    }
    Modal.confirm({
      title: '批量停止',
      content: `确定要停止选中的 ${selectedRowKeys.length} 个文档的切片任务吗？非正在执行的任务将被忽略。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await knowledgebaseService.batchStopDocumentTasks(knowledgebase.id, selectedRowKeys.map(key => key as string));
          const successCount = result.success?.length || 0;
          const skippedCount = result.skipped?.length || 0;
          if (skippedCount > 0) {
            message.success(`批量停止完成: 成功${successCount}个, 跳过${skippedCount}个`);
          } else {
            message.success(`批量停止成功: ${successCount}个`);
          }
          setSelectedRowKeys([]);
          fetchDocuments();
        } catch (error: any) {
          message.error(error.message || '批量停止失败');
        }
      }
    });
  };

  const batchMenuItems = [
    {
      key: 'run',
      label: '批量执行',
      icon: <PlayCircleOutlined />,
      onClick: handleBatchRun,
    },
    {
      key: 'stop',
      label: '批量停止',
      icon: <PauseCircleOutlined />,
      onClick: handleBatchStop,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleBatchDelete,
    },
  ];

  const columns = useMemo(() => [
    {
      title: '知识标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text: string, record: KnowledgebaseDocument) => {
        // 优先从 document_config 中获取标题
        let docConfigTitle = '';
        if (record.document_config) {
          const config = typeof record.document_config === 'string' 
            ? JSON.parse(record.document_config) 
            : record.document_config;
          docConfigTitle = config?.title || '';
        }
        const displayTitle = docConfigTitle || text || record.file_name || '未命名知识';
        return (
          <Tooltip title={displayTitle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              {record.thumbnail ? (
                <img 
                  src={record.thumbnail} 
                  alt={displayTitle}
                  style={{ width: 20, height: 20, objectFit: 'contain' }}
                />
              ) : (
                <FileTextOutlined />
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayTitle}
              </span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (updatedAt: string) => (
        <span>{updatedAt ? new Date(updatedAt).toLocaleString() : '-'}</span>
      ),
    },
    {
      title: '更新人',
      dataIndex: 'updated_by',
      key: 'updated_by',
      width: 100,
      render: (updatedBy: string) => (
        <span>{updatedBy || '-'}</span>
      ),
    },
    {
      title: '切片方法',
      dataIndex: 'chunk_method',
      key: 'chunk_method',
      width: 120,
      render: (method: string) => {
        if (documentConstants?.chunk_methods) {
          const chunkMethod = documentConstants.chunk_methods.find((cm: any) => cm.key === method);
          return chunkMethod?.label || method;
        }
        return DOCUMENT_CHUNK_METHOD[method as keyof typeof DOCUMENT_CHUNK_METHOD] || method;
      },
    },
    {
      title: '解析状态',
      dataIndex: 'running_status',
      key: 'running_status',
      width: 120,
      render: (status: string, record: KnowledgebaseDocument) => {
        const runningStatusMap = documentConstants?.running_status || {};
        const statusLabel = runningStatusMap[status] || status;
        const progress = (record.task_progress * 100).toFixed(0);
        const isRunning = status === 'running' || status === 'waiting';
        const statusTag = (
          <Tag color={getStatusColor(status)}>
            {isRunning ? `${statusLabel} ${progress}%` : statusLabel}
          </Tag>
        );
        
        const formatDuration = (ms: number) => {
          if (ms < 1000) {
            return `${ms}毫秒`;
          }
          return `${(ms / 1000).toFixed(2)}秒`;
        };
        
        const popoverContent = (
          <div style={{ maxHeight: '450px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <Descriptions size="small" column={1} style={{ width: '400px' }}>
              <Descriptions.Item label="当前状态">
                <Tag color={getStatusColor(status)}>
                  {runningStatusMap[status] || status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="进度">{(record.task_progress * 100).toFixed(1)}%</Descriptions.Item>
              {record.task_progress_message && (
                <Descriptions.Item label="消息">
                  <div style={{ maxWidth: '360px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '250px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {record.task_progress_message}
                  </div>
                </Descriptions.Item>
              )}
              {record.task_begin_at && (
                <Descriptions.Item label="开始时间">
                  {new Date(record.task_begin_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {record.task_end_at && (
                <Descriptions.Item label="结束时间">
                  {new Date(record.task_end_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {record.task_duration > 0 && (
                <Descriptions.Item label="耗时">
                  {formatDuration(record.task_duration)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        );
        
        return (
          <Popover
            content={popoverContent}
            title="任务详情"
            placement="top"
            trigger="hover"
            getPopupContainer={() => document.body}
          >
            {statusTag}
          </Popover>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: boolean, record: KnowledgebaseDocument) => (
        <Switch 
          checked={status}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: KnowledgebaseDocument) => {
        const getStatusButton = () => {
          switch (record.running_status) {
            case 'running':
            case 'waiting':
              return (
                <Tooltip title="停止">
                  <Button 
                    type="text"
                    size="small" 
                    icon={<PauseCircleOutlined />}
                    style={{ color: '#1890ff' }}
                    onClick={() => handleStopTask(record.id)}
                  />
                </Tooltip>
              );
            case 'done':
            case 'fail':
            case 'cancel':
              return (
                <Tooltip title="重新执行">
                  <Popconfirm
                    title="确认重新执行"
                    description="重新执行将删除原有切片数据，确定要继续吗？"
                    okText="确定"
                    cancelText="取消"
                    onConfirm={() => handleRunTask(record.id)}
                  >
                    <Button 
                      type="text"
                      size="small" 
                      icon={<ReloadOutlined />}
                      style={{ color: '#52c41a' }}
                    />
                  </Popconfirm>
                </Tooltip>
              );
            default:
              return (
                <Tooltip title="运行">
                  <Button 
                    type="text"
                    size="small" 
                    icon={<PlayCircleOutlined />}
                    style={{ color: '#52c41a' }}
                    onClick={() => handleRunTask(record.id)}
                  />
                </Tooltip>
              );
          }
        };
        
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {getStatusButton()}
            <Tooltip title="查看切片">
              <Button 
                type="text"
                size="small" 
                icon={<BarChartOutlined />}
                onClick={() => {
                  setSelectedDocumentForChunks(record);
                  setViewingChunks(true);
                  setSearchParams({ view: 'chunks', documentId: record.id });
                }}
              />
            </Tooltip>
            <Tooltip title="修改切片方法">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => {
                  setChunkModalDocument(record);
                  setChunkModalVisible(true);
                }}
              />
            </Tooltip>
            <Tooltip title="设置元数据">
              <Button
                type="text"
                size="small"
                icon={<TagsOutlined />}
                onClick={() => {
                  setMetadataDocument(record);
                  setMetadataModalVisible(true);
                }}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => { 
                  setEditingDocument(record); 
                  setIsEditModalVisible(true);
                }}
              />
            </Tooltip>
            {(record.source_type === 'local_document' || record.source_type === 'datasource') && (
              <Tooltip title="下载">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={async () => {
                    try {
                      await knowledgebaseService.downloadDocument(knowledgebase.id, record.id);
                    } catch (error) {
                      message.error('下载失败，请稍后重试');
                    }
                  }}
                />
              </Tooltip>
            )}
            <Popconfirm
              title="确定要删除该文档吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button 
                  type="text"
                  size="small" 
                  danger 
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </div>
        );
      },
    },
  ], [documentConstants, handleStatusChange, handleDelete, handleRunTask, handleStopTask, knowledgebase.id, getStatusColor, formatFileSize]);

  return (
    <Layout className="knowledgebase-layout" style={{ height: '100%' }}>
      {!viewingChunks && (
        <LeftSider
          width={260}
          className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        >
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>知识目录</span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                setEditingCategory(null); // 重置编辑状态
                setIsFolderModalVisible(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0 12px',
                height: '28px',
                fontSize: '12px'
              }}
            >
              新增
            </Button>
          </div>
          {/* 搜索框 */}
          <Input
            placeholder="搜索目录名称"
            value={categorySearchValue}
            onChange={(e) => setCategorySearchValue(e.target.value)}
            prefix={<SearchOutlined />}
            style={{
              marginBottom: '12px',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          />
          <div style={{ height: '80%', overflowY: 'auto', overflowX: 'hidden' }} className="category-tree-container">
            <Tree
              showIcon
              selectedKeys={selectedKeys}
              expandedKeys={expandedKeys}
              onSelect={handleTreeSelect}
              onExpand={handleTreeExpand}
              treeData={buildTreeData()}
              className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`}
            />
          </div>
        </LeftSider>
      )}

      <Content className={`knowledgebase-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {viewingChunks ? (
          <div style={{ height: '100%', padding: 12 }}>
            <ChunksView 
              document={selectedDocumentForChunks!} 
              knowledgebaseId={knowledgebase.id}
              onBack={() => {
                setViewingChunks(false);
                setSearchParams();
              }}
            />
          </div>
        ) : (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden',
        }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsDatasetModalVisible(true)
            }}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '18px',
              height: '36px',
            }}
          >
            新增知识
          </Button>
          <Dropdown menu={{ items: batchMenuItems }} disabled={selectedRowKeys.length === 0}>
            <Button>
              批量操作 ({selectedRowKeys.length})
            </Button>
          </Dropdown>
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
            placeholder="请选择切片方法"
            value={filterFileType}
            onChange={setFilterFileType}
            mode="multiple"
            allowClear
            style={{
              width: '200px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'transparent' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
            maxTagCount={1}
            maxTagTextLength={10}
          >
            {Object.entries(DOCUMENT_CHUNK_METHOD).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="请选择解析状态"
            value={filterStatus}
            onChange={setFilterStatus}
            mode="multiple"
            allowClear
            style={{
              width: '200px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'transparent' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
            maxTagCount={1}
            maxTagTextLength={10}
          >
            {documentConstants?.running_status ? (
              Object.entries(documentConstants.running_status).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))
            ) : (
              <Option value="pending">未开始</Option>
            )}
          </Select>
          <Select
            placeholder="请选择状态"
            value={filterNewStatus === true ? 'true' : filterNewStatus === false ? 'false' : null}
            onChange={(value) => setFilterNewStatus(value === 'true' ? true : value === 'false' ? false : null)}
            allowClear
            style={{
              width: '150px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'transparent' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
          >
            <Option key="true" value="true">启用</Option>
            <Option key="false" value="false">禁用</Option>
          </Select>
          <Button 
            icon={<CloseOutlined />}
            onClick={() => {
              setSearchName('');
              setFilterFileType([]);
              setFilterStatus([]);
              setFilterNewStatus(null);
              setSelectedRowKeys([]);
              setCurrentPage(1);
            }}
            style={{ height: '36px' }}
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
          ) : (
            <Table
              columns={columns}
              dataSource={documents}
              rowKey="id"
              pagination={false}
              className={`knowledgebase-document-table ${theme === 'dark' ? 'dark' : 'light'}`}
              scroll={{ x: 1200, y: 'calc(100vh - 300px)' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
                preserveSelectedRowKeys: true,
              }}
              size="small"
              locale={{
                emptyText: <Empty 
                  description="暂无文档" 
                  className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
                />
              }}
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
        </div>
        )}
      </Content>

      {/* 分类管理弹窗 */}
      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onCancel={() => setIsCategoryModalVisible(false)}
        onOk={handleSaveCategory}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`knowledgebase-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分类描述"
          >
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item
            name="parent_id"
            label="父分类"
          >
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            initialValue={1}
            rules={[{ required: true, message: '请输入排序顺序' }]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分类编辑弹窗 */}
      <Modal
        title="编辑分类"
        open={isCategoryEditModalVisible}
        onCancel={() => {
          setIsCategoryEditModalVisible(false);
          setEditingCategory(null);
        }}
        onOk={handleSaveEditCategory}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`knowledgebase-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分类描述"
          >
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item
            name="parent_id"
            label="父分类"
          >
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            rules={[{ required: true, message: '请输入排序顺序' }]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改切片方法弹窗 */}
      {chunkModalDocument && (
        <ChunkMethodModal
          visible={chunkModalVisible}
          onCancel={() => {
            setChunkModalVisible(false);
            setChunkModalDocument(null);
          }}
          onSuccess={(updatedDoc) => {
            setChunkModalVisible(false);
            setChunkModalDocument(null);
            if (updatedDoc) {
              setDocuments(prev => prev.map(doc => 
                doc.id === updatedDoc.id ? updatedDoc : doc
              ));
            }
          }}
          document={chunkModalDocument}
          knowledgebaseId={knowledgebase.id}
          category={chunkModalDocument?.category_id ? findCategoryById(categories, chunkModalDocument.category_id) : (selectedCategory ? findCategoryById(categories, selectedCategory) : null)}
        />
      )}

      {/* 新增目录弹窗 */}
      <KnowledgebaseDocumentFolderModal
        visible={isFolderModalVisible}
        knowledgebaseId={knowledgebase.id}
        categories={categories}
        onCancel={() => setIsFolderModalVisible(false)}
        onSuccess={fetchCategories}
        editData={editingCategory}
      />

      {/* 新增知识弹窗 */}
      <KnowledgeModal
        visible={isDatasetModalVisible}
        knowledgebaseId={knowledgebase.id}
        selectedCategory={selectedCategory ? findCategoryById(categories, selectedCategory) : null}
        onCancel={() => setIsDatasetModalVisible(false)}
        onSuccess={() => {
          setIsDatasetModalVisible(false);
          fetchDocuments();
        }}
      />

      {/* 编辑知识弹窗 */}
      <KnowledgeModal
        visible={isEditModalVisible}
        knowledgebaseId={knowledgebase.id}
        selectedCategory={editingDocument?.category_id ? findCategoryById(categories, editingDocument.category_id) : (selectedCategory ? findCategoryById(categories, selectedCategory) : null)}
        document={editingDocument}
        onCancel={() => setIsEditModalVisible(false)}
        onSuccess={() => {
          setIsEditModalVisible(false);
          setEditingDocument(undefined);
          fetchDocuments();
        }}
      />
      <MetadataModal
        visible={metadataModalVisible}
        document={metadataDocument}
        knowledgebaseId={knowledgebase.id}
        onCancel={() => {
          setMetadataModalVisible(false);
          setMetadataDocument(null);
        }}
        onSuccess={() => {
          setMetadataModalVisible(false);
          setMetadataDocument(null);
          fetchDocuments();
        }}
      />
    </Layout>
  );
};

export default KnowledgebaseDocumentPage;
