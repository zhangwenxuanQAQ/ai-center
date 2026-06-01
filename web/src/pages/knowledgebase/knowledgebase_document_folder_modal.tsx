import React, { useState } from 'react';
import { Modal, Steps, Button, message, Form } from 'antd';
import { knowledgebaseService } from '../../services/knowledgebase';
import StepBasicInfo from './folder_modal/StepBasicInfo';
import StepKnowledgeModel from './folder_modal/StepKnowledgeModel';
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
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

  // 第三步其他配置状态
  const [vectorRetrieval, setVectorRetrieval] = useState(false);
  const [graphRetrieval, setGraphRetrieval] = useState(false);
  const [chunkMethod, setChunkMethod] = useState('');
  const [textBlockSize, setTextBlockSize] = useState(512);
  const [segmentIdentifiers, setSegmentIdentifiers] = useState('');
  const [pageRank, setPageRank] = useState(0);
  const [tagSets, setTagSets] = useState<string[]>([]);
  const [autoKeywords, setAutoKeywords] = useState(5);
  const [autoQuestions, setAutoQuestions] = useState(3);
  const [useRaptor, setUseRaptor] = useState(false);
  const [maxTokens, setMaxTokens] = useState(256);
  const [threshold, setThreshold] = useState(0.7);
  const [maxClusters, setMaxClusters] = useState(64);
  const [randomSeed, setRandomSeed] = useState<number | null>(null);
  const [convertTableToHtml, setConvertTableToHtml] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [graphMethod, setGraphMethod] = useState('');
  const [entityNormalization, setEntityNormalization] = useState(false);
  const [blockAggregation, setBlockAggregation] = useState(false);

  const steps = [
    { title: '基本信息' },
    { title: '知识模型' },
    { title: '其它配置' },
  ];

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!name || name.trim() === '') {
          message.error('请输入分类名称');
          return false;
        }
        if (!sortOrder || sortOrder <= 0) {
          message.error('请输入有效的排序顺序');
          return false;
        }
        return true;
      case 1:
        if (!knowledgeTags || knowledgeTags.length === 0) {
          message.error('请添加知识标签');
          return false;
        }
        if (!selectedTemplate) {
          message.error('请选择知识模板');
          return false;
        }
        if (selectedTemplate === 'custom' && (!customFields || customFields.length === 0)) {
          message.error('请添加自定义字段');
          return false;
        }
        if (hasKnowledgeContent && chapterType === 'fixed' && (!chapters || chapters.length === 0)) {
          message.error('请添加章节');
          return false;
        }
        return true;
      case 2:
        if (vectorRetrieval && !chunkMethod) {
          message.error('请选择切片方法');
          return false;
        }
        if (graphRetrieval && (!entityTypes || entityTypes.length === 0)) {
          message.error('请添加实体类型');
          return false;
        }
        if (graphRetrieval && !graphMethod) {
          message.error('请选择图谱检索方法');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleOk = async () => {
    if (currentStep < steps.length - 1) {
      if (!validateStep(currentStep)) {
        return;
      }
      setCurrentStep(currentStep + 1);
      return;
    }

    try {
      // 验证所有步骤
      for (let i = 0; i < steps.length; i++) {
        if (!validateStep(i)) {
          setCurrentStep(i);
          return;
        }
      }

      setLoading(true);

      // 构建知识模型配置
      const documentConfig = {
        tags: knowledgeTags,
        template_type: selectedTemplate,
        custom_fields: selectedTemplate === 'custom' ? customFields : undefined,
        has_knowledge_content: hasKnowledgeContent,
        chapter_type: hasKnowledgeContent ? chapterType : undefined,
        chapters: hasKnowledgeContent && chapterType === 'fixed' ? chapters : undefined,
        editing_requirements: editingRequirements || undefined,
      };

      // 构建切片配置
      const chunkConfig: any = {};
      if (vectorRetrieval) {
        chunkConfig.vector_retrieval = true;
        chunkConfig.text_block_size = textBlockSize;
        chunkConfig.segment_identifiers = segmentIdentifiers || undefined;
        chunkConfig.page_rank = pageRank;
        chunkConfig.tag_sets = tagSets.length > 0 ? tagSets : undefined;
        chunkConfig.auto_keywords = autoKeywords;
        chunkConfig.auto_questions = autoQuestions;
        chunkConfig.max_tokens = maxTokens;
        chunkConfig.threshold = threshold;
        chunkConfig.max_clusters = maxClusters;
        chunkConfig.random_seed = randomSeed || undefined;
        chunkConfig.convert_table_to_html = convertTableToHtml;
        chunkConfig.use_raptor = useRaptor;
        if (useRaptor) {
          chunkConfig.prompt = prompt || undefined;
        }
      }
      if (graphRetrieval) {
        chunkConfig.graph_retrieval = true;
        chunkConfig.entity_types = entityTypes;
        chunkConfig.graph_method = graphMethod;
        chunkConfig.entity_normalization = entityNormalization;
        chunkConfig.block_aggregation = blockAggregation;
      }

      // 构建最终数据，确保基本信息字段与其他配置字段平级
      const createData: any = {
        name: name.trim(),
        description: description.trim(),
        parent_id: parentId || null,
        sort_order: sortOrder > 0 ? sortOrder : 1,
      };

      // 只在有数据时添加额外字段
      if (knowledgeTags.length > 0 || selectedTemplate) {
        createData.document_config = documentConfig;
      }
      if (chunkMethod) {
        createData.chunk_method = chunkMethod;
      }
      if (Object.keys(chunkConfig).length > 0) {
        createData.chunk_config = chunkConfig;
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
    setSelectedTemplate('');
    setCustomFields([]);
    setHasKnowledgeContent(false);
    setChapterType('fixed');
    setChapters([]);
    setEditingRequirements('');
    // 重置其他配置状态
    setVectorRetrieval(false);
    setGraphRetrieval(false);
    setChunkMethod('');
    setTextBlockSize(512);
    setSegmentIdentifiers('');
    setPageRank(0);
    setTagSets([]);
    setAutoKeywords(5);
    setAutoQuestions(3);
    setUseRaptor(false);
    setMaxTokens(256);
    setThreshold(0.7);
    setMaxClusters(64);
    setRandomSeed(null);
    setConvertTableToHtml(false);
    setPrompt('');
    setEntityTypes([]);
    setGraphMethod('');
    setEntityNormalization(false);
    setBlockAggregation(false);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  React.useEffect(() => {
    if (visible && editData) {
      // 设置编辑模式的ID
      setEditingId(editData.id);
      
      // 回填基本信息
      setName(editData.name || '');
      setDescription(editData.description || '');
      setParentId(editData.parent_id || undefined);
      setSortOrder(editData.sort_order || 1);
      
      // 回填知识模型配置
      if (editData.document_config) {
        const docConfig = typeof editData.document_config === 'string' 
          ? JSON.parse(editData.document_config) 
          : editData.document_config;
        setKnowledgeTags(docConfig.tags || []);
        setSelectedTemplate(docConfig.template_type || '');
        setCustomFields(docConfig.custom_fields || []);
        setHasKnowledgeContent(docConfig.has_knowledge_content || false);
        setChapterType(docConfig.chapter_type || 'fixed');
        setChapters(docConfig.chapters || []);
        setEditingRequirements(docConfig.editing_requirements || '');
      }
      
      // 回填切片配置
      if (editData.chunk_method) {
        setChunkMethod(editData.chunk_method);
      }
      if (editData.chunk_config) {
        const chunkCfg = typeof editData.chunk_config === 'string' 
          ? JSON.parse(editData.chunk_config) 
          : editData.chunk_config;
        
        // 向量检索
        setVectorRetrieval(chunkCfg.vector_retrieval || false);
        if (chunkCfg.vector_retrieval) {
          setTextBlockSize(chunkCfg.text_block_size || 512);
          setSegmentIdentifiers(chunkCfg.segment_identifiers || '');
          setPageRank(chunkCfg.page_rank || 0);
          setTagSets(chunkCfg.tag_sets || []);
          setAutoKeywords(chunkCfg.auto_keywords || 5);
          setAutoQuestions(chunkCfg.auto_questions || 3);
          setUseRaptor(chunkCfg.use_raptor || false);
          setMaxTokens(chunkCfg.max_tokens || 256);
          setThreshold(chunkCfg.threshold || 0.7);
          setMaxClusters(chunkCfg.max_clusters || 64);
          setRandomSeed(chunkCfg.random_seed || null);
          setConvertTableToHtml(chunkCfg.convert_table_to_html || false);
          setPrompt(chunkCfg.prompt || '');
        }
        
        // 图谱检索
        setGraphRetrieval(chunkCfg.graph_retrieval || false);
        if (chunkCfg.graph_retrieval) {
          setEntityTypes(chunkCfg.entity_types || []);
          setGraphMethod(chunkCfg.graph_method || '');
          setEntityNormalization(chunkCfg.entity_normalization || false);
          setBlockAggregation(chunkCfg.block_aggregation || false);
        }
      }
    } else if (visible) {
      // 新增模式：设置默认排序
      const maxSortOrder = categories.length > 0
        ? Math.max(...categories.map(c => c.sort_order || 0))
        : 0;
      setSortOrder(maxSortOrder + 1);
    }
  }, [visible, editData, categories]);

  React.useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  // 获取知识模板数据
  React.useEffect(() => {
    if (visible && knowledgeTemplates.length === 0) {
      knowledgebaseService.getDocumentConstants().then((data) => {
        if (data.knowledge_templates) {
          setKnowledgeTemplates(data.knowledge_templates);
        }
      }).catch((error) => {
        console.error('Failed to fetch knowledge templates:', error);
      });
    }
  }, [visible, knowledgeTemplates.length]);

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
          />
        );
      case 2:
        return (
          <StepOtherConfig
            vectorRetrieval={vectorRetrieval}
            setVectorRetrieval={setVectorRetrieval}
            graphRetrieval={graphRetrieval}
            setGraphRetrieval={setGraphRetrieval}
            chunkMethod={chunkMethod}
            setChunkMethod={setChunkMethod}
            textBlockSize={textBlockSize}
            setTextBlockSize={setTextBlockSize}
            segmentIdentifiers={segmentIdentifiers}
            setSegmentIdentifiers={setSegmentIdentifiers}
            pageRank={pageRank}
            setPageRank={setPageRank}
            tagSets={tagSets}
            setTagSets={setTagSets}
            autoKeywords={autoKeywords}
            setAutoKeywords={setAutoKeywords}
            autoQuestions={autoQuestions}
            setAutoQuestions={setAutoQuestions}
            useRaptor={useRaptor}
            setUseRaptor={setUseRaptor}
            maxTokens={maxTokens}
            setMaxTokens={setMaxTokens}
            threshold={threshold}
            setThreshold={setThreshold}
            maxClusters={maxClusters}
            setMaxClusters={setMaxClusters}
            randomSeed={randomSeed}
            setRandomSeed={setRandomSeed}
            convertTableToHtml={convertTableToHtml}
            setConvertTableToHtml={setConvertTableToHtml}
            prompt={prompt}
            setPrompt={setPrompt}
            entityTypes={entityTypes}
            setEntityTypes={setEntityTypes}
            graphMethod={graphMethod}
            setGraphMethod={setGraphMethod}
            entityNormalization={entityNormalization}
            setEntityNormalization={setEntityNormalization}
            blockAggregation={blockAggregation}
            setBlockAggregation={setBlockAggregation}
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
      <Steps current={currentStep} style={{ marginBottom: '24px' }}>
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
        <Button
          type="primary"
          onClick={handleOk}
          loading={loading}
        >
          {currentStep === steps.length - 1 ? '保存' : '下一步'}
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgebaseDocumentFolderModal;
