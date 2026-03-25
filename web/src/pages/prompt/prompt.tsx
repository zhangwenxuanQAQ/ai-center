import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Tree, Empty, Spin, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Table, Pagination, Switch, Space, TreeSelect, Checkbox, Tooltip, Drawer, Descriptions } from 'antd';
const { TextArea } = Input;
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, PlusSquareOutlined, UpOutlined, DownOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import { promptService, Prompt, PromptCategory, PromptListResponse } from '../../services/prompt';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './prompt.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

const PromptManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchName, setSearchName] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Prompt | null>(null);
  const [editingCategory, setEditingCategory] = useState<PromptCategory | null>(null);
  
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [editCategoryForm] = Form.useForm();
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const viewDrawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'light';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchCategoryTree();
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [selectedCategory, searchName, filterStatus, currentPage, pageSize]);

  useEffect(() => {
    if (isCategoryModalVisible && editingCategory) {
      editCategoryForm.setFieldsValue({
        name: editingCategory.name,
        description: editingCategory.description,
        parent_id: editingCategory.parent_id,
        sort_order: editingCategory.sort_order
      });
    }
  }, [isCategoryModalVisible, editingCategory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewDrawerVisible) {
        const target = event.target as Node;
        const drawerContent = document.querySelector('.prompt-view-drawer .ant-drawer-content-wrapper');
        if (drawerContent && !drawerContent.contains(target)) {
          setViewDrawerVisible(false);
          setViewingPrompt(null);
        }
      }
    };

    if (viewDrawerVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [viewDrawerVisible]);

  const fetchCategoryTree = async () => {
    try {
      const data = await promptService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      message.error('获取分类失败');
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const data = await promptService.getPrompts(currentPage, pageSize, selectedCategory || undefined, searchName || undefined, filterStatus || undefined);
      setPrompts(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
      message.error('获取提示词失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (selectedKeys: React.Key[]) => {
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

  const handleTreeExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  const getAllCategoryKeys = (categories: PromptCategory[]): string[] => {
    let keys: string[] = [];
    categories.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const flattenAllCategories = (cats: PromptCategory[]): PromptCategory[] => {
    let result: PromptCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: PromptCategory, direction: 'up' | 'down') => {
    try {
      const allCategories = flattenAllCategories(categories);
      const siblingCategories = allCategories.filter(c => c.parent_id === category.parent_id);
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

      await promptService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await promptService.updateCategory(targetCategory.id, { sort_order: category.sort_order });
      
      message.success('排序更新成功！');
      fetchCategoryTree();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleEditCategory = (category: PromptCategory) => {
    setEditingCategory(category);
    setIsCategoryModalVisible(true);
  };

  const handleCreateCategory = () => {
    categoryForm.validateFields().then(values => {
      promptService.createCategory(values).then(() => {
        message.success('分类创建成功');
        setIsCategoryModalVisible(false);
        categoryForm.resetFields();
        fetchCategoryTree();
      }).catch(error => {
        console.error('Failed to create category:', error);
        message.error('分类创建失败');
      });
    });
  };

  const handleUpdateCategory = () => {
    editCategoryForm.validateFields().then(values => {
      if (editingCategory) {
        promptService.updateCategory(editingCategory.id, values).then(() => {
          message.success('分类更新成功');
          setIsCategoryModalVisible(false);
          setEditingCategory(null);
          editCategoryForm.resetFields();
          fetchCategoryTree();
        }).catch(error => {
          console.error('Failed to update category:', error);
          message.error('分类更新失败');
        });
      }
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该分类吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        promptService.deleteCategory(categoryId).then(() => {
          message.success('分类删除成功');
          fetchCategoryTree();
          if (selectedCategory === categoryId) {
            setSelectedCategory(null);
            fetchPrompts();
          }
        }).catch(error => {
          console.error('Failed to delete category:', error);
          message.error('分类删除失败');
        });
      }
    });
  };

  const handleCreatePrompt = () => {
    form.validateFields().then(values => {
      promptService.createPrompt(values).then(() => {
        message.success('提示词创建成功');
        setIsPromptModalVisible(false);
        form.resetFields();
        fetchPrompts();
      }).catch(error => {
        console.error('Failed to create prompt:', error);
        message.error('提示词创建失败');
      });
    });
  };

  const handleUpdatePrompt = () => {
    editForm.validateFields().then(values => {
      if (editingItem) {
        promptService.updatePrompt(editingItem.id, values).then(() => {
          message.success('提示词更新成功');
          setIsEditModalVisible(false);
          setEditingItem(null);
          editForm.resetFields();
          fetchPrompts();
        }).catch(error => {
          console.error('Failed to update prompt:', error);
          message.error('提示词更新失败');
        });
      }
    });
  };

  const handleDeletePrompt = (promptId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该提示词吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        promptService.deletePrompt(promptId).then(() => {
          message.success('提示词删除成功');
          fetchPrompts();
        }).catch(error => {
          console.error('Failed to delete prompt:', error);
          message.error('提示词删除失败');
        });
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的提示词');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个提示词吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const deletePromises = selectedRowKeys.map(key => 
          promptService.deletePrompt(key as string)
        );
        Promise.all(deletePromises).then(() => {
          message.success('批量删除成功');
          setSelectedRowKeys([]);
          fetchPrompts();
        }).catch(error => {
          console.error('Failed to batch delete prompts:', error);
          message.error('批量删除失败');
        });
      }
    });
  };

  const handleStatusToggle = (promptId: string, status: boolean) => {
    promptService.updatePromptStatus(promptId, status).then(() => {
      message.success('状态更新成功');
      fetchPrompts();
    }).catch(error => {
      console.error('Failed to update status:', error);
      message.error('状态更新失败');
    });
  };

  const getCategoryName = (categoryId: string) => {
    const findCategory = (cats: PromptCategory[]): PromptCategory | null => {
      for (const cat of cats) {
        if (cat.id === categoryId) return cat;
        if (cat.children) {
          const found = findCategory(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    const category = findCategory(categories);
    return category ? category.name : '-';
  };

  const columns = [
    {
      title: '提示词名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (name: string, record: Prompt) => (
        <Tooltip title={name}>
          <span 
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => navigate(`/prompt/setting/${record.id}`)}
          >
            {name}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category_id',
      key: 'category_id',
      width: 150,
      ellipsis: true,
      render: (categoryId: string) => {
        const categoryName = getCategoryName(categoryId);
        return (
          <Tooltip title={categoryName}>
            <span>{categoryName}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
      render: (description: string) => {
        const desc = description || '-';
        return (
          <Tooltip title={desc}>
            <span>{desc}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: string[]) => {
        if (!tags || tags.length === 0) return '-';
        const displayTags = tags.slice(0, 3);
        const remainingTags = tags.slice(3);
        return (
          <span>
            {displayTags.map(tag => (
              <Tag key={tag} color="blue" style={{ marginBottom: '4px' }}>{tag}</Tag>
            ))}
            {remainingTags.length > 0 && (
              <Tag 
                color="blue" 
                style={{ marginBottom: '4px', cursor: 'pointer' }}
                title={remainingTags.join(', ')}
              >
                +{remainingTags.length}
              </Tag>
            )}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: boolean, record: Prompt) => (
        <Switch
          checked={status}
          onChange={(checked) => handleStatusToggle(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      ellipsis: true,
      render: (createdAt: string) => {
        const formattedDate = createdAt ? createdAt.replace('T', ' ') : '-';
        return (
          <Tooltip title={formattedDate}>
            <span>{formattedDate}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Prompt) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => {
                setViewingPrompt(record);
                setViewDrawerVisible(true);
              }} 
              size="small" 
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`/prompt/setting/${record.id}`)} size="small" />
          </Tooltip>
          <Popconfirm
            title="确定要删除该提示词吗？"
            onConfirm={() => handleDeletePrompt(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };

    const buildCategoryNode = (category: PromptCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          {!category.is_default && (
            <div className="category-actions">
              <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
              <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
              <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
              <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }} okText="确认" cancelText="取消">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除" className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </div>
          )}
        </div>
      ),
      key: `category-${category.id}`,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildCategoryNode(child)) : undefined,
    });

    const categoryNodes = categories.map(category => buildCategoryNode(category));
    return [allNode, ...categoryNodes];
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { title: '提示词管理', icon: <FileTextOutlined /> }
        ]}
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setIsPromptModalVisible(true);
            }}
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}
          >
            新增提示词
          </Button>
        }
      />

      <Layout className="prompt-layout">
        <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>分类</span>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingCategory(null);
                categoryForm.resetFields();
                const allCategories = flattenAllCategories(categories);
                const maxSortOrder = allCategories.length > 0 
                  ? Math.max(...allCategories.map(c => c.sort_order || 0)) 
                  : 0;
                categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
                setIsCategoryModalVisible(true);
              }} 
              size="small" 
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}
            >
              新增分类
            </Button>
          </div>
          <Tree
            showIcon
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onSelect={handleCategorySelect}
            onExpand={handleTreeExpand}
            treeData={buildTreeData()}
            className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`}
          />
        </LeftSider>

        <Content className={`prompt-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/prompt/setting/new')}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}
            >
              新增提示词
            </Button>
            <Button 
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              className="batch-delete-button"
              disabled={selectedRowKeys.length === 0}
            >
              批量删除 ({selectedRowKeys.length})
            </Button>
            <Input
              placeholder="搜索提示词名称"
              value={searchName}
              onChange={(e) => {
                setSearchName(e.target.value);
                setCurrentPage(1);
              }}
              prefix={<SearchOutlined />}
              suffix={searchName ? (
                <CloseOutlined 
                  onClick={() => {
                    setSearchName('');
                    setCurrentPage(1);
                  }} 
                  style={{ cursor: 'pointer' }}
                />
              ) : null}
              style={{ width: '200px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
              className="no-border-input"
            />
            <Select
              placeholder="请选择状态"
              value={filterStatus || undefined}
              onChange={(value) => {
                setFilterStatus(value);
                setCurrentPage(1);
              }}
              style={{
                width: '150px',
                borderRadius: '18px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                height: '36px'
              }}
              className="no-border-input"
            >
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
            <Button 
              icon={<CloseOutlined />}
              onClick={() => {
                setSearchName('');
                setFilterStatus('');
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
            overflowY: 'auto', 
            marginBottom: '0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }} className="hide-scrollbar">
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <Table
              columns={columns}
              dataSource={prompts}
              rowKey="id"
              pagination={false}
              scroll={{ y: 'calc(100vh - 300px)' }}
              loading={loading}
              locale={{ emptyText: '暂无提示词' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
              }}
              onHeaderRow={(columns, index) => ({
                onDoubleClick: () => {
                  // 双击表头可以重置列宽
                  console.log('Double clicked header row');
                },
              })}
              onRow={(record, index) => ({
                onClick: () => {
                  console.log('Clicked row:', record);
                },
              })}
              size="small"
            />
          </div>
          
          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
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
              pageSizeOptions={['20', '40', '60', '80']}
              locale={{
                items_per_page: '条/页',
                jump_to: '前往',
                jump_to_confirm: '确定',
                page: '页',
                prev_page: '上一页',
                next_page: '下一页',
                prev_5: '向前 5 页',
                next_5: '向后 5 页',
                prev_3: '向前 3 页',
                next_3: '向后 3 页',
                first: '第一页',
                last: '最后一页'
              }}
              className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{
                margin: 0
              }}
            />
          </div>
        </Content>
      </Layout>

      {/* 分类弹窗 */}
      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={isCategoryModalVisible}
        onCancel={() => {
          setIsCategoryModalVisible(false);
          setEditingCategory(null);
          categoryForm.resetFields();
          editCategoryForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsCategoryModalVisible(false);
            setEditingCategory(null);
            categoryForm.resetFields();
            editCategoryForm.resetFields();
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}>
            确定
          </Button>,
        ]}
        width={600}
      >
        <Form form={editingCategory ? editCategoryForm : categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect
              placeholder="请选择父分类"
              treeData={categories.map(category => ({
                title: category.name,
                value: category.id,
                key: category.id,
                children: category.children && category.children.length > 0 ? category.children.map(child => ({
                  title: child.name,
                  value: child.id,
                  key: child.id
                })) : undefined
              }))}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 提示词弹窗 */}
      <Modal
        title={editingItem ? '编辑提示词' : '新增提示词'}
        open={isPromptModalVisible || isEditModalVisible}
        onCancel={() => {
          setIsPromptModalVisible(false);
          setIsEditModalVisible(false);
          setEditingItem(null);
          form.resetFields();
          editForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsPromptModalVisible(false);
            setIsEditModalVisible(false);
            setEditingItem(null);
            form.resetFields();
            editForm.resetFields();
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={editingItem ? handleUpdatePrompt : handleCreatePrompt}>
            确定
          </Button>,
        ]}
        width={720}
      >
        <Form form={editingItem ? editForm : form} layout="vertical">
          <Form.Item name="name" label="提示词名称" rules={[{ required: true, message: '请输入提示词名称' }]}>
            <Input placeholder="请输入提示词名称" />
          </Form.Item>
          <Form.Item name="content" label="提示词内容" rules={[{ required: true, message: '请输入提示词内容' }]}>
            <TextArea rows={6} placeholder="请输入提示词内容" />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <TreeSelect
              placeholder="请选择分类"
              treeData={categories.map(category => ({
                title: category.name,
                value: category.id,
                key: category.id,
                children: category.children && category.children.length > 0 ? category.children.map(child => ({
                  title: child.name,
                  value: child.id,
                  key: child.id
                })) : undefined
              }))}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="请输入标签"
              options={[
                { label: '通用', value: '通用' },
                { label: '客服', value: '客服' },
                { label: '技术', value: '技术' },
                { label: '营销', value: '营销' },
                { label: '教育', value: '教育' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看提示词抽屉 */}
      <Drawer
        title="提示词详情"
        placement="right"
        width={600}
        open={viewDrawerVisible}
        onClose={() => {
          setViewDrawerVisible(false);
          setViewingPrompt(null);
        }}
        getContainer={false}
        mask={false}
        className={`prompt-view-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', padding: '24px' },
          footer: { display: 'none' }
        }}
      >
        {viewingPrompt && (
          <div>
            <Descriptions 
              column={1} 
              bordered={false}
              labelStyle={{ 
                fontWeight: 'bold',
                color: theme === 'dark' ? '#fff' : '#000',
                width: '120px'
              }}
              contentStyle={{
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            >
              <Descriptions.Item label="提示词名称">{viewingPrompt.name}</Descriptions.Item>
              <Descriptions.Item label="分类">{getCategoryName(viewingPrompt.category_id)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {viewingPrompt.status ? (
                  <Tag color="success">启用</Tag>
                ) : (
                  <Tag color="error">禁用</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                {viewingPrompt.tags && viewingPrompt.tags.length > 0 ? (
                  viewingPrompt.tags.map(tag => (
                    <Tag key={tag} color="blue" style={{ marginBottom: '4px' }}>{tag}</Tag>
                  ))
                ) : (
                  <span style={{ color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>-</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {viewingPrompt.description || <span style={{ color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>-</span>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {viewingPrompt.created_at ? viewingPrompt.created_at.replace('T', ' ') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {viewingPrompt.updated_at ? viewingPrompt.updated_at.replace('T', ' ') : '-'}
              </Descriptions.Item>
            </Descriptions>
            
            <div style={{ marginTop: '24px' }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '12px',
                color: theme === 'dark' ? '#fff' : '#000',
                fontSize: '14px'
              }}>
                提示词内容
              </div>
              <div 
                className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                  borderRadius: '8px',
                  padding: '16px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9'
                }}
              >
                <MDEditor.Markdown 
                  source={viewingPrompt.content || ''} 
                  style={{ 
                    background: 'transparent',
                    color: theme === 'dark' ? '#fff' : '#000'
                  }} 
                />
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PromptManagement;
