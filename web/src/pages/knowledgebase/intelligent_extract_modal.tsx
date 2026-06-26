import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Form, Input, InputNumber, Button, Upload, message, Select, Radio, Checkbox, Tooltip, Spin, Row, Col, DatePicker, Space } from 'antd';
import { UploadOutlined, InfoCircleOutlined, InboxOutlined, ThunderboltOutlined, EyeOutlined, StopOutlined } from '@ant-design/icons';
import PromptTipTapEditor from '../../components/PromptTipTapEditor';
import MDEditorTheme from '../../components/MDEditorTheme';
import ChapterList from '../../components/ChapterList';
import { Chapter } from '../folder_modal/AddChapterModal';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { knowledgebaseService, KnowledgebaseDocumentCategory } from '../../services/knowledgebase';
import { SimpleTableRow } from '../../components/SimpleEditableTable';
import dayjs from 'dayjs';
import zhCN from 'antd/es/date-picker/locale/zh_CN';
const { RangePicker } = DatePicker;

interface ThinkingProcessDisplayProps {
  onInterrupt?: () => void;
  onClose?: () => void;
  extracting?: boolean;
}

/**
 * 思考过程展示组件
 * 用于实时展示模型的思考过程和正文内容
 */
const ThinkingProcessDisplay: React.FC<ThinkingProcessDisplayProps> = ({ onInterrupt, onClose, extracting }) => {
  const [reasoningContent, setReasoningContent] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [theme, setTheme] = useState<string>('dark');
  const textContentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);

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

  const handleScroll = () => {
    if (textContentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textContentRef.current;
      isAtBottomRef.current = scrollTop + clientHeight >= scrollHeight - 10;
    }
  };

  useEffect(() => {
    const handleUpdate = (event: any) => {
      const data = event.detail;
      setReasoningContent(data.reasoning_content || '');
      setTextContent(data.text || '');
    };

    window.addEventListener('thinking-process-update', handleUpdate);
    return () => window.removeEventListener('thinking-process-update', handleUpdate);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && textContentRef.current) {
      textContentRef.current.scrollTop = textContentRef.current.scrollHeight;
    }
  }, [textContent]);

  ThinkingProcessDisplay.updateData = (data: { reasoning_content: string; text: string }) => {
    window.dispatchEvent(new CustomEvent('thinking-process-update', { detail: data }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* 思考过程 */}
      {reasoningContent && (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
            💭 思考过程
          </div>
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: theme === 'dark' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)',
            border: `1px solid ${theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)'}`,
            maxHeight: 180,
            overflowY: 'auto',
            color: theme === 'dark' ? '#ddd' : '#666',
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            {reasoningContent}
          </div>
        </div>
      )}

      {/* 正文内容 */}
      <div style={{ flex: 1, minHeight: 200 }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          📝 正文内容
        </div>
        <div
          ref={textContentRef}
          onScroll={handleScroll}
          style={{
            padding: 12,
            borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
            maxHeight: 280,
            overflowY: 'auto',
            color: theme === 'dark' ? '#fff' : '#000',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {textContent || '等待生成...'}
        </div>
      </div>

      {/* 底部按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {extracting && onInterrupt && (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={onInterrupt}
            style={{ marginTop: 8 }}
          >
            中断回答
          </Button>
        )}
        {!extracting && onClose && (
          <Button
            type="primary"
            onClick={onClose}
            style={{ marginTop: 8 }}
          >
            关闭
          </Button>
        )}
      </div>
    </div>
  );
};

(ThinkingProcessDisplay as any).updateData = (data: { reasoning_content: string; text: string }) => {
  window.dispatchEvent(new CustomEvent('thinking-process-update', { detail: data }));
};

interface IntelligentExtractModalProps {
  visible: boolean;
  knowledgebaseId: string;
  selectedCategory: KnowledgebaseDocumentCategory | null;
  currentTitle?: string;
  currentTags?: string[];
  currentCustomFieldValues?: Record<string, any>;
  currentRichTextContent?: string;
  currentDynamicChapters?: Chapter[];
  onCancel: () => void;
  onConfirm: (extractedData: {
    title?: string;
    tags?: string[];
    customFieldValues?: Record<string, any>;
    richTextContent?: string;
  }) => void;
}

const IntelligentExtractModal: React.FC<IntelligentExtractModalProps> = ({
  visible,
  knowledgebaseId,
  selectedCategory,
  currentTitle,
  currentTags,
  currentCustomFieldValues,
  currentRichTextContent,
  currentDynamicChapters,
  onCancel,
  onConfirm,
}) => {
  const [theme, setTheme] = useState<string>('dark');
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [inputType, setInputType] = useState<'file' | 'text'>('text');
  const [fileList, setFileList] = useState<any[]>([]);
  const [textContent, setTextContent] = useState<string>('');
  const [extractPrompt, setExtractPrompt] = useState<string>('');
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractedResult, setExtractedResult] = useState<any>(null);
  const [overrideExisting, setOverrideExisting] = useState<boolean>(true);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [dynamicChapters, setDynamicChapters] = useState<Chapter[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [leftWidth, setLeftWidth] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showProcessModal, setShowProcessModal] = useState<boolean>(false);
  
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // 弹窗打开或知识目录变化时重置状态
  useEffect(() => {
    if (visible) {
      fetchModels();
      setCustomFieldValues({});
      setExtractedResult(null);
      setOverrideExisting(true);
      setExtractPrompt('');
      
      if (currentDynamicChapters) {
        setDynamicChapters([...currentDynamicChapters]);
      } else if (selectedCategory) {
        const docConfig = selectedCategory.document_config || {};
        const chapters = docConfig.chapters || [];
        setDynamicChapters([...chapters]);
      }
    }
  }, [visible, selectedCategory]);

  // 弹窗关闭时停止识别并清理
  useEffect(() => {
    if (!visible) {
      if (abortControllerRef.current && extracting) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setShowProcessModal(false);
    }
  }, [visible]);

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      
      // 同时查询文本模型和多模态模型
      const [textResult, multimodalResult] = await Promise.all([
        llmModelService.getLLMModels(1, 100, undefined, undefined, 'text', 'true'),
        llmModelService.getLLMModels(1, 100, undefined, undefined, 'multimodal', 'true')
      ]);
      
      const textModels = textResult.data || [];
      const multimodalModels = multimodalResult.data || [];
      
      // 合并模型并去重
      const mergedModels = [...textModels];
      const existingIds = new Set(textModels.map(m => m.id));
      
      for (const model of multimodalModels) {
        if (!existingIds.has(model.id)) {
          mergedModels.push(model);
        }
      }
      
      setModels(mergedModels);
      if (mergedModels.length > 0) {
        const defaultModel = mergedModels.find(m => m.is_default) || mergedModels[0];
        setSelectedModelId(defaultModel.id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      message.error('获取模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleFileChange = (file: File) => {
    const isExe = file.name.toLowerCase().endsWith('.exe');
    if (isExe) {
      message.error('不支持上传可执行文件(.exe)');
      return false;
    }
    fileMapRef.current.set(file.uid, file);
    setFileList(prev => [...prev, { uid: file.uid, name: file.name, size: file.size }]);
    return false;
  };

  const handleRemoveFile = (file: any) => {
    fileMapRef.current.delete(file.uid);
    setFileList(prev => prev.filter(f => f.uid !== file.uid));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // 限制左右宽度在 20% - 80% 之间
    const clampedWidth = Math.max(20, Math.min(80, newLeftWidth));
    setLeftWidth(clampedWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加和移除鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      message.info('正在中断识别...');
    }
  };

  const handleExtract = async () => {
    if (!selectedModelId) {
      message.error('请选择模型');
      return;
    }
    
    if (inputType === 'file' && fileList.length === 0) {
      message.error('请上传文件');
      return;
    }
    
    if (inputType === 'text' && !textContent.trim()) {
      message.error('请输入文本内容');
      return;
    }

    setExtracting(true);
    setExtractedResult(null);
    setShowProcessModal(true);
    
    // 清空识别过程内容
    ThinkingProcessDisplay.updateData({ reasoning_content: '', text: '' });
    
    abortControllerRef.current = new AbortController();
    
    try {
      let result: any;
      
      if (inputType === 'file') {
        const files = fileList.map(f => fileMapRef.current.get(f.uid)).filter(Boolean) as File[];
        result = await knowledgebaseService.intelligentExtractFromFileStream(
          files,
          selectedModelId,
          extractPrompt,
          selectedCategory?.id || undefined,
          (data) => {
            ThinkingProcessDisplay.updateData(data);
          },
          abortControllerRef.current.signal
        );
      } else {
        result = await knowledgebaseService.intelligentExtractFromTextStream(
          selectedModelId,
          extractPrompt,
          textContent,
          selectedCategory?.id || undefined,
          (data) => {
            ThinkingProcessDisplay.updateData(data);
          },
          abortControllerRef.current.signal
        );
      }
      
      setExtractedResult(result);
      
      // 处理自定义字段回填（提取结果是数组，需要转换为对象）
      if (result.custom_fields && Array.isArray(result.custom_fields)) {
        const newFieldValues: Record<string, any> = {};
        
        result.custom_fields.forEach((field: any) => {
          if (field.id && field.value !== undefined && field.value !== null) {
            newFieldValues[field.id] = field.value;
          }
        });
        
        // 合并到现有的customFieldValues中
        setCustomFieldValues(prev => ({
          ...prev,
          ...newFieldValues
        }));
      }
      
      // 处理章节回填（合并到现有的dynamicChapters中）
      if (result.chapters && Array.isArray(result.chapters)) {
        setDynamicChapters(prev => {
          // 如果prev为空，直接返回所有新章节
          if (!prev || prev.length === 0) {
            return result.chapters;
          }
          const existingChapterIds = new Set(prev.map(ch => ch.id));
          const newChapters = result.chapters.filter((ch: any) => ch.id && !existingChapterIds.has(ch.id));
          return [...prev, ...newChapters];
        });

        // 处理章节字段值回填到 chapter_fields_values
        const newChapterFieldsValues: Record<string, any> = {};
        result.chapters.forEach((chapter: any) => {
          if (chapter.id && chapter.value !== undefined) {
            const chapterValues: Record<string, any> = {};
            
            // 根据章节类型处理value
            if (chapter.type === 'form' && typeof chapter.value === 'object' && !Array.isArray(chapter.value)) {
              // form类型：value是 { field_id: value } 对象
              Object.assign(chapterValues, chapter.value);
            } else if (chapter.type === 'list' && Array.isArray(chapter.value)) {
              // list类型：value是数组
              chapterValues.list_data = chapter.value;
            } else if (chapter.type === 'rich_text' && typeof chapter.value === 'string') {
              // rich_text类型：value是字符串
              chapterValues.rich_text_content = chapter.value;
            }
            
            if (Object.keys(chapterValues).length > 0) {
              newChapterFieldsValues[chapter.id] = chapterValues;
            }
          }
        });

        // 合并到现有的 chapter_fields_values 中
        if (Object.keys(newChapterFieldsValues).length > 0) {
          setCustomFieldValues(prev => ({
            ...prev,
            chapter_fields_values: {
              ...(prev.chapter_fields_values || {}),
              ...newChapterFieldsValues
            }
          }));
        }
      }
      
      message.success('智能提取成功，结果已回填到知识配置');
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        message.info('识别已中断');
      } else {
        console.error('Extract failed:', error);
        message.error((error as Error).message || '智能提取失败');
      }
    } finally {
      setExtracting(false);
      abortControllerRef.current = null;
    }
  };

  const handleConfirm = () => {
    if (!extractedResult) {
      message.warning('请先进行智能提取');
      return;
    }

    const result: any = {};
    
    // 处理标题
    if (overrideExisting) {
      if (extractedResult.title) {
        result.title = extractedResult.title;
      }
    } else {
      if (!currentTitle && extractedResult.title) {
        result.title = extractedResult.title;
      }
    }
    
    // 处理标签
    if (overrideExisting) {
      if (extractedResult.tags) {
        result.tags = extractedResult.tags;
      }
    } else {
      if (!currentTags || currentTags.length === 0) {
        if (extractedResult.tags) {
          result.tags = extractedResult.tags;
        }
      }
    }
    
    // 处理自定义字段值（从提取结果中提取字段值）
    if (extractedResult.custom_fields && Array.isArray(extractedResult.custom_fields)) {
      const extractedFieldValues: Record<string, any> = {};
      const newCustomFields: any[] = [];
      
      // 获取当前已有的字段ID
      const existingFieldIds = new Set<string>();
      if (selectedCategory?.document_config?.custom_fields) {
        selectedCategory.document_config.custom_fields.forEach((f: any) => {
          if (f.id) existingFieldIds.add(f.id);
        });
      }
      
      extractedResult.custom_fields.forEach((field: any) => {
        if (field.id) {
          // 提取字段值
          if (field.value !== undefined && field.value !== null) {
            extractedFieldValues[field.id] = field.value;
          }
          // 收集新字段定义
          if (!existingFieldIds.has(field.id)) {
            const { value, ...fieldDef } = field;
            newCustomFields.push(fieldDef);
          }
        }
      });

      if (overrideExisting) {
        result.customFieldValues = extractedFieldValues;
      } else {
        const mergedFields: Record<string, any> = {};
        for (const [fieldId, fieldValue] of Object.entries(extractedFieldValues)) {
          if (!currentCustomFieldValues || 
              !currentCustomFieldValues[fieldId] || 
              currentCustomFieldValues[fieldId] === '' ||
              currentCustomFieldValues[fieldId] === null ||
              currentCustomFieldValues[fieldId] === undefined) {
            mergedFields[fieldId] = fieldValue;
          }
        }
        if (Object.keys(mergedFields).length > 0) {
          result.customFieldValues = mergedFields;
        }
      }
      
      // 传递新字段定义
      if (newCustomFields.length > 0) {
        result.newCustomFields = newCustomFields;
      }
    }

    // 处理章节字段值
    if (customFieldValues.chapter_fields_values) {
      result.chapterFieldsValues = customFieldValues.chapter_fields_values;
    }

    // 处理动态章节
    if (dynamicChapters && dynamicChapters.length > 0) {
      result.dynamicChapters = dynamicChapters;
    }
    
    // 处理富文本内容
    if (extractedResult.content) {
      if (overrideExisting) {
        result.richTextContent = extractedResult.content;
      } else {
        if (!currentRichTextContent) {
          result.richTextContent = extractedResult.content;
        }
      }
    }

    onConfirm(result);
    onCancel();
  };

  const renderLeftContent = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
            模型选择 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Select
            value={selectedModelId}
            onChange={setSelectedModelId}
            placeholder="请选择模型"
            loading={loadingModels}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          >
            {models.map(model => (
              <Select.Option key={model.id} value={model.id} label={model.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{model.name}</span>
                  {model.is_default && (
                    <span style={{ fontSize: 12, color: '#52c41a' }}>默认</span>
                  )}
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
            输入方式 <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Radio.Group value={inputType} onChange={(e) => setInputType(e.target.value)}>
            <Radio value="text">文本输入</Radio>
            <Radio value="file">文件上传</Radio>
          </Radio.Group>
        </div>

        {inputType === 'file' ? (
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
              文件上传
            </div>
            <Upload.Dragger
              multiple
              beforeUpload={handleFileChange}
              onRemove={handleRemoveFile}
              showUploadList={true}
              fileList={fileList.map(f => ({
                uid: f.uid,
                name: f.name,
                status: 'done',
                size: f.size
              }))}
              style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
                border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#d9d9d9'}`,
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#667eea', fontSize: 40 }} />
              </p>
              <p style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                点击或拖拽文件到此区域上传
              </p>
              <p style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                支持上传文档、图片或音频文件
              </p>
            </Upload.Dragger>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
              文本内容 <span style={{ color: '#ff4d4f' }}>*</span>
            </div>
            <Input.TextArea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="请输入需要提取的文本内容"
              rows={6}
              style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            />
          </div>
        )}

        <div>
          <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
            提取提示词
            <Tooltip title="用于指导模型如何提取信息的提示词，输入'/'可快速插入提示词引用">
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
            </Tooltip>
          </div>
          <PromptTipTapEditor
            height={200}
            value={extractPrompt}
            onChange={setExtractPrompt}
            placeholder="请输入提取提示词，输入'/'可快速插入提示词引用..."
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleExtract}
            loading={extracting}
            disabled={!selectedModelId}
            style={{ width: 'auto', minWidth: 120, padding: 5 }}
          >
            开始提取
          </Button>
          
          {extracting && (
            <Button
              icon={<EyeOutlined />}
              onClick={() => setShowProcessModal(true)}
              style={{ width: 'auto', minWidth: 120 }}
            >
              查看识别过程
            </Button>
          )}
        </div>

        {extractedResult && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: theme === 'dark' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(82, 196, 26, 0.05)',
            border: `1px solid ${theme === 'dark' ? 'rgba(82, 196, 26, 0.3)' : 'rgba(82, 196, 26, 0.2)'}`,
          }}>
            <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 8 }}>
              ✓ 提取成功
            </div>
            <div style={{ color: theme === 'dark' ? '#ccc' : '#666', fontSize: 12 }}>
              已提取标题、标签、自定义字段等信息
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRightContent = () => {
    if (!selectedCategory) {
      return (
        <div style={{
          padding: 24,
          textAlign: 'center',
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
          borderRadius: 8
        }}>
          <p style={{ color: theme === 'dark' ? '#999' : '#999' }}>请先选择知识目录</p>
          <p style={{ color: theme === 'dark' ? '#bbb' : '#bbb', fontSize: 12, marginTop: 8 }}>
            选择后将显示对应的知识配置项
          </p>
        </div>
      );
    }

    const docConfig = selectedCategory.document_config || {};
    const templateType = docConfig.template_type || '';
    const baseCustomFields = docConfig.custom_fields || [];
    const hasKnowledgeContent = docConfig.has_knowledge_content || false;
    const chapterType = docConfig.chapter_type || 'fixed';
    const baseChapters = docConfig.chapters || [];

    // 合并提取结果中的新自定义字段
    const allCustomFields = [...baseCustomFields];
    if (extractedResult?.custom_fields && Array.isArray(extractedResult.custom_fields)) {
      const existingFieldIds = new Set(baseCustomFields.map(f => f.id));
      extractedResult.custom_fields.forEach((field: any) => {
        if (field.id && !existingFieldIds.has(field.id)) {
          allCustomFields.push(field);
        }
      });
    }

    const customFields = allCustomFields;
    const chapters = chapterType === 'dynamic' ? dynamicChapters : baseChapters;

    // 根据template_type判断是否显示配置项
    const shouldShowConfig = templateType === 'custom_template';
    const shouldShowRichText = templateType === 'rich_text';

    // 如果不是自定义模板且不是富文本类型，则不显示任何内容
    if (!shouldShowConfig && !shouldShowRichText) {
      return (
        <div style={{
          padding: 24,
          textAlign: 'center',
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
          borderRadius: 8
        }}>
          <p style={{ color: theme === 'dark' ? '#999' : '#999' }}>当前知识目录无需配置项</p>
        </div>
      );
    }

    const renderFieldValue = (field: any) => {
      const inputStyle = {
        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
        width: '100%',
        height: 32
      };

      const fieldValue = customFieldValues[field.id] !== undefined
        ? customFieldValues[field.id]
        : field.default_value;

      const handleValueChange = (value: any) => {
        setCustomFieldValues(prev => ({
          ...prev,
          [field.id]: value
        }));
      };

      switch (field.field_type) {
        case 'boolean':
          return (
            <Select
              value={fieldValue !== undefined ? fieldValue : undefined}
              style={inputStyle}
              onChange={handleValueChange}
              allowClear
            >
              <Select.Option value={true}>true</Select.Option>
              <Select.Option value={false}>false</Select.Option>
            </Select>
          );
        case 'long':
        case 'integer':
          return (
            <InputNumber
              value={fieldValue !== undefined && fieldValue !== null ? fieldValue : undefined}
              style={inputStyle}
              precision={0}
              onChange={handleValueChange}
              placeholder="请输入整数"
            />
          );
        case 'float':
        case 'double':
          return (
            <InputNumber
              value={fieldValue !== undefined && fieldValue !== null ? fieldValue : undefined}
              style={inputStyle}
              step={0.01}
              onChange={handleValueChange}
              placeholder="请输入小数"
            />
          );
        case 'date':
          return (
            <DatePicker
              value={fieldValue ? dayjs(fieldValue) : null}
              style={inputStyle}
              showTime
              locale={zhCN}
              onChange={(_, dateString) => handleValueChange(dateString)}
            />
          );
        case 'integer_range':
        case 'long_range':
          return (
            <Space style={{ width: '100%' }}>
              <InputNumber
                value={Array.isArray(fieldValue) && fieldValue[0] !== undefined ? fieldValue[0] : undefined}
                precision={0}
                placeholder="最小值"
                style={{ height: 32, flex: 1 }}
                onChange={(v) => {
                  const currentArr = Array.isArray(fieldValue) ? fieldValue : [undefined, undefined];
                  handleValueChange([v, currentArr[1]]);
                }}
              />
              <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
              <InputNumber
                value={Array.isArray(fieldValue) && fieldValue[1] !== undefined ? fieldValue[1] : undefined}
                precision={0}
                placeholder="最大值"
                style={{ height: 32, flex: 1 }}
                onChange={(v) => {
                  const currentArr = Array.isArray(fieldValue) ? fieldValue : [undefined, undefined];
                  handleValueChange([currentArr[0], v]);
                }}
              />
            </Space>
          );
        case 'float_range':
          return (
            <Space style={{ width: '100%' }}>
              <InputNumber
                value={Array.isArray(fieldValue) && fieldValue[0] !== undefined ? fieldValue[0] : undefined}
                step={0.01}
                placeholder="最小值"
                style={{ height: 32, flex: 1 }}
                onChange={(v) => {
                  const currentArr = Array.isArray(fieldValue) ? fieldValue : [undefined, undefined];
                  handleValueChange([v, currentArr[1]]);
                }}
              />
              <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
              <InputNumber
                value={Array.isArray(fieldValue) && fieldValue[1] !== undefined ? fieldValue[1] : undefined}
                step={0.01}
                placeholder="最大值"
                style={{ height: 32, flex: 1 }}
                onChange={(v) => {
                  const currentArr = Array.isArray(fieldValue) ? fieldValue : [undefined, undefined];
                  handleValueChange([currentArr[0], v]);
                }}
              />
            </Space>
          );
        case 'date_range':
          return (
            <RangePicker
              value={fieldValue && Array.isArray(fieldValue) && fieldValue[0] && fieldValue[1] ? [dayjs(fieldValue[0]), dayjs(fieldValue[1])] : null}
              onChange={(_, dateStrings) => handleValueChange(dateStrings)}
              style={inputStyle}
              showTime
              locale={zhCN}
            />
          );
        case 'object':
          return (
            <Input
              value={typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue || {})}
              style={inputStyle}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder='{"key": "value"}'
            />
          );
        case 'array':
          return (
            <Input
              value={typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue || [])}
              style={inputStyle}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder='["item1", "item2"]'
            />
          );
        case 'text':
        default:
          return (
            <Input
              value={fieldValue || ''}
              style={inputStyle}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={`请输入${field.field_name}`}
            />
          );
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {shouldShowConfig && (
          <>
            <div style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
              知识配置
              <Tooltip title="显示当前知识目录的配置项,提取结果将填充到这些字段">
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', fontSize: 14 }} />
              </Tooltip>
            </div>

            {customFields.length > 0 && (
              <div style={{
                padding: 10,
                borderRadius: 8,
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'transparent',
                border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
              }}>
                <Row gutter={[16, 12]}>
                  {customFields.map((field: any, index: number) => (
                    <Col key={index} span={12}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                          {field.field_name}
                          {field.is_required && <span style={{ color: '#ff4d4f' }}> *</span>}
                        </div>
                        <div style={{ width: '100%' }}>
                          {renderFieldValue(field)}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {hasKnowledgeContent && chapterType === 'fixed' && chapters.length > 0 && (
              <div style={{
                marginTop: customFields.length > 0 ? 16 : 0,
                paddingTop: customFields.length > 0 ? 16 : 0,
                borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none'
              }}>
                <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                  章节目录
                </div>
                <ChapterList
                  chapters={chapters}
                  onChange={() => {}}
                  editable={false}
                  chapterFieldsValues={customFieldValues.chapter_fields_values || {}}
                  onChapterFieldsValuesChange={(values) => {
                    setCustomFieldValues(prev => ({
                      ...prev,
                      chapter_fields_values: values,
                    }));
                  }}
                />
              </div>
            )}

            {hasKnowledgeContent && chapterType === 'dynamic' && (
              <div style={{
                marginTop: customFields.length > 0 ? 16 : 0,
                paddingTop: customFields.length > 0 ? 16 : 0,
                borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none'
              }}>
                <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                  章节目录
                  <Tooltip title="动态章节:用户可手动添加章节及章节字段">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
                  </Tooltip>
                </div>
                <ChapterList
                  chapters={dynamicChapters}
                  onChange={(newChapters) => {
                    setDynamicChapters(newChapters);
                  }}
                  editable={true}
                  chapterFieldsValues={customFieldValues.chapter_fields_values || {}}
                  onChapterFieldsValuesChange={(values) => {
                    setCustomFieldValues(prev => ({
                      ...prev,
                      chapter_fields_values: values,
                    }));
                  }}
                />
              </div>
            )}

            {hasKnowledgeContent && chapterType === 'rich_text' && (
              <div style={{
                marginTop: customFields.length > 0 ? 16 : 0,
                paddingTop: customFields.length > 0 ? 16 : 0,
                borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none'
              }}>
                <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                  知识内容
                </div>
                <div style={{ width: '100%' }}>
                  <MDEditorTheme
                    value={customFieldValues.chapter_rich_text_content || ''}
                    onChange={(val) => {
                      setCustomFieldValues(prev => ({
                        ...prev,
                        chapter_rich_text_content: val || ''
                      }));
                    }}
                    height={200}
                    preview="edit"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {shouldShowRichText && (
          <div style={{
            marginTop: shouldShowConfig && (customFields.length > 0 || (chapterType === 'fixed' && chapters.length > 0) || chapterType === 'dynamic') ? 16 : 0,
            paddingTop: shouldShowConfig && (customFields.length > 0 || (chapterType === 'fixed' && chapters.length > 0) || chapterType === 'dynamic') ? 16 : 0,
            borderTop: shouldShowConfig && (customFields.length > 0 || (chapterType === 'fixed' && chapters.length > 0) || chapterType === 'dynamic') ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none'
          }}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
              知识内容
            </div>
            <div style={{ width: '100%' }}>
              <MDEditorTheme
                value={customFieldValues.richTextContent || ''}
                onChange={(val) => {
                  setCustomFieldValues(prev => ({
                    ...prev,
                    richTextContent: val || ''
                  }));
                }}
                height={200}
                preview="edit"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal
        title="智能提取"
        open={visible}
        onCancel={onCancel}
        footer={null}
        width={1400}
      bodyStyle={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 0 }}
    >
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', minHeight: 0, paddingBottom: 5 }}
      >
        {/* 左侧配置区域 */}
        <div style={{ 
          width: `${leftWidth}%`, 
          padding: 5,
          paddingRight: 12,
          transition: isDragging ? 'none' : 'width 0.1s'
        }}>
          {renderLeftContent()}
        </div>
        
        {/* 可拖拽分隔线 */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 1,
            background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8',
            cursor: 'col-resize',
            position: 'relative',
            zIndex: 10,
            transition: isDragging ? 'none' : 'background 0.2s',
          }}
        >
          {/* 拖拽手柄 */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 8,
            height: 40,
            background: isDragging 
              ? '#667eea' 
              : theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            borderRadius: 4,
            cursor: 'col-resize',
            transition: isDragging ? 'none' : 'background 0.2s',
          }} />
        </div>
        
        {/* 右侧配置区域 */}
        <div style={{ 
          width: `${100 - leftWidth}%`, 
          padding: 5,
          paddingLeft: 12,
          transition: isDragging ? 'none' : 'width 0.1s'
        }}>
          {renderRightContent()}
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
        paddingTop: 16,
        paddingBottom: 16,
        paddingRight: 24,
        position: 'relative',
        background: theme === 'dark' ? '#1e1e1e' : '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox
              checked={overrideExisting}
              onChange={(e) => setOverrideExisting(e.target.checked)}
            >
              覆盖已有值
            </Checkbox>
            <Tooltip title="勾选后将覆盖所有字段;不勾选则只设置为空的字段">
              <InfoCircleOutlined style={{ color: '#999', fontSize: 14 }} />
            </Tooltip>
          </div>

          <Button onClick={onCancel}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleConfirm}
            disabled={!extractedResult}
          >
            确定
          </Button>
        </div>
      </div>
    </Modal>

    {/* 识别结果弹窗 */}
    <Modal
      title="智能识别结果"
      open={showProcessModal}
      onCancel={() => setShowProcessModal(false)}
      footer={null}
      width={800}
      bodyStyle={{ maxHeight: '70vh', padding: 20 }}
      centered
    >
      <ThinkingProcessDisplay 
        onInterrupt={handleInterrupt} 
        onClose={() => setShowProcessModal(false)}
        extracting={extracting}
      />
    </Modal>
  </>
);
};

export default IntelligentExtractModal;