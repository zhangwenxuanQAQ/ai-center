import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, message, Popconfirm, Pagination, Tag, Switch, Tooltip } from 'antd';
import type { TreeDataNode } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiTwoTone, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { llmModelService, LLMModel } from '../../services/llm_model';
import '../../styles/common.css';
import './llm_model.less';
import { getProviderAvatar } from '../../utils/avatar';

const { Option } = Select;

const MODEL_NAME_TO_PROVIDER = {
  "qwen": "Qwen",
  "Qwen": "Qwen",
  "deepseek": "DeepSeek",
  "DeepSeek": "DeepSeek",
  "kimi": "Kimi",
  "Kimi": "Kimi",
  "minimax": "MiniMax",
  "MiniMax": "MiniMax",
  "glm": "GLM",
  "GLM": "GLM"
};

const getProviderFromModelName = (modelName: string): string => {
  const lowercaseName = modelName.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_NAME_TO_PROVIDER)) {
    if (lowercaseName.includes(key.toLowerCase())) {
      return value;
    }
  }
  return "";
};

const LLMModelManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<LLMCategory[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({});
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState<string>('');
  const [searchTag, setSearchTag] = useState<string>('');
  const [filterModelTypes, setFilterModelTypes] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagsByModelType, setTagsByModelType] = useState<Record<string, string[]>>({});
  const [hoveredModelType, setHoveredModelType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterConnection, setFilterConnection] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalModels, setTotalModels] = useState<number>(0);
  
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<LLMCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  
  const [tags, setTags] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showEditTagInput, setShowEditTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newEditTag, setNewEditTag] = useState('');
  const [hasTestedConnection, setHasTestedConnection] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<number>(-1);
  const [hasTestedEditConnection, setHasTestedEditConnection] = useState(false);
  const [testingEditConnection, setTestingEditConnection] = useState(false);
  const [editConnectionStatus, setEditConnectionStatus] = useState<number>(-1);
  const [originalEditModel, setOriginalEditModel] = useState<any>(null);
  
  const cardRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const tagInputRef = useRef<HTMLInputElement>(null);
  const editTagInputRef = useRef<HTMLInputElement>(null);

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
    fetchModelTypes();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchModels(selectedCategory, 1, pageSize);
  }, [selectedCategory, searchName, searchTag, filterModelTypes, filterTags, filterStatus, filterConnection]);

  useEffect(() => {
    fetchModels(selectedCategory, currentPage, pageSize);
  }, [currentPage, pageSize]);

  const getAllCategoryKeys = (categories: LLMCategory[]): string[] => {
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
      const data = await llmModelService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchModelTypes = async () => {
    try {
      const data = await llmModelService.getModelTypes();
      setModelTypes(data);
      // 默认全部不选中
      setFilterModelTypes([]);
      
      // 获取每个模型类型的标签
      await fetchModelTags(Object.keys(data));
    } catch (error) {
      console.error('Failed to fetch model types:', error);
    }
  };
  
  const fetchModelTags = async (modelTypeKeys?: string[]) => {
    try {
      const modelTypeTags: Record<string, string[]> = {};
      const keys = modelTypeKeys || Object.keys(modelTypes);
      for (const key of keys) {
        try {
          const tags = await llmModelService.getModelTags(key);
          modelTypeTags[key] = tags;
        } catch (error) {
          console.error(`Failed to fetch tags for model type ${key}:`, error);
          modelTypeTags[key] = [];
        }
      }
      setTagsByModelType(modelTypeTags);
    } catch (error) {
      console.error('Failed to fetch model tags:', error);
    }
  };

  const fetchModels = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      // 使用后端过滤功能
      const data = await llmModelService.getLLMModels(
        page !== undefined ? page : currentPage,
        size !== undefined ? size : pageSize,
        categoryId || undefined,
        searchName || undefined,
        filterModelTypes.length > 0 ? filterModelTypes.join(',') : undefined,
        filterStatus || undefined,
        (searchTag || filterTags.length > 0) ? [...new Set([...filterTags, searchTag].filter(Boolean))].join(',') : undefined,
        filterConnection || undefined
      );
      
      // 确保标签数据已经从后端获取
      if (Object.keys(tagsByModelType).length === 0) {
        await fetchModelTags();
      }
      
      // 收集所有标签，并按模型类型分组
      const tagsSet = new Set<string>();
      const modelTypeTags: Record<string, Set<string>> = {};
      
      data.data.forEach((model: LLMModel) => {
        const modelTags = parseTags(model.tags);
        modelTags.forEach(tag => tagsSet.add(tag));
        
        // 按模型类型分组标签
        if (!modelTypeTags[model.model_type]) {
          modelTypeTags[model.model_type] = new Set<string>();
        }
        modelTags.forEach(tag => modelTypeTags[model.model_type].add(tag));
      });
      
      setAllTags(Array.from(tagsSet));
      
      setModels(data.data);
      setTotalModels(data.total);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setModels([]);
      setTotalModels(0);
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

  const handleEditCategory = (category: LLMCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  const flattenAllCategories = (cats: LLMCategory[]): LLMCategory[] => {
    let result: LLMCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: LLMCategory, direction: 'up' | 'down') => {
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

      await llmModelService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await llmModelService.updateCategory(targetCategory.id, { sort_order: category.sort_order });
      
      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: LLMCategory) => {
    try {
      await llmModelService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await llmModelService.createCategory(values);
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
      await llmModelService.updateCategory(editingCategory.id, values);
      message.success('分类更新成功！');
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };

    const buildCategoryNode = (category: LLMCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          {!category.is_default && (
            <div className="category-actions">
              <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
              <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
              <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
              <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteCategory(category); }} okText="确认" cancelText="取消">
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
    const buildNode = (category: LLMCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildNode(child)) : undefined,
    });
    return categories.map(category => buildNode(category));
  };

  const getModelTypeLabel = (modelType?: string): string => {
    return modelTypes[modelType || 'text'] || modelType || '文本模型';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const parseTags = (tagsStr?: string): string[] => {
    if (!tagsStr) return [];
    try {
      const parsed = JSON.parse(tagsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleAddModel = () => {
    form.resetFields();
    setTags([]);
    setShowTagInput(false);
    setNewTag('');
    setHasTestedConnection(false);
    form.setFieldsValue({ status: true, model_type: 'text' });
    setIsModalVisible(true);
  };

  const handleEditModel = (model: LLMModel) => {
    setEditingModelId(model.id);
    const modelTags = parseTags(model.tags);
    setEditTags(modelTags);
    setShowEditTagInput(false);
    setNewEditTag('');
    setHasTestedEditConnection(false);
    setOriginalEditModel({
      name: model.name,
      endpoint: model.endpoint,
      api_key: model.api_key,
      model_type: model.model_type
    });
    editForm.setFieldsValue({
      name: model.name,
      model_type: model.model_type,
      category_id: model.category_id,
      status: model.status,
      is_default: model.is_default,
      endpoint: model.endpoint,
      api_key: model.api_key
    });
    setIsEditModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      let supportImage = false;
      
      if (!hasTestedConnection) {
        const testData = {
          name: values.name,
          provider: getProviderFromModelName(values.name),
          endpoint: values.endpoint,
          api_key: values.api_key,
          model_type: values.model_type
        };
        
        setTestingConnection(true);
        const key = `test-new-model`;
        message.loading({ content: `正在测试连接...`, key, duration: 0 });
        
        try {
          const result = await llmModelService.testModelConfig(testData);
          setTestingConnection(false);
          
          if (!result.success) {
            message.error({ content: `连接测试失败: ${result.message}`, key });
            setConnectionStatus(0);
            return;
          }
          
          message.success({ content: `连接测试成功！`, key });
          supportImage = result.support_image || false;
          setConnectionStatus(1);
        } catch (error: any) {
          setTestingConnection(false);
          message.error({ content: `测试失败: ${error.message}`, key });
          setConnectionStatus(0);
          return;
        }
      }
      
      const provider = getProviderFromModelName(values.name);
      
      const updatedTags = [...tags];
      if (provider && !updatedTags.includes(provider)) {
        updatedTags.push(provider);
      }
      if (supportImage && !updatedTags.includes('图片支持')) {
        updatedTags.push('图片支持');
      }
      
      const submitData = {
        name: values.name,
        provider: provider,
        model_type: values.model_type,
        category_id: values.category_id,
        status: values.status,
        is_default: values.is_default,
        endpoint: values.endpoint,
        api_key: values.api_key,
        tags: JSON.stringify(updatedTags),
        config: '{}',
        support_image: supportImage,
        connection_status: connectionStatus
      };
      
      await llmModelService.createLLMModel(submitData);
      message.success('LLM模型创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setTags([]);
      setHasTestedConnection(false);
      fetchModels(selectedCategory, currentPage, pageSize);
      await fetchModelTags();
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingModelId) return;
    try {
      const values = await editForm.validateFields();
      
      const hasParamsChanged = originalEditModel && (
        originalEditModel.name !== values.name ||
        originalEditModel.endpoint !== values.endpoint ||
        originalEditModel.api_key !== values.api_key ||
        originalEditModel.model_type !== values.model_type
      );
      
      let supportImage = false;
      
      if (hasParamsChanged && !hasTestedEditConnection) {
        const testData = {
          name: values.name,
          provider: getProviderFromModelName(values.name),
          endpoint: values.endpoint,
          api_key: values.api_key,
          model_type: values.model_type
        };
        
        setTestingEditConnection(true);
        const key = `test-edit-model-${editingModelId}`;
        message.loading({ content: `正在测试连接...`, key, duration: 0 });
        
        try {
          const result = await llmModelService.testModelConfig(testData);
          
          setTestingEditConnection(false);
          
          if (result.success) {
            message.success({ content: `连接测试成功！`, key });
            supportImage = result.support_image || false;
            setEditConnectionStatus(1);
          } else {
            message.error({ content: `连接测试失败: ${result.message}`, key });
            setEditConnectionStatus(0);
            return;
          }
        } catch (error: any) {
          setTestingEditConnection(false);
          message.error({ content: `测试失败: ${error.message}`, key });
          setEditConnectionStatus(0);
          return;
        }
      }
      
      const provider = getProviderFromModelName(values.name);
      
      const updatedTags = [...editTags];
      if (provider && !updatedTags.includes(provider)) {
        updatedTags.push(provider);
      }
      if (supportImage && !updatedTags.includes('图片支持')) {
        updatedTags.push('图片支持');
      }
      
      const submitData: any = {
        name: values.name,
        provider: provider,
        model_type: values.model_type,
        category_id: values.category_id,
        status: values.status,
        is_default: values.is_default,
        endpoint: values.endpoint,
        api_key: values.api_key,
        tags: JSON.stringify(updatedTags),
        config: '{}'
      };
      
      if (hasParamsChanged) {
        submitData.support_image = supportImage;
      }
      
      if (editConnectionStatus !== -1) {
        submitData.connection_status = editConnectionStatus;
      }
      
      await llmModelService.updateLLMModel(editingModelId, submitData);
      message.success('LLM模型更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setEditTags([]);
      setEditingModelId(null);
      setHasTestedEditConnection(false);
      setOriginalEditModel(null);
      fetchModels(selectedCategory, currentPage, pageSize);
      await fetchModelTags();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    try {
      await llmModelService.deleteLLMModel(modelId);
      message.success('LLM模型删除成功！');
      if (models.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchModels(selectedCategory, currentPage, pageSize);
      }
      // 更新模型标签
      await fetchModelTags();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleCardMouseMove = (modelId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRefs.current[modelId];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleTestConnection = async (model: LLMModel) => {
    const key = `test-${model.id}`;
    message.loading({ content: `正在测试 ${model.name} 连接...`, key, duration: 0 });
    try {
      const result = await llmModelService.testConnection(model.id);
      if (result.success) {
        message.success({ content: `${model.name} 连接测试成功！`, key });
      } else {
        message.error({ content: `${model.name} 连接测试失败: ${result.message}`, key });
      }
    } catch (error: any) {
      message.error({ content: `${model.name} 连接测试失败: ${error.message}`, key });
    }
  };

  const handleCardClick = (modelId: string) => {
    navigate(`/llm_model/setting/${modelId}`);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleAddEditTag = () => {
    if (newEditTag.trim() && !editTags.includes(newEditTag.trim())) {
      setEditTags([...editTags, newEditTag.trim()]);
      setNewEditTag('');
    }
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`} style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontWeight: '600', fontSize: '16px', color: theme === 'dark' ? '#ffffff' : '#000000' }}>模型管理</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddModel} style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', fontWeight: '500' }}>
          新增模型
        </Button>
      </div>
          
          <div style={{ 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#ffffff', 
            borderRadius: '12px', 
            padding: '16px 20px',
            marginBottom: '16px',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '500', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)', whiteSpace: 'nowrap' }}>模型类型:</span>
              <Button
                type={filterModelTypes.length === 0 ? 'primary' : 'default'}
                onClick={() => {
                  setFilterModelTypes([]);
                  setFilterTags([]);
                }}
                style={{
                  borderRadius: '20px',
                  padding: '6px 16px',
                  height: '32px',
                  fontWeight: '500',
                  background: filterModelTypes.length === 0 
                    ? 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)' 
                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5'),
                  border: 'none',
                  color: filterModelTypes.length === 0 ? '#ffffff' : (theme === 'dark' ? '#ffffff' : '#000000')
                }}
              >
                全部
              </Button>
              {Object.entries(modelTypes).map(([key, value]) => {
                const hasTags = tagsByModelType[key] && tagsByModelType[key].length > 0;
                return hasTags ? (
                  <Tooltip
                    key={key}
                    title={
                      <div style={{ 
                        padding: '8px',
                        borderRadius: '4px',
                        color: theme === 'dark' ? '#ffffff' : '#000000'
                      }}>
                        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>标签</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {tagsByModelType[key].map(tag => {
                            const isSelected = filterTags.includes(tag);
                            return (
                              <Tag
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentTags = tagsByModelType[key] || [];
                                  let newFilterTags: string[];
                                  if (filterTags.includes(tag)) {
                                    newFilterTags = filterTags.filter(t => t !== tag);
                                  } else {
                                    newFilterTags = [...filterTags, tag];
                                  }
                                  setFilterTags(newFilterTags);
                                  const allTagsSelected = currentTags.every(t => newFilterTags.includes(t));
                                  if (allTagsSelected && !filterModelTypes.includes(key)) {
                                    setFilterModelTypes([...filterModelTypes, key]);
                                  }
                                }}
                                style={{
                                  cursor: 'pointer',
                                  background: isSelected
                                    ? 'var(--primary-color)'
                                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)'),
                                  color: isSelected
                                    ? '#ffffff'
                                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.65)'),
                                  borderRadius: '4px',
                                  border: isSelected
                                    ? '1px solid var(--primary-color)'
                                    : (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)'),
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {tag}
                              </Tag>
                            );
                          })}
                        </div>
                      </div>
                    }
                    placement="bottom"
                  >
                    <Button
                      key={key}
                      onClick={() => {
                        const currentTags = tagsByModelType[key] || [];
                        if (filterModelTypes.includes(key)) {
                          setFilterModelTypes(filterModelTypes.filter(type => type !== key));
                          setFilterTags(filterTags.filter(t => !currentTags.includes(t)));
                        } else {
                          setFilterModelTypes([...filterModelTypes, key]);
                        }
                      }}
                      style={{
                        borderRadius: '20px',
                        padding: '6px 16px',
                        height: '32px',
                        fontWeight: '400',
                        background: filterModelTypes.includes(key) 
                          ? 'rgba(22, 119, 255, 0.12)'
                          : (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5'),
                        border: filterModelTypes.includes(key) ? '1px solid #1677ff' : 'none',
                        color: filterModelTypes.includes(key) ? '#1677ff' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)')
                      }}
                    >
                      {value}
                    </Button>
                  </Tooltip>
                ) : (
                  <Button
                    key={key}
                    onClick={() => {
                      if (filterModelTypes.includes(key)) {
                        setFilterModelTypes(filterModelTypes.filter(type => type !== key));
                      } else {
                        setFilterModelTypes([...filterModelTypes, key]);
                      }
                    }}
                    style={{
                      borderRadius: '20px',
                      padding: '6px 16px',
                      height: '32px',
                      fontWeight: '400',
                      background: filterModelTypes.includes(key) 
                        ? 'rgba(22, 119, 255, 0.12)'
                        : (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5'),
                      border: filterModelTypes.includes(key) ? '1px solid #1677ff' : 'none',
                      color: filterModelTypes.includes(key) ? '#1677ff' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)')
                    }}
                  >
                    {value}
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <Input
              placeholder="搜索模型名称..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              prefix={<SearchOutlined />}
              onPressEnter={() => fetchModels(selectedCategory, 1, pageSize)}
              style={{ width: '300px', height: '36px', borderRadius: '8px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9' }}
            />
            <Button type="primary" onClick={() => fetchModels(selectedCategory, 1, pageSize)} style={{ borderRadius: '8px' }}>
              <SearchOutlined />
            </Button>
            <span style={{ fontWeight: '500', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)', whiteSpace: 'nowrap', marginRight: '8px', lineHeight: '36px' }}>模型状态:</span>
            <Select
              placeholder="全部状态"
              value={filterStatus}
              onChange={setFilterStatus}
              style={{
                width: '120px',
                borderRadius: '8px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                height: '36px'
              }}
            >
              <Option value="">全部状态</Option>
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
            <span style={{ fontWeight: '500', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)', whiteSpace: 'nowrap', marginRight: '8px', lineHeight: '36px', marginLeft: '16px' }}>连接状态:</span>
            <Select
              placeholder="连接状态"
              value={filterConnection}
              onChange={setFilterConnection}
              style={{
                width: '120px',
                borderRadius: '8px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                height: '36px'
              }}
            >
              <Option value="">全部</Option>
              <Option value="-1">待测试</Option>
              <Option value="0">连接失败</Option>
              <Option value="1">连接成功</Option>
            </Select>
          </div>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            marginBottom: '0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }} className="hide-scrollbar">
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {loading ? (
              <div className="loading-container"><Spin size="large" /></div>
            ) : models.length === 0 ? (
              <Empty description="暂无LLM模型" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
            ) : (
              <Row gutter={[16, 16]}>
                {models.map((model, index) => (
                  <Col key={model.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                    <div ref={(el) => { if (el) cardRefs.current[model.id] = el; }} onMouseMove={(e) => handleCardMouseMove(model.id, e)}>
                      <Card 
                        className={`llm-model-card ${theme === 'dark' ? 'dark' : 'light'}`} 
                        data-card-type="model"
                        style={{ 
                          background: theme === 'dark' ? '#1a1a2e' : '#fff',
                          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #f0f0f0',
                          borderRadius: '16px',
                          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)'
                        }}
                        bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column' ,height:262}}
                        onClick={() => handleCardClick(model.id)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          {/* 顶部区域：图片+信息 | 状态 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            {/* 左上：图片 + 模型名称 + 类型 */}
                            <div style={{ display: 'flex', gap: '16px' }}>
                              <img 
                                src={getProviderAvatar(model.provider || '')} 
                                alt={model.provider} 
                                style={{ 
                                  width: '52px', 
                                  height: '52px', 
                                  borderRadius: '14px',
                                  objectFit: 'cover'
                                }} 
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ 
                                  fontWeight: '600', 
                                  fontSize: '17px',
                                  color: theme === 'dark' ? '#ffffff' : '#1f2329'
                                }}>
                                  {model.name}
                                </div>
                                <div style={{ 
                                  fontSize: '13px',
                                  color: theme === 'dark' ? 'rgba(255, 255, 255, 0.55)' : '#8f959e'
                                }}>
                                  {getModelTypeLabel(model.model_type)}
                                </div>
                              </div>
                            </div>
                            {/* 右上：状态标签 */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                              <Tag 
                                icon={model.status ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
                                color={model.status ? 'success' : 'error'}
                                style={{ marginBottom: 0, borderRadius: '4px', background: model.status ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.15)' : undefined) : (theme === 'dark' ? 'rgba(255, 77, 79, 0.15)' : undefined), borderColor: model.status ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.3)' : undefined) : (theme === 'dark' ? 'rgba(255, 77, 79, 0.3)' : undefined) }}
                              >
                                {model.status ? '已启用' : '已禁用'}
                              </Tag>
                              <Tag 
                                color={model.connection_status === 1 ? 'success' : model.connection_status === 0 ? 'error' : 'default'}
                                style={{ marginBottom: 0, borderRadius: '4px', fontSize: '12px', background: model.connection_status === 1 ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.15)' : undefined) : model.connection_status === 0 ? (theme === 'dark' ? 'rgba(255, 77, 79, 0.15)' : undefined) : (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : undefined), borderColor: model.connection_status === 1 ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.3)' : undefined) : model.connection_status === 0 ? (theme === 'dark' ? 'rgba(255, 77, 79, 0.3)' : undefined) : (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : undefined) }}
                              >
                                {model.connection_status === 1 ? '连接成功' : model.connection_status === 0 ? '连接失败' : '待测试'}
                              </Tag>
                            </div>
                          </div>
                          
                          {/* 中间区域：标签 */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                            {parseTags(model.tags).slice(0, 3).map((tag, idx) => (
                              <Tag key={idx} style={{ marginBottom: 0, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', fontWeight: '500', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)' }}>
                                {tag}
                              </Tag>
                            ))}
                            {parseTags(model.tags).length > 3 && (
                              <Tag style={{ marginBottom: 0, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', fontWeight: '500', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)' }}>
                                +{parseTags(model.tags).length - 3}
                              </Tag>
                            )}
                          </div>
                          
                          {/* 底部区域：时间 + 操作按钮 */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            marginTop: 'auto',
                            borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #f0f0f0',
                            paddingTop: '16px'
                          }}>
                            <div style={{ 
                              fontSize: '12px',
                              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                              marginBottom: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <ClockCircleOutlined />
                              最近更新: {formatDate(model.created_at)}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleTestConnection(model); }} 
                                style={{ 
                                  flex: 1, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  gap: '6px',
                                  padding: '10px 16px',
                                  border: 'none',
                                  borderRadius: '10px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  background: 'rgba(90, 111, 214, 0.08)',
                                  color: '#5a6fd6',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <ApiTwoTone />
                                测试连接
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditModel(model); }} 
                                style={{ 
                                  flex: 1, 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  gap: '6px',
                                  padding: '10px 16px',
                                  border: 'none',
                                  borderRadius: '10px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  background: 'rgba(46, 164, 79, 0.08)',
                                  color: '#2ea44f',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <EditOutlined />
                                编辑
                              </button>
                              <Popconfirm title="确认删除" description="确定要删除这个模型吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteModel(model.id); }} okText="确认" cancelText="取消">
                                <button 
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ 
                                    flex: 1, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    gap: '6px',
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    background: 'rgba(255, 102, 102, 0.08)',
                                    color: '#ff6666',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <DeleteOutlined />
                                  删除
                                </button>
                              </Popconfirm>
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
          
          {totalModels > 0 && (
            <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={totalModels}
                onChange={(page) => {
                  setCurrentPage(page);
                  fetchModels(selectedCategory, page, pageSize);
                }}
                onShowSizeChange={(current, size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                  fetchModels(selectedCategory, 1, size);
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
          )}

      {/* 新增模型模态框 */}
      <Modal 
        title="新增LLM模型" 
        open={isModalVisible} 
        onCancel={() => setIsModalVisible(false)} 
        width={700} 
        footer={null}
        className={`llm-model-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={form} layout="vertical" initialValues={{ status: true, model_type: 'text', is_default: false }}>
          {/* 基本信息 */}
          <div style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f5f5f5', padding: '8px 12px', marginBottom: '16px', borderRadius: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}>基本信息</span>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
                <Input placeholder="请输入模型名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model_type" label="模型类型" rules={[{ required: true, message: '请选择模型类型' }]}>
                <Select placeholder="请选择模型类型">
                  {Object.entries(modelTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="标签">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.map((tag, index) => (
                      <Tag
                        key={index}
                        closable
                        onClose={() => {
                          const newTags = tags.filter((_, i) => i !== index);
                          setTags(newTags);
                        }}
                        style={{ marginBottom: 4 }}
                      >
                        {tag}
                      </Tag>
                    ))}
                    {showTagInput ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Input
                          ref={tagInputRef}
                          type="text"
                          size="small"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="输入标签"
                          style={{ width: 120, height: 24 }}
                        />
                        <Button size="small" onClick={handleAddTag} style={{ height: 24 }}>添加</Button>
                        <Button size="small" onClick={() => setShowTagInput(false)} style={{ height: 24 }}>取消</Button>
                      </div>
                    ) : (
                      <Button 
                        type="dashed" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                          setShowTagInput(true);
                          setTimeout(() => tagInputRef.current?.focus(), 100);
                        }}
                        style={{ borderStyle: 'dashed', height: 24, minWidth: 80 }}
                      >
                        添加标签
                      </Button>
                    )}
                  </div>
                </div>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>状态</span>
                  <Tooltip title="测试连接失败，则自动转为禁用状态">
                    <InfoCircleOutlined style={{ fontSize: 14, color: '#999' }} />
                  </Tooltip>
                </div>
              } valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_default" label="是否默认" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          {/* 连接参数 */}
          <div style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f5f5f5', padding: '8px 12px', marginBottom: '16px', borderRadius: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}>连接参数</span>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="endpoint" label="端点地址" rules={[{ required: true, message: '请输入端点地址' }]}>
                <Input placeholder="请输入端点地址" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="api_key" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
                <Input.Password placeholder="请输入API密钥" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px', 
          borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <Button onClick={() => setIsModalVisible(false)}>
            取消
          </Button>
          <Button 
            icon={<ApiTwoTone />}
            loading={testingConnection}
            onClick={async () => {
              try {
                const values = await form.validateFields();
                const testData = {
                  name: values.name,
                  provider: getProviderFromModelName(values.name),
                  endpoint: values.endpoint,
                  api_key: values.api_key,
                  model_type: values.model_type
                };
                
                setTestingConnection(true);
                const key = `test-new-model`;
                message.loading({ content: `正在测试连接...`, key, duration: 0 });
                
                const result = await llmModelService.testModelConfig(testData);
                
                setTestingConnection(false);
                
                if (result.success) {
                  message.success({ content: `连接测试成功！`, key });
                  setHasTestedConnection(true);
                  setConnectionStatus(1);
                } else {
                  message.error({ content: `连接测试失败: ${result.message}`, key });
                  setHasTestedConnection(false);
                  setConnectionStatus(0);
                  form.setFieldValue('status', false);
                }
              } catch (error: any) {
                setTestingConnection(false);
                message.error({ content: `测试失败: ${error.message}`, key: 'test-new-model' });
                setHasTestedConnection(false);
                setConnectionStatus(0);
                form.setFieldValue('status', false);
              }
            }}
          >
            测试连接
          </Button>
          <Button
            type="primary"
            loading={testingConnection}
            onClick={async () => {
              // 如果已经测试过连接，直接提交
              if (hasTestedConnection) {
                handleSubmit();
                return;
              }
              try {
                const values = await form.validateFields();
                const testData = {
                  name: values.name,
                  provider: getProviderFromModelName(values.name),
                  endpoint: values.endpoint,
                  api_key: values.api_key,
                  model_type: values.model_type
                };

                setTestingConnection(true);
                const key = `submit-new-model`;
                message.loading({ content: `正在测试连接...`, key, duration: 0 });

                const result = await llmModelService.testModelConfig(testData);

                setTestingConnection(false);

                if (result.success) {
                  message.success({ content: `连接测试成功！`, key });
                  setConnectionStatus(1);
                  handleSubmit();
                } else {
                  message.error({ content: `连接测试失败: ${result.message}`, key });
                  setConnectionStatus(0);
                  form.setFieldValue('status', false);
                }
              } catch (error: any) {
                setTestingConnection(false);
                message.error({ content: `测试失败: ${error.message}`, key: 'submit-new-model' });
                setConnectionStatus(0);
                form.setFieldValue('status', false);
              }
            }}
          >
            确定
          </Button>
        </div>
      </Modal>

      {/* 编辑模型模态框 */}
      <Modal 
        title="编辑LLM模型" 
        open={isEditModalVisible} 
        onCancel={() => setIsEditModalVisible(false)} 
        width={700} 
        footer={null}
        className={`llm-model-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={editForm} layout="vertical">
          {/* 基本信息 */}
          <div style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f5f5f5', padding: '8px 12px', marginBottom: '16px', borderRadius: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}>基本信息</span>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
                <Input placeholder="请输入模型名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model_type" label="模型类型" rules={[{ required: true, message: '请选择模型类型' }]}>
                <Select placeholder="请选择模型类型">
                  {Object.entries(modelTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="标签">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {editTags.map((tag, index) => (
                      <Tag
                        key={index}
                        closable
                        onClose={() => {
                          const newTags = editTags.filter((_, i) => i !== index);
                          setEditTags(newTags);
                        }}
                        style={{ marginBottom: 4 }}
                      >
                        {tag}
                      </Tag>
                    ))}
                    {showEditTagInput ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Input
                          ref={editTagInputRef}
                          type="text"
                          size="small"
                          value={newEditTag}
                          onChange={(e) => setNewEditTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddEditTag()}
                          placeholder="输入标签"
                          style={{ width: 120, height: 24 }}
                        />
                        <Button size="small" onClick={handleAddEditTag} style={{ height: 24 }}>添加</Button>
                        <Button size="small" onClick={() => setShowEditTagInput(false)} style={{ height: 24 }}>取消</Button>
                      </div>
                    ) : (
                      <Button 
                        type="dashed" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                          setShowEditTagInput(true);
                          setTimeout(() => editTagInputRef.current?.focus(), 100);
                        }}
                        style={{ borderStyle: 'dashed', height: 24, minWidth: 80 }}
                      >
                        添加标签
                      </Button>
                    )}
                  </div>
                </div>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>状态</span>
                  <Tooltip title="测试连接失败，则自动转为禁用状态">
                    <InfoCircleOutlined style={{ fontSize: 14, color: '#999' }} />
                  </Tooltip>
                </div>
              } valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_default" label="是否默认" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
          </Row>

          {/* 连接参数 */}
          <div style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f5f5f5', padding: '8px 12px', marginBottom: '16px', borderRadius: '4px' }}>
            <span style={{ fontWeight: '500', fontSize: '14px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}>连接参数</span>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="endpoint" label="端点地址" rules={[{ required: true, message: '请输入端点地址' }]}>
                <Input placeholder="请输入端点地址" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="api_key" label="API密钥" rules={[{ required: true, message: '请输入API密钥' }]}>
                <Input.Password placeholder="请输入API密钥" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px', 
          borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <Button onClick={() => setIsEditModalVisible(false)}>
            取消
          </Button>
          <Button
            icon={<ApiTwoTone />}
            onClick={async () => {
              try {
                const values = await editForm.validateFields();

                if (editingModelId) {
                  const key = `test-edit-model-${editingModelId}`;
                  message.loading({ content: `正在测试连接...`, key, duration: 0 });

                  const testData = {
                    name: values.name,
                    provider: getProviderFromModelName(values.name),
                    endpoint: values.endpoint,
                    api_key: values.api_key,
                    model_type: values.model_type
                  };

                  const result = await llmModelService.testModelConfig(testData);

                  if (result.success) {
                    message.success({ content: `连接测试成功！`, key });
                    setEditConnectionStatus(1);
                    setHasTestedEditConnection(true);
                  } else {
                    message.error({ content: `连接测试失败: ${result.message}`, key });
                    setEditConnectionStatus(0);
                    setHasTestedEditConnection(false);
                    editForm.setFieldValue('status', false);
                  }
                }
              } catch (error: any) {
                message.error({ content: `测试失败: ${error.message}`, key: `test-edit-model-${editingModelId}` });
                setEditConnectionStatus(0);
                setHasTestedEditConnection(false);
                editForm.setFieldValue('status', false);
              }
            }}
          >
            测试连接
          </Button>
          <Button
            type="primary"
            onClick={async () => {
              // 如果已经测试过连接，直接提交
              if (hasTestedEditConnection) {
                handleEditSubmit();
                return;
              }
              try {
                const values = await editForm.validateFields();

                if (editingModelId) {
                  const key = `submit-edit-model-${editingModelId}`;
                  message.loading({ content: `正在测试连接...`, key, duration: 0 });

                  const testData = {
                    name: values.name,
                    provider: getProviderFromModelName(values.name),
                    endpoint: values.endpoint,
                    api_key: values.api_key,
                    model_type: values.model_type
                  };

                  const result = await llmModelService.testModelConfig(testData);

                  if (result.success) {
                    message.success({ content: `连接测试成功！`, key });
                    setEditConnectionStatus(1);
                    handleEditSubmit();
                  } else {
                    message.error({ content: `连接测试失败: ${result.message}`, key });
                    setEditConnectionStatus(0);
                    editForm.setFieldValue('status', false);
                  }
                }
              } catch (error: any) {
                message.error({ content: `测试失败: ${error.message}`, key: `submit-edit-model-${editingModelId}` });
                setEditConnectionStatus(0);
                editForm.setFieldValue('status', false);
              }
            }}
          >
            确定
          </Button>
        </div>
      </Modal>

      {/* 新增分类模态框 */}
      <Modal title="新增分类" open={isCategoryModalVisible} onOk={handleCategorySubmit} onCancel={() => setIsCategoryModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`llm-model-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <Input.TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" initialValue={1} rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分类模态框 */}
      <Modal title="编辑分类" open={isCategoryEditModalVisible} onOk={handleCategoryEditSubmit} onCancel={() => setIsCategoryEditModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`llm-model-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <Input.TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LLMModelManagement;