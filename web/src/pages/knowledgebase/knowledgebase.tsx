import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Tree, Card, Row, Col, Avatar, Empty, Spin, Button, Modal, Form, Input, TreeSelect, Upload, message, Popconfirm, Pagination, Switch, Select, Tag } from 'antd';
const { TextArea } = Input;
const { Option } = Select;
import { BookOutlined, PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps, UploadProps } from 'antd';
import { knowledgebaseService, Knowledgebase, KnowledgebaseCategory } from '../../services/knowledgebase';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './knowledgebase.less';

const { Sider: LeftSider, Content } = Layout;

const KnowledgebaseManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<KnowledgebaseCategory[]>([]);
  const [knowledgebases, setKnowledgebases] = useState<Knowledgebase[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string>('');
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalKbs, setTotalKbs] = useState<number>(0);

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<KnowledgebaseCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const cardRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const isChangingPageSize = useRef<boolean>(false);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchKnowledgebases();
  }, []);

  useEffect(() => {
    fetchKnowledgebases(selectedCategory, 1, pageSize);
  }, [searchName, searchCode, selectedCategory, filterStatus]);

  const getAllCategoryKeys = (categories: KnowledgebaseCategory[]): string[] => {
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
      const data = await knowledgebaseService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchKnowledgebases = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      const response = await knowledgebaseService.getKnowledgebases(
        page !== undefined ? page : currentPage,
        size !== undefined ? size : pageSize,
        categoryId || selectedCategory,
        searchName,
        searchCode,
        filterStatus || undefined
      );
      setKnowledgebases(response.data || []);
      setTotalKbs(response.total || 0);
    } catch (error) {
      console.error('Failed to fetch knowledgebases:', error);
      setKnowledgebases([]);
      setTotalKbs(0);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...categories.map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: KnowledgebaseCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  const flattenAllCategories = (cats: KnowledgebaseCategory[]): KnowledgebaseCategory[] => {
    let result: KnowledgebaseCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: KnowledgebaseCategory, direction: 'up' | 'down') => {
    try {
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

      await knowledgebaseService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await knowledgebaseService.updateCategory(targetCategory.id, { sort_order: category.sort_order });

      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: KnowledgebaseCategory) => {
    try {
      await knowledgebaseService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await knowledgebaseService.createCategory(values);
      message.success('分类创建成功！');
      setIsCategoryModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('创建分类失败:', error);
    }
  };

  const handleCategoryEditSubmit = async () => {
    if (!editingCategory) return;
    try {
      const values = await categoryEditForm.validateFields();
      await knowledgebaseService.updateCategory(editingCategory.id, values);
      message.success('分类更新成功！');
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
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

    const categoryNodes: TreeDataNode[] = [];

    const buildCategoryNode = (category: KnowledgebaseCategory): TreeDataNode => {
      return {
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer' }}>
            <div className="category-name" title={category.name}>{category.name}</div>
            <div className="category-actions">
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

    const defaultCategories = categories.filter(category => category.is_default);
    const normalCategories = categories.filter(category => !category.is_default);

    defaultCategories.forEach(category => {
      categoryNodes.push({
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer' }}>
            <div className="category-name">{category.name}</div>
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
  };

  const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: KnowledgebaseCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0
        ? category.children.map(child => buildNode(child))
        : undefined,
    });
    return categories.map(category => buildNode(category));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCardClick = (kbId: string) => {
    navigate(`/knowledgebase/detail/${kbId}`);
  };

  const handleCardMouseMove = (kbId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRefs.current[kbId];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleAddKnowledgebase = () => {
    navigate('/knowledgebase/create');
  };

  const handleEditKnowledgebase = (kb: Knowledgebase) => {
    setEditingKbId(kb.id);
    editForm.setFieldsValue({
      name: kb.name,
      code: kb.code,
      description: kb.description,
      avatar: kb.avatar,
      category_id: kb.category_id,
      status: kb.status !== false
    });
    setEditAvatarPreview(kb.avatar || '');
    setIsEditModalVisible(true);
  };

  const handleDeleteKnowledgebase = async (kbId: string) => {
    try {
      await knowledgebaseService.deleteKnowledgebase(kbId);
      message.success('知识库删除成功！');
      fetchKnowledgebases(selectedCategory);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const compressImage = (file: File, maxWidth: number = 100, quality: number = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleAvatarChange = async (info: any) => {
    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj;
      if (file) {
        try {
          const compressedBase64 = await compressImage(file, 200, 0.7);
          form.setFieldsValue({ avatar: compressedBase64 });
          setAvatarPreview(compressedBase64);
          message.success('头像上传成功');
        } catch (error) {
          message.error('头像处理失败');
        }
      }
    }
  };

  const handleEditAvatarChange = async (info: any) => {
    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj;
      if (file) {
        try {
          const compressedBase64 = await compressImage(file, 200, 0.7);
          editForm.setFieldsValue({ avatar: compressedBase64 });
          setEditAvatarPreview(compressedBase64);
          message.success('头像上传成功');
        } catch (error) {
          message.error('头像处理失败');
        }
      }
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('图片大小不能超过 5MB！');
        return false;
      }
      return true;
    },
    customRequest: ({ file, onSuccess }) => {
      setTimeout(() => {
        if (onSuccess) {
          onSuccess({ status: 'done' }, file);
        }
      }, 0);
    },
    onChange: handleAvatarChange,
  };

  const editUploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('图片大小不能超过 5MB！');
        return false;
      }
      return true;
    },
    customRequest: ({ file, onSuccess }) => {
      setTimeout(() => {
        if (onSuccess) {
          onSuccess({ status: 'done' }, file);
        }
      }, 0);
    },
    onChange: handleEditAvatarChange,
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await knowledgebaseService.createKnowledgebase(values);
      message.success('知识库创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setAvatarPreview('');
      fetchKnowledgebases(selectedCategory);
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingKbId) return;
    try {
      const values = await editForm.validateFields();
      await knowledgebaseService.updateKnowledgebase(editingKbId, values);
      message.success('知识库更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setEditingKbId(null);
      fetchKnowledgebases(selectedCategory);
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader 
        items={[
          { title: '知识库管理', icon: <BookOutlined /> }
        ]} 
      />

      <Layout className="knowledgebase-layout">
        <LeftSider
          width={260}
          className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}
        >
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>分类</span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddCategory}
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
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddKnowledgebase}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '18px',
                padding: '0 20px',
                height: '36px'
              }}
            >
              新增知识库
            </Button>
            <Input
              placeholder="搜索知识库名称"
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
            <Input
              placeholder="搜索知识库编码"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
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
              }
            }
            className="no-border-input"
          />
          <Select
            placeholder="按状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{
              width: '120px',
              height: '36px',
              borderRadius: '18px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000'
            }}
          >
            <Option value="">全部状态</Option>
            <Option value="true">启用</Option>
            <Option value="false">禁用</Option>
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
            ) : knowledgebases.length === 0 ? (
              <Empty 
                description="暂无知识库" 
                className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
              />
            ) : (
              <Row gutter={[16, 16]}>
                {knowledgebases.map((kb, index) => (
                  <Col 
                    key={kb.id} 
                    xs={24} 
                    sm={12} 
                    md={8} 
                    lg={6}
                    style={{ 
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <div
                      ref={(el) => {
                        if (el) cardRefs.current[kb.id] = el;
                      }}
                      onMouseMove={(e) => handleCardMouseMove(kb.id, e)}
                    >
                      <Card
                        hoverable
                        className={`knowledgebase-card ${theme === 'dark' ? 'dark' : 'light'}`}
                        bodyStyle={{ padding: '16px' }}
                      >
                        <div className="card-content">
                          <div className="card-actions">
                            <Button 
                              type="text" 
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditKnowledgebase(kb);
                              }}
                              className="action-button"
                              title="编辑"
                            />
                            <Popconfirm
                              title="确认删除"
                              description="确定要删除这个知识库吗？"
                              onConfirm={(e) => {
                                e.stopPropagation();
                                handleDeleteKnowledgebase(kb.id);
                              }}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button 
                                type="text" 
                                icon={<DeleteOutlined />}
                                danger
                                className="action-button"
                                title="删除"
                              />
                            </Popconfirm>
                          </div>
                          <div className="card-main" onClick={() => handleCardClick(kb.id)}>
                            <div className="card-avatar-container">
                              <Avatar
                                size={72}
                                icon={<BookOutlined />}
                                src={kb.avatar}
                                className="card-avatar"
                              />
                            </div>
                            <div className="card-title">{kb.name}</div>
                            <div className="card-meta">
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="card-info">
                                  <FileTextOutlined style={{ marginRight: 8 }} />
                                  <span>数据集: {kb.doc_num || 0}</span>
                                </div>
                                <div className="card-status" style={{ marginLeft: '16px' }}>
                                  {kb.status !== false ? (
                                    <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
                                  ) : (
                                    <Tag icon={<CloseCircleOutlined />} color="error">禁用</Tag>
                                  )}
                                </div>
                              </div>
                              <div className="card-date">{formatDate(kb.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </div>

          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalKbs}
              onChange={(page) => {
                if (!isChangingPageSize.current) {
                  setCurrentPage(page);
                  fetchKnowledgebases(selectedCategory, page, pageSize);
                } else {
                  isChangingPageSize.current = false;
                }
              }}
              onShowSizeChange={(current, size) => {
                isChangingPageSize.current = true;
                setPageSize(size);
                setCurrentPage(1);
                fetchKnowledgebases(selectedCategory, 1, size);
              }}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 条记录`}
              pageSizeOptions={['12', '24', '36', '48']}
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

      <Modal
        title="新增知识库"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`knowledgebase-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="请输入知识库名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="知识库编码"
            rules={[
              { required: true, message: '请输入知识库编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入知识库编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="知识库描述"
            rules={[{ required: true, message: '请输入知识库描述' }]}
          >
            <TextArea rows={3} placeholder="请输入描述，介绍知识库包含的内容以及使用场景，这将知道模型何时调用知识库" />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="分类"
          >
            <TreeSelect
              placeholder="请选择分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {avatarPreview && (
                <img 
                  src={avatarPreview} 
                  alt="头像预览" 
                  style={{ 
                    width: 60, 
                    height: 60, 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '2px solid #d9d9d9'
                  }} 
                />
              )}
              <Upload {...uploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑知识库"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setIsEditModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`knowledgebase-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="请输入知识库名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="知识库编码"
            rules={[
              { required: true, message: '请输入知识库编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入知识库编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="知识库描述"
            rules={[{ required: true, message: '请输入知识库描述' }]}
          >
            <TextArea rows={3} placeholder="请输入描述，介绍知识库包含的内容以及使用场景，这将知道模型何时调用知识库" />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="分类"
          >
            <TreeSelect
              placeholder="请选择分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {editAvatarPreview && (
                <img 
                  src={editAvatarPreview} 
                  alt="头像预览" 
                  style={{ 
                    width: 60, 
                    height: 60, 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '2px solid #d9d9d9'
                  }} 
                />
              )}
              <Upload {...editUploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onOk={handleCategorySubmit}
        onCancel={() => setIsCategoryModalVisible(false)}
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
              treeDefaultExpandAll
              allowClear
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

      <Modal
        title="编辑分类"
        open={isCategoryEditModalVisible}
        onOk={handleCategoryEditSubmit}
        onCancel={() => setIsCategoryEditModalVisible(false)}
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
              treeDefaultExpandAll
              allowClear
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
    </div>
  );
};

export default KnowledgebaseManagement;
