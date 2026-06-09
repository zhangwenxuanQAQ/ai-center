import React, { useState, useRef } from 'react';
import { Modal, Steps, Button, message, Form } from 'antd';
import { knowledgebaseService } from '../../services/knowledgebase';
import StepBasicInfo from './folder_modal/StepBasicInfo';
import StepKnowledgeModel, { StepKnowledgeModelRef } from './folder_modal/StepKnowledgeModel';
import StepOtherConfig from './folder_modal/StepOtherConfig';
import { DynamicTableRow } from '../../components/DynamicTable';
import { Chapter } from './folder_modal/AddChapterModal';

interface KnowledgebaseDocumentFolderModalProps {
  visible: boolean;
  knowledgebaseId: string;
  categories: any[];
  onCancel: () => void;
  onSuccess: () => void;
  editData?: any;
}

const { Step } = Steps;

const KnowledgebaseDocumentFolderModal: React.FC<KnowledgebaseDocumentFolderModalProps> = ({
  visible,
  knowledgebaseId,
  categories,
  onCancel,
  onSuccess,
  editData,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 基本信息状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState(1);

  // 第二步知识模型状态
  const [knowledgeTags, setKnowledgeTags] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('file');
  const [customFields, setCustomFields] = useState<DynamicTableRow[]>([]);
  const [hasKnowledgeContent, setHasKnowledgeContent] = useState(false);
  const [chapterType, setChapterType] = useState<string>('fixed');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [editingRequirements, setEditingRequirements] = useState('');
  const [knowledgeTemplates, setKnowledgeTemplates] = useState<Array<{
    key: string;
    title: string;
    description: string;
    icon: string;
  }>>([]);

  const stepKnowledgeModelRef = useRef<StepKnowledgeModelRef>(null);

  // 第三步其他配置状态
  const [chunkMethod, setChunkMethod] = useState('');
  const [chunkConfig, setChunkConfig] = useState<Record<string, unknown>>({});
  const [documentConstants, setDocumentConstants] = useState<any>(null);
  const [availableChunkMethods, setAvailableChunkMethods] = useState<Array<{ key: string; label: string; is_default: boolean }>>([]);
  const [prevSelectedTemplate, setPrevSelectedTemplate] = useState<string | null>(null);

  const steps = [
    { title: '基本信息' },
    { title: '知识模型' },
    { title: '其它配置' },
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!name || !name.trim()) {
          message.error('请输入分类名称');
          return false;
        }
        if (!sortOrder || sortOrder < 1) {
          message.error('排序顺序必须大于等于1');
          return false;
        }
        return true;
      case 1:
        if (!selectedTemplate) {
          message.error('请选择知识模版');
          return false;
        }
        // 只有自定义模板才需要验证基础属性
        if (selectedTemplate === 'custom_template' && (!customFields || customFields.length === 0)) {
          message.error('请添加自定义字段');
          return false;
        }
        // 校验基础属性的字段中文名和编码是否填写
        if (selectedTemplate === 'custom_template') {
          // 直接验证 customFields 数据，而不是通过 ref
          const isValid = customFields.every(field => 
            field.field_name && field.field_name.trim() && 
            field.field_code && field.field_code.trim()
          );
          if (!isValid) {
            message.error('请填写基础属性的字段中文名和编码');
            return false;
          }
        }
        // 只有自定义模板才需要验证知识正文配置
        if (selectedTemplate === 'custom_template' && hasKnowledgeContent && chapterType === 'fixed' && (!chapters || chapters.length === 0)) {
          message.error('请添加章节');
          return false;
        }
        return true;
      case 2:
        // 其他配置步骤不需要验证
        return true;
      default:
        return true;
    }
  };

  const handleOk = async () => {
    // 保存时，验证所有步骤
    try {
      for (let i = 0; i < steps.length; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);  // 跳转到验证失败的步骤
          return;
        }
      }

      // 校验基础属性字段中文名和编码是否重复
      if (selectedTemplate === 'custom_template' && customFields && customFields.length > 0) {
        const fieldNames = customFields.map(f => f.field_name).filter(name => name);
        const fieldCodes = customFields.map(f => f.field_code).filter(code => code);
        
        // 检查中文名重复
        const duplicateNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        if (duplicateNames.length > 0) {
          message.error(`基础属性字段中文名重复：${[...new Set(duplicateNames)].join('、')}`);
          return;
        }
        
        // 检查编码重复
        const duplicateCodes = fieldCodes.filter((code, index) => fieldCodes.indexOf(code) !== index);
        if (duplicateCodes.length > 0) {
          message.error(`基础属性字段编码重复：${[...new Set(duplicateCodes)].join('、')}`);
          return;
        }
        
        // 检查编码格式：只能包含字母、数字、下划线，且必须以字母或下划线开头
        const fieldCodePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        const invalidCodes = customFields.filter(f => f.field_code && !fieldCodePattern.test(f.field_code));
        if (invalidCodes.length > 0) {
          const invalidCodeNames = invalidCodes.map(f => f.field_code).join('、');
          message.error(`字段编码只能包含字母、数字、下划线，且必须以字母或下划线开头，以下编码格式错误：${invalidCodeNames}`);
          return;
        }
      }

      // 校验章节目录字段的编码格式
      if (selectedTemplate === 'custom_template' && hasKnowledgeContent && chapterType === 'fixed' && chapters && chapters.length > 0) {
        const fieldCodePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        
        // 递归检查所有章节的字段
        const checkChapterFields = (chapterList: Chapter[]): boolean => {
          for (const chapter of chapterList) {
            if (chapter.fields && chapter.fields.length > 0) {
              for (const field of chapter.fields) {
                if (field.field_code && !fieldCodePattern.test(field.field_code)) {
                  message.error(`章节"${chapter.name}"中的字段编码"${field.field_code}"格式错误，只能包含字母、数字、下划线，且必须以字母或下划线开头`);
                  return false;
                }
              }
            }
            // 递归检查子章节
            const childChapters = chapters.filter(ch => ch.parentId === chapter.id);
            if (childChapters.length > 0) {
              if (!checkChapterFields(childChapters)) {
                return false;
              }
            }
          }
          return true;
        };

        // 获取根章节
        const rootChapters = chapters.filter(ch => !ch.parentId);
        if (!checkChapterFields(rootChapters)) {
          return;
        }
      }

      setLoading(true);

      // 构建知识模型配置
      const documentConfig = {
        tags: knowledgeTags,
        template_type: selectedTemplate,
        custom_fields: selectedTemplate === 'custom_template' ? customFields : undefined,
        has_knowledge_content: hasKnowledgeContent,
        chapter_type: hasKnowledgeContent ? chapterType : undefined,
        chapters: hasKnowledgeContent && chapterType === 'fixed' ? chapters : undefined,
        editing_requirements: editingRequirements || undefined,
      };

      // 构建切片配置
      const finalChunkConfig = { ...chunkConfig };

      // 构建最终数据，确保基本信息字段与其他配置字段平级
      const createData: any = {
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId || null,
        sort_order: sortOrder >= 1 ? sortOrder : 1,
      };

      // 只在有数据时添加额外字段
      if (knowledgeTags.length > 0 || selectedTemplate) {
        createData.document_config = documentConfig;
      }
      if (chunkMethod) {
        createData.chunk_method = chunkMethod;
      }
      if (Object.keys(finalChunkConfig).length > 0) {
        createData.chunk_config = finalChunkConfig;
      }

      console.log('Create data:', createData);
      
      if (editingId) {
        // 编辑模式：调用更新接口
        const response = await knowledgebaseService.updateDocumentCategory(knowledgebaseId, editingId, createData);
        console.log('Response:', response);
        message.success('目录更新成功');
      } else {
        // 新增模式：调用创建接口
        const response = await knowledgebaseService.createDocumentCategory(knowledgebaseId, createData);
        console.log('Response:', response);
        message.success('目录创建成功');
      }
      
      resetForm();
      onSuccess();
      onCancel();
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      message.error('创建目录失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    // 如果点击的是当前步骤，不做任何操作
    if (step === currentStep) {
      return;
    }
    
    // 直接跳转到目标步骤，不校验
    setCurrentStep(step);
  };

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setEditingId(null); // 重置编辑ID
    // 重置基本信息
    setName('');
    setDescription('');
    setParentId(undefined);
    setSortOrder(1);
    // 重置知识模型状态
    setKnowledgeTags([]);
    setSelectedTemplate('file'); // 默认选中"文件"知识模版
    setCustomFields([]);
    setHasKnowledgeContent(false);
    setChapterType('fixed');
    setChapters([]);
    setEditingRequirements('');
    // 重置其他配置状态
    setChunkMethod('');
    setChunkConfig({});
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  React.useEffect(() => {
    const loadEditData = async () => {
      if (visible && editData) {
        try {
          setLoading(true);
          // 调用后端接口获取最新的知识目录数据
          const categoryData = await knowledgebaseService.getDocumentCategory(knowledgebaseId, editData.id);
          
          // 设置编辑模式的ID
          setEditingId(categoryData.id);
          
          // 回填基本信息
          setName(categoryData.name || '');
          setDescription(categoryData.description || '');
          setParentId(categoryData.parent_id || undefined);
          setSortOrder(Math.max(categoryData.sort_order || 1, 1));
          
          // 回填切片配置
          if (categoryData.chunk_method) {
            setChunkMethod(categoryData.chunk_method);
          }
          if (categoryData.chunk_config) {
            const chunkCfg = typeof categoryData.chunk_config === 'string' 
              ? JSON.parse(categoryData.chunk_config) 
              : categoryData.chunk_config;
            setChunkConfig(chunkCfg);
          }
          
          // 回填知识模型配置
          if (categoryData.document_config) {
            const docConfig = typeof categoryData.document_config === 'string' 
              ? JSON.parse(categoryData.document_config) 
              : categoryData.document_config;
            setKnowledgeTags(docConfig.tags || []);
            setSelectedTemplate(docConfig.template_type || '');
            setCustomFields(docConfig.custom_fields || []);
            setHasKnowledgeContent(docConfig.has_knowledge_content || false);
            setChapterType(docConfig.chapter_type || 'fixed');
            setChapters(docConfig.chapters || []);
            setEditingRequirements(docConfig.editing_requirements || '');
          }
        } catch (error) {
          console.error('Failed to load category data:', error);
          message.error('加载知识目录数据失败');
        } finally {
          setLoading(false);
        }
      } else if (visible) {
        // 新增模式：设置默认排序
        const maxSortOrder = categories.length > 0
          ? Math.max(...categories.map(c => c.sort_order || 0))
          : 0;
        setSortOrder(Math.max(maxSortOrder + 1, 1));
      }
    };
    
    loadEditData();
  }, [visible, editData, categories, knowledgebaseId]);

  React.useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  // 获取知识模版数据
  React.useEffect(() => {
    if (visible && knowledgeTemplates.length === 0) {
      knowledgebaseService.getDocumentConstants().then((data) => {
        if (data.knowledge_templates) {
          setKnowledgeTemplates(data.knowledge_templates);
        }
        setDocumentConstants(data);
      }).catch((error) => {
        console.error('Failed to fetch knowledge templates:', error);
      });
    }
  }, [visible, knowledgeTemplates.length]);

  // 知识模版变化时查询可用切片方法
  React.useEffect(() => {
    if (!visible || !selectedTemplate) return;
    
    if (prevSelectedTemplate === selectedTemplate) {
      return;
    }
    
    setPrevSelectedTemplate(selectedTemplate);
    
    const fetchAvailableMethods = async () => {
      try {
        const methodsData = await knowledgebaseService.getAvailableChunkMethods(undefined, '', selectedTemplate);
        setAvailableChunkMethods(methodsData.available_methods);
        
        // 检查当前方法是否在可用方法列表中
        const isCurrentMethodAvailable = methodsData.available_methods.some(
          (method: any) => method.key === chunkMethod
        );
        
        // 只有在以下情况才设置默认方法：
        // 1. 当前没有选择方法（新增模式）
        // 2. 或者当前方法不在可用方法列表中（模板切换导致方法不可用）
        if ((!chunkMethod || !isCurrentMethodAvailable) && methodsData.available_methods.length > 0) {
          const defaultMethod = methodsData.available_methods[0].key;
          setChunkMethod(defaultMethod);
          initChunkConfig(defaultMethod);
        }
      } catch (error) {
        console.error('Failed to fetch available chunk methods:', error);
        message.error('获取可用切片方法失败');
      }
    };
    
    fetchAvailableMethods();
  }, [visible, selectedTemplate]);
  
  const initChunkConfig = (method: string) => {
    if (!documentConstants) return;
    const fields = documentConstants.chunk_configs[method] || [];
    const defaultConfig: Record<string, unknown> = {};
    fields.forEach(field => {
      defaultConfig[field.key] = field.default;
      if (field.sub_configs) {
        Object.values(field.sub_configs).forEach(subFields => {
          subFields.forEach(subField => {
            defaultConfig[subField.key] = subField.default;
          });
        });
      }
    });
    setChunkConfig(defaultConfig);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepBasicInfo 
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            parentId={parentId}
            setParentId={setParentId}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            categories={categories}
          />
        );
      case 1:
        return (
          <StepKnowledgeModel
            ref={stepKnowledgeModelRef}
            knowledgeTags={knowledgeTags}
            setKnowledgeTags={setKnowledgeTags}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            customFields={customFields}
            setCustomFields={setCustomFields}
            hasKnowledgeContent={hasKnowledgeContent}
            setHasKnowledgeContent={setHasKnowledgeContent}
            chapterType={chapterType}
            setChapterType={setChapterType}
            chapters={chapters}
            setChapters={setChapters}
            editingRequirements={editingRequirements}
            setEditingRequirements={setEditingRequirements}
            knowledgeTemplates={knowledgeTemplates}
            documentConstants={documentConstants}
          />
        );
      case 2:
        return (
          <StepOtherConfig
            chunkMethod={chunkMethod}
            setChunkMethod={setChunkMethod}
            chunkConfig={chunkConfig}
            setChunkConfig={setChunkConfig}
            documentConstants={documentConstants}
            availableMethods={availableChunkMethods}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      title={editingId ? "编辑目录" : "新增目录"}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={1000}
      className={`knowledgebase-modal ${document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}`}
    >
      <Steps current={currentStep} style={{ marginBottom: '24px' }} onChange={handleStepClick}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} />
        ))}
      </Steps>

      <div style={{ minHeight: '300px' }}>
        {renderStepContent()}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button onClick={handleCancel} disabled={loading}>
          取消
        </Button>
        {currentStep > 0 && (
          <Button onClick={handlePrev} disabled={loading}>
            上一步
          </Button>
        )}
        {currentStep < steps.length - 1 && (
          <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={loading}>
            下一步
          </Button>
        )}
        <Button
          type="primary"
          onClick={handleOk}
          loading={loading}
        >
          保存
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgebaseDocumentFolderModal;
