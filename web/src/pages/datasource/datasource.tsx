import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Avatar, Tag, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, Popconfirm, Pagination, Switch, message, Tabs, Table, Badge, InputNumber } from 'antd';
const { TextArea, Password } = Input;
import { CloudServerOutlined, PlusOutlined, MoreOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, CheckCircleOutlined, CloseCircleOutlined, DatabaseOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TreeDataNode, TreeProps } from 'antd';
import { datasourceService, Datasource, DatasourceCategory, DatasourceType } from '../../services/datasource';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './datasource.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;
const { TabPane } = Tabs;

const DatasourceManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<DatasourceCategory[]>([]);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // 新增数据源相关状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isQueryModalVisible, setIsQueryModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [datasourceTypes, setDatasourceTypes] = useState<DatasourceType[]>([]);
  const [selectedDatasourceType, setSelectedDatasourceType] = useState<string>('');
  const [selectedEditDatasourceType, setSelectedEditDatasourceType] = useState<string>('');
  const [datasourceConfig, setDatasourceConfig] = useState<Record<string, any>>({});
  const [editDatasourceConfig, setEditDatasourceConfig] = useState<Record<string, any>>({});
  const [editingDatasourceId, setEditingDatasourceId] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [searchDatasourceType, setSearchDatasourceType] = useState<string>('');
  const [filteredDatasources, setFilteredDatasources] = useState<Datasource[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalDatasources, setTotalDatasources] = useState<number>(0);
  
  // 分类相关状态
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<DatasourceCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  
  // 查询相关状态
  const [queryDatasource, setQueryDatasource] = useState<Datasource | null>(null);
  const [queryText, setQueryText] = useState<string>('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // 防止切换pageSize时重复调用API的标志
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
    fetchDatasources();
    fetchDatasourceTypes();
  }, []);

  useEffect(() => {
    fetchDatasources(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    fetchDatasources(selectedCategory, 1, pageSize);
  }, [searchKeyword, searchCode, searchDatasourceType, selectedCategory]);

  // 递归获取所有分类节点的键
  const getAllCategoryKeys = (categories: DatasourceCategory[]): string[] => {
    let keys: string[] = [];
    categories.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const fetchCategories = async () => {
    try {
      const data = await datasourceService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchDatasources = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      const response = await datasourceService.getDatasources(
        categoryId || undefined, 
        page !== undefined ? page : currentPage, 
        size !== undefined ? size : pageSize, 
        searchKeyword, 
        searchCode,
        searchDatasourceType || undefined
      );
      const data = response.data;
      setDatasources(data);
      setFilteredDatasources(data);
      setTotalDatasources(response.total);
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      setDatasources([]);
      setFilteredDatasources([]);
      setTotalDatasources(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatasourceTypes = async () => {
    try {
      const data = await datasourceService.getDatasourceTypes();
      setDatasourceTypes(data);
    } catch (error) {
      console.error('Failed to fetch datasource types:', error);
    }
  };

  // 分类相关处理函数
  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...categories.map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: DatasourceCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  // 扁平化所有分类，包括子分类
  const flattenAllCategories = (cats: DatasourceCategory[]): DatasourceCategory[] => {
    let result: DatasourceCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: DatasourceCategory, direction: 'up' | 'down') => {
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

      await datasourceService.updateCategoryOrder(category.id, targetCategory.sort_order);
      await datasourceService.updateCategoryOrder(targetCategory.id, category.sort_order);
      
      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: DatasourceCategory) => {
    try {
      await datasourceService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await datasourceService.createCategory(values);
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
      await datasourceService.updateCategory(editingCategory.id, values);
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

    const buildCategoryNode = (category: DatasourceCategory): TreeDataNode => {
      const node: TreeDataNode = {
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
        children: category.children && category.children.length > 0 
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      };
      return node;
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
        children: category.children && category.children.length > 0 
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

  // 构建分类下拉树数据
  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: DatasourceCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0
        ? category.children.map(child => buildNode(child))
        : undefined,
    });

    return categories.map(category => buildNode(category));
  };

  const getDatasourceTypeLabel = (datasourceType?: string): string => {
    const type = datasourceTypes.find(t => t.datasource_type === datasourceType);
    return type?.datasource_name || datasourceType || '';
  };

  const getDatasourceTypeIcon = (datasourceType?: string) => {
    const cat = datasourceType ? (datasourceType.includes('mysql') || datasourceType.includes('postgresql') || datasourceType.includes('oracle') || datasourceType.includes('sql_server') ? 'database' : 'storage') : 'database';
    return cat === 'database' ? <DatabaseOutlined /> : <CloudServerOutlined />;
  };

  const getDatasourceAvatar = (datasourceType?: string) => {
    switch (datasourceType) {
      case 'mysql':
        return '/src/assets/datasource/mysql.svg';
      case 'postgresql':
        return '/src/assets/datasource/postgresql.svg';
      case 'oracle':
        return '/src/assets/datasource/oracle.svg';
      case 'sql_server':
        return '/src/assets/datasource/sql_server.svg';
      case 's3':
        return '/src/assets/datasource/amazon_s3.svg';
      case 'minio':
        return '/src/assets/datasource/minio.svg';
      case 'rustfs':
        return '/src/assets/datasource/rustfs.svg';
      default:
        return '/src/assets/datasource/datasource.svg';
    }
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

  const handleAddDatasource = () => {
    form.resetFields();
    setSelectedDatasourceType('');
    setDatasourceConfig({});
    setConnectionTestResult(null);
    setIsModalVisible(true);
  };

  const handleEditDatasource = (datasource: Datasource) => {
    setEditingDatasourceId(datasource.id);
    editForm.setFieldsValue({
      name: datasource.name,
      code: datasource.code,
      type: datasource.type,
      category_id: datasource.category_id,
      status: datasource.status
    });
    setSelectedEditDatasourceType(datasource.type);
    if (datasource.config) {
      setEditDatasourceConfig(datasource.config);
    } else {
      setEditDatasourceConfig({});
    }
    setConnectionTestResult(null);
    setIsEditModalVisible(true);
  };

  const handleTestConnection = async (datasource: Datasource) => {
    try {
      const result = await datasourceService.testConnection(datasource.id);
      if (result.success) {
        message.success('连接测试成功！');
      } else {
        message.error(`连接测试失败：${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      message.error('连接测试失败');
    }
  };

  const handleOpenQueryModal = (datasource: Datasource) => {
    setQueryDatasource(datasource);
    setQueryText('');
    setQueryResult(null);
    setIsQueryModalVisible(true);
  };

  const handleExecuteQuery = async () => {
    if (!queryDatasource || !queryText) {
      message.warning('请输入查询语句');
      return;
    }
    setQueryLoading(true);
    try {
      const result = await datasourceService.executeQuery(queryDatasource.id, queryText);
      setQueryResult(result);
      if (result.success) {
        message.success('查询执行成功！');
      } else {
        message.error(`查询执行失败：${result.message}`);
      }
    } catch (error) {
      console.error('查询执行失败:', error);
      message.error('查询执行失败');
    } finally {
      setQueryLoading(false);
    }
  };

  const handleDatasourceTypeChange = (value: string) => {
    setSelectedDatasourceType(value);
    const datasourceType = datasourceTypes.find(t => t.datasource_type === value);
    if (datasourceType && datasourceType.config_fields) {
      const defaultConfig: Record<string, any> = {};
      datasourceType.config_fields.forEach((field: any) => {
        if (field.default_value !== undefined && field.default_value !== null) {
          defaultConfig[field.name] = field.default_value;
        }
      });
      setDatasourceConfig(defaultConfig);
    } else {
      setDatasourceConfig({});
    }
  };

  const handleEditDatasourceTypeChange = (value: string) => {
    setSelectedEditDatasourceType(value);
    const datasourceType = datasourceTypes.find(t => t.datasource_type === value);
    if (datasourceType && datasourceType.config_fields) {
      const defaultConfig: Record<string, any> = {};
      datasourceType.config_fields.forEach((field: any) => {
        if (field.default_value !== undefined && field.default_value !== null) {
          defaultConfig[field.name] = field.default_value;
        }
      });
      setEditDatasourceConfig(defaultConfig);
    } else {
      setEditDatasourceConfig({});
    }
  };

  const handleDatasourceConfigChange = (field: string, value: any) => {
    setDatasourceConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditDatasourceConfigChange = (field: string, value: any) => {
    setEditDatasourceConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const datasourceType = datasourceTypes.find(t => t.datasource_type === selectedDatasourceType);
      const datasourceData = {
        ...values,
        type: selectedDatasourceType,
        config: selectedDatasourceType && datasourceType?.config_fields?.length > 0 ? datasourceConfig : undefined
      };
      
      await datasourceService.createDatasource(datasourceData);
      message.success('数据源创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setSelectedDatasourceType('');
      setDatasourceConfig({});
      fetchDatasources(selectedCategory);
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingDatasourceId) return;
    try {
      const values = await editForm.validateFields();
      
      const datasourceType = datasourceTypes.find(t => t.datasource_type === selectedEditDatasourceType);
      const datasourceData = {
        ...values,
        type: selectedEditDatasourceType,
        config: selectedEditDatasourceType && datasourceType?.config_fields?.length > 0 ? editDatasourceConfig : undefined
      };
      
      await datasourceService.updateDatasource(editingDatasourceId, datasourceData);
      message.success('数据源更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setSelectedEditDatasourceType('');
      setEditDatasourceConfig({});
      setEditingDatasourceId(null);
      fetchDatasources(selectedCategory);
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteDatasource = async (datasourceId: string) => {
    try {
      await datasourceService.deleteDatasource(datasourceId);
      message.success('数据源删除成功！');
      fetchDatasources(selectedCategory);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleTestConnectionModal = async (formInstance: any, datasourceType: string) => {
    try {
      const values = await formInstance.validateFields(['name', 'code', 'type', 'category_id']);
      setTestingConnection(true);
      setConnectionTestResult(null);
      
      // 构建测试连接的数据
      const testData = {
        name: values.name,
        code: values.code,
        type: datasourceType,
        category_id: values.category_id,
        config: datasourceType === selectedDatasourceType ? datasourceConfig : editDatasourceConfig
      };
      
      const result = await datasourceService.testConnection('test', testData);
      
      setConnectionTestResult({
        success: result.success || false,
        message: result.message || '连接测试失败'
      });
      
      if (result.success) {
        message.success('连接测试成功！');
      } else {
        message.error(result.message || '连接测试失败');
      }
    } catch (error: any) {
      console.error('测试连接失败:', error);
      setConnectionTestResult({
        success: false,
        message: error.message || '连接测试失败'
      });
      message.error('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const getDatasourceConfigFields = (type: string) => {
    const datasourceType = datasourceTypes.find(t => t.datasource_type === type);
    if (!datasourceType) return [];
    return datasourceType.config_fields || [];
  };

  const renderQueryResult = () => {
    if (!queryResult) return null;
    
    if (!queryResult.success) {
      return (
        <div style={{ color: '#ff4d4f', padding: '16px' }}>
          <CloseCircleOutlined style={{ marginRight: '8px' }} />
          {queryResult.message}
        </div>
      );
    }
    
    const data = queryResult.data;
    if (!data) {
      return (
        <div style={{ padding: '16px', color: '#52c41a' }}>
          <CheckCircleOutlined style={{ marginRight: '8px' }} />
          {queryResult.message}
        </div>
      );
    }
    
    if (data.rows && data.columns) {
      const tableColumns = data.columns.map((col: string) => ({
        title: col,
        dataIndex: col,
        key: col,
        ellipsis: true,
      }));
      
      return (
        <div>
          <div style={{ color: '#52c41a', marginBottom: '16px' }}>
            <CheckCircleOutlined style={{ marginRight: '8px' }} />
            查询成功，共 {data.total} 条记录
          </div>
          <Table
            columns={tableColumns}
            dataSource={data.rows}
            rowKey={(record, index) => index.toString()}
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: true }}
          />
        </div>
      );
    }
    
    if (data.tables) {
      return (
        <div>
          <div style={{ color: '#52c41a', marginBottom: '16px' }}>
            <CheckCircleOutlined style={{ marginRight: '8px' }} />
            Schema信息获取成功
          </div>
          <Tabs defaultActiveKey="0">
            {data.tables.map((table: any, index: number) => (
              <TabPane tab={table.table_name} key={index.toString()}>
                <div style={{ marginBottom: '8px', color: '#666' }}>
                  {table.table_comment}
                </div>
                <Table
                  columns={[
                    { title: '列名', dataIndex: 'COLUMN_NAME', key: 'name' },
                    { title: '类型', dataIndex: 'DATA_TYPE', key: 'type' },
                    { title: '可为空', dataIndex: 'IS_NULLABLE', key: 'nullable' },
                  ]}
                  dataSource={table.columns}
                  rowKey={(record: any) => record.COLUMN_NAME}
                  pagination={false}
                  size="small"
                />
              </TabPane>
            ))}
          </Tabs>
        </div>
      );
    }
    
    if (data.buckets) {
      return (
        <div>
          <div style={{ color: '#52c41a', marginBottom: '16px' }}>
            <CheckCircleOutlined style={{ marginRight: '8px' }} />
            Bucket列表获取成功
          </div>
          <Table
            columns={[
              { title: 'Bucket名称', dataIndex: 'name', key: 'name' },
              { title: '创建时间', dataIndex: 'creation_date', key: 'date' },
            ]}
            dataSource={data.buckets}
            rowKey={(record: any) => record.name}
            pagination={false}
            size="small"
          />
        </div>
      );
    }
    
    return (
      <div style={{ padding: '16px' }}>
        <pre>{JSON.stringify(queryResult, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader 
        items={[
          { title: '数据源管理', icon: <CloudServerOutlined /> }
        ]} 
      />

      <Layout className="datasource-layout">
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

        <Content className={`datasource-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddDatasource}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '18px',
                padding: '0 20px',
                height: '36px'
              }}
            >
              新增数据源
            </Button>
            <Input
              placeholder="搜索数据源名称"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              prefix={<SearchOutlined />}
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
              placeholder="搜索数据源编码"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              prefix={<SearchOutlined />}
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
              placeholder="按类型筛选"
              value={searchDatasourceType}
              onChange={setSearchDatasourceType}
              style={{
                width: '200px',
                borderRadius: '18px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                height: '36px'
              }}
            >
              <Option value="">全部类型</Option>
              {datasourceTypes.map(type => (
                <Option key={type.datasource_type} value={type.datasource_type}>
                  {type.datasource_name}
                </Option>
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
            ) : filteredDatasources.length === 0 ? (
              <Empty 
                description="暂无数据源" 
                className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
              />
            ) : (
              <Row gutter={[16, 16]}>
                {filteredDatasources.map((datasource, index) => (
                  <Col 
                    key={datasource.id} 
                    xs={24} 
                    sm={12} 
                    md={8} 
                    lg={6}
                    style={{ 
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <Card
                      hoverable
                      className={`datasource-card ${theme === 'dark' ? 'dark' : 'light'}`}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div className="card-content">
                        <div className="card-actions">
                          <Button 
                            type="text" 
                            icon={<LinkOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestConnection(datasource);
                            }}
                            className="action-button"
                            title="测试连接"
                          />
                          <Button 
                            type="text" 
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDatasource(datasource);
                            }}
                            className="action-button"
                            title="编辑"
                          />
                          <Popconfirm
                              title="确认删除"
                              description="确定要删除这个数据源吗？"
                              onConfirm={(e) => {
                                e.stopPropagation();
                                handleDeleteDatasource(datasource.id);
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
                        <div className="card-main">
                          <div className="card-avatar-container">
                            <img 
                              src={getDatasourceAvatar(datasource.type)} 
                              alt={datasource.type}
                              className="card-avatar"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                opacity: datasource.status ? 1 : 0.6
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/src/assets/datasource/datasource.svg';
                              }}
                            />
                          </div>
                          <div className="card-title">
                            {datasource.name}
                          </div>
                          <div className="card-meta">
                            <div className="card-type">
                              {getDatasourceTypeIcon(datasource.type)}
                              <span style={{ marginLeft: '4px' }}>{getDatasourceTypeLabel(datasource.type)}</span>
                            </div>
                            <div className="card-status">
                              {datasource.status ? (
                                <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
                              ) : (
                                <Tag icon={<CloseCircleOutlined />} color="error">禁用</Tag>
                              )}
                            </div>
                          </div>
                          <div className="card-bottom">
                            <div className="card-date">{formatDate(datasource.created_at)}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </div>
          
          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalDatasources}
              onChange={(page) => {
                if (!isChangingPageSize.current) {
                  setCurrentPage(page);
                  fetchDatasources(selectedCategory, page, pageSize);
                } else {
                  isChangingPageSize.current = false;
                }
              }}
              onShowSizeChange={(current, size) => {
                isChangingPageSize.current = true;
                setPageSize(size);
                setCurrentPage(1);
                fetchDatasources(selectedCategory, 1, size);
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

      <Modal
        title="新增数据源"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => { setIsModalVisible(false); setConnectionTestResult(null); }}
        width={700}
        okText="保存"
        cancelText="取消"
        className={`datasource-modal ${theme === 'dark' ? 'dark' : 'light'}`}
        footer={[
          <Button key="cancel" onClick={() => { setIsModalVisible(false); setConnectionTestResult(null); }}>
            取消
          </Button>,
          <Button 
            key="test" 
            type="default" 
            icon={testingConnection ? <LoadingOutlined /> : <LinkOutlined />}
            onClick={() => handleTestConnectionModal(form, selectedDatasourceType)}
            loading={testingConnection}
            style={{ marginRight: '8px' }}
            disabled={!selectedDatasourceType}
          >
            {testingConnection ? '测试中...' : '测试连接'}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>
            保存
          </Button>,
          connectionTestResult && (
            <span key="result" style={{ 
              color: connectionTestResult.success ? '#52c41a' : '#ff4d4f',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '8px'
            }}>
              {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {connectionTestResult.message}
            </span>
          )
        ].filter(Boolean)}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: true
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="数据源名称"
                rules={[{ required: true, message: '请输入数据源名称' }]}
              >
                <Input placeholder="请输入数据源名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="数据源编码"
                rules={[
                  { required: true, message: '请输入数据源编码' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
                ]}
              >
                <Input placeholder="请输入数据源编码（字母、数字、下划线）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="数据源类型"
                rules={[{ required: true, message: '请选择数据源类型' }]}
              >
                <Select 
                  placeholder="请选择数据源类型" 
                  onChange={handleDatasourceTypeChange}
                >
                  {datasourceTypes.map(type => (
                    <Option key={type.datasource_type} value={type.datasource_type}>
                      {type.datasource_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          {selectedDatasourceType && (
            <div>
              {getDatasourceConfigFields(selectedDatasourceType).reduce((acc, field, index) => {
                if (index % 2 === 0) {
                  acc.push(
                    <Row key={index} gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          key={field.name}
                          label={field.title}
                          rules={field.required ? [{ required: true, message: `请输入${field.title}` }] : []}
                        >
                          {field.type === 'password' ? (
                            <Password 
                              placeholder={field.description} 
                              value={datasourceConfig[field.name]}
                              onChange={(e) => handleDatasourceConfigChange(field.name, e.target.value)}
                            />
                          ) : field.type === 'boolean' ? (
                            <Switch 
                              checked={datasourceConfig[field.name]}
                              onChange={(checked) => handleDatasourceConfigChange(field.name, checked)}
                            />
                          ) : field.type === 'integer' ? (
                            <InputNumber 
                              placeholder={field.description} 
                              value={datasourceConfig[field.name]}
                              onChange={(value) => handleDatasourceConfigChange(field.name, value)}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            <Input 
                              placeholder={field.description} 
                              value={datasourceConfig[field.name]}
                              onChange={(e) => handleDatasourceConfigChange(field.name, e.target.value)}
                            />
                          )}
                        </Form.Item>
                      </Col>
                      {getDatasourceConfigFields(selectedDatasourceType)[index + 1] && (
                        <Col span={12}>
                          <Form.Item
                            key={getDatasourceConfigFields(selectedDatasourceType)[index + 1].name}
                            label={getDatasourceConfigFields(selectedDatasourceType)[index + 1].title}
                            rules={getDatasourceConfigFields(selectedDatasourceType)[index + 1].required ? [{ required: true, message: `请输入${getDatasourceConfigFields(selectedDatasourceType)[index + 1].title}` }] : []}
                          >
                            {getDatasourceConfigFields(selectedDatasourceType)[index + 1].type === 'password' ? (
                              <Password 
                                placeholder={getDatasourceConfigFields(selectedDatasourceType)[index + 1].description} 
                                value={datasourceConfig[getDatasourceConfigFields(selectedDatasourceType)[index + 1].name]}
                                onChange={(e) => handleDatasourceConfigChange(getDatasourceConfigFields(selectedDatasourceType)[index + 1].name, e.target.value)}
                              />
                            ) : getDatasourceConfigFields(selectedDatasourceType)[index + 1].type === 'boolean' ? (
                              <Switch 
                                checked={datasourceConfig[getDatasourceConfigFields(selectedDatasourceType)[index + 1].name]}
                                onChange={(checked) => handleDatasourceConfigChange(getDatasourceConfigFields(selectedDatasourceType)[index + 1].name, checked)}
                              />
                            ) : getDatasourceConfigFields(selectedDatasourceType)[index + 1].type === 'integer' ? (
                              <InputNumber 
                                placeholder={getDatasourceConfigFields(selectedDatasourceType)[index + 1].description} 
                                value={datasourceConfig[getDatasourceConfigFields(selectedDatasourceType)[index + 1].name]}
                                onChange={(value) => handleDatasourceConfigChange(getDatasourceConfigFields(selectedDatasourceType)[index + 1].name, value)}
                                style={{ width: '100%' }}
                              />
                            ) : (
                              <Input 
                                placeholder={getDatasourceConfigFields(selectedDatasourceType)[index + 1].description} 
                                value={datasourceConfig[getDatasourceConfigFields(selectedDatasourceType)[index + 1].name]}
                                onChange={(e) => handleDatasourceConfigChange(getDatasourceConfigFields(selectedDatasourceType)[index + 1].name, e.target.value)}
                              />
                            )}
                          </Form.Item>
                        </Col>
                      )}
                    </Row>
                  );
                }
                return acc;
              }, [] as React.ReactNode[])}
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="编辑数据源"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => { setIsEditModalVisible(false); setConnectionTestResult(null); }}
        width={700}
        okText="保存"
        cancelText="取消"
        className={`datasource-modal ${theme === 'dark' ? 'dark' : 'light'}`}
        footer={[
          <Button key="cancel" onClick={() => { setIsEditModalVisible(false); setConnectionTestResult(null); }}>
            取消
          </Button>,
          <Button 
            key="test" 
            type="default" 
            icon={testingConnection ? <LoadingOutlined /> : <LinkOutlined />}
            onClick={() => handleTestConnectionModal(editForm, selectedEditDatasourceType)}
            loading={testingConnection}
            style={{ marginRight: '8px' }}
            disabled={!selectedEditDatasourceType}
          >
            {testingConnection ? '测试中...' : '测试连接'}
          </Button>,
          <Button key="submit" type="primary" onClick={handleEditSubmit}>
            保存
          </Button>,
          connectionTestResult && (
            <span key="result" style={{ 
              color: connectionTestResult.success ? '#52c41a' : '#ff4d4f',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '8px'
            }}>
              {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {connectionTestResult.message}
            </span>
          )
        ].filter(Boolean)}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="数据源名称"
                rules={[{ required: true, message: '请输入数据源名称' }]}
              >
                <Input placeholder="请输入数据源名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="数据源编码"
                rules={[
                  { required: true, message: '请输入数据源编码' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
                ]}
              >
                <Input placeholder="请输入数据源编码（字母、数字、下划线）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="数据源类型"
                rules={[{ required: true, message: '请选择数据源类型' }]}
              >
                <Select 
                  placeholder="请选择数据源类型" 
                  onChange={handleEditDatasourceTypeChange}
                >
                  {datasourceTypes.map(type => (
                    <Option key={type.datasource_type} value={type.datasource_type}>
                      {type.datasource_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          {selectedEditDatasourceType && (
            <div>
              {getDatasourceConfigFields(selectedEditDatasourceType).reduce((acc, field, index) => {
                if (index % 2 === 0) {
                  acc.push(
                    <Row key={index} gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          key={field.name}
                          label={field.title}
                          rules={field.required ? [{ required: true, message: `请输入${field.title}` }] : []}
                        >
                          {field.type === 'password' ? (
                            <Password 
                              placeholder={field.description} 
                              value={editDatasourceConfig[field.name]}
                              onChange={(e) => handleEditDatasourceConfigChange(field.name, e.target.value)}
                            />
                          ) : field.type === 'boolean' ? (
                            <Switch 
                              checked={editDatasourceConfig[field.name]}
                              onChange={(checked) => handleEditDatasourceConfigChange(field.name, checked)}
                            />
                          ) : field.type === 'integer' ? (
                            <InputNumber 
                              placeholder={field.description} 
                              value={editDatasourceConfig[field.name]}
                              onChange={(value) => handleEditDatasourceConfigChange(field.name, value)}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            <Input 
                              placeholder={field.description} 
                              value={editDatasourceConfig[field.name]}
                              onChange={(e) => handleEditDatasourceConfigChange(field.name, e.target.value)}
                            />
                          )}
                        </Form.Item>
                      </Col>
                      {getDatasourceConfigFields(selectedEditDatasourceType)[index + 1] && (
                        <Col span={12}>
                          <Form.Item
                            key={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name}
                            label={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].title}
                            rules={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].required ? [{ required: true, message: `请输入${getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].title}` }] : []}
                          >
                            {getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].type === 'password' ? (
                              <Password 
                                placeholder={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].description} 
                                value={editDatasourceConfig[getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name]}
                                onChange={(e) => handleEditDatasourceConfigChange(getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name, e.target.value)}
                              />
                            ) : getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].type === 'boolean' ? (
                              <Switch 
                                checked={editDatasourceConfig[getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name]}
                                onChange={(checked) => handleEditDatasourceConfigChange(getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name, checked)}
                              />
                            ) : getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].type === 'integer' ? (
                              <InputNumber 
                                placeholder={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].description} 
                                value={editDatasourceConfig[getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name]}
                                onChange={(value) => handleEditDatasourceConfigChange(getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name, value)}
                                style={{ width: '100%' }}
                              />
                            ) : (
                              <Input 
                                placeholder={getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].description} 
                                value={editDatasourceConfig[getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name]}
                                onChange={(e) => handleEditDatasourceConfigChange(getDatasourceConfigFields(selectedEditDatasourceType)[index + 1].name, e.target.value)}
                              />
                            )}
                          </Form.Item>
                        </Col>
                      )}
                    </Row>
                  );
                }
                return acc;
              }, [] as React.ReactNode[])}
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="数据查询"
        open={isQueryModalVisible}
        onCancel={() => setIsQueryModalVisible(false)}
        width={900}
        footer={null}
        className={`datasource-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>
            数据源：{queryDatasource?.name} ({getDatasourceTypeLabel(queryDatasource?.type)})
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <TextArea
              rows={4}
              placeholder="请输入查询语句（SQL SELECT 或 JSON 查询对象）"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleExecuteQuery}
              loading={queryLoading}
            >
              执行查询
            </Button>
          </div>
        </div>
        <div style={{ 
          borderTop: theme === 'dark' ? '1px solid #333333' : '1px solid #e8e8e8',
          paddingTop: '16px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {renderQueryResult()}
        </div>
      </Modal>

      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onOk={handleCategorySubmit}
        onCancel={() => setIsCategoryModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`datasource-modal ${theme === 'dark' ? 'dark' : 'light'}`}
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
            rules={[
              { required: true, message: '请输入排序顺序' },
              { 
                validator: (_, value) => {
                  const num = Number(value);
                  if (value === '' || value === undefined || value === null) {
                    return Promise.reject('请输入排序顺序');
                  }
                  if (isNaN(num)) {
                    return Promise.reject('请输入有效的数字');
                  }
                  if (num < 1) {
                    return Promise.reject('排序号必须大于0');
                  }
                  return Promise.resolve();
                }
              }
            ]}
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
        className={`datasource-modal ${theme === 'dark' ? 'dark' : 'light'}`}
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
            rules={[
              { required: true, message: '请输入排序顺序' },
              { 
                validator: (_, value) => {
                  const num = Number(value);
                  if (value === '' || value === undefined || value === null) {
                    return Promise.reject('请输入排序顺序');
                  }
                  if (isNaN(num)) {
                    return Promise.reject('请输入有效的数字');
                  }
                  if (num < 1) {
                    return Promise.reject('排序号必须大于0');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DatasourceManagement;
