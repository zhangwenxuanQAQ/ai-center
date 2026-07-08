import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button, Input, Select, Tag, Upload, message, Slider, InputNumber, Tooltip, Form, Switch, TreeSelect, Spin, Empty, Row, Col, List, DatePicker, Space, Descriptions } from 'antd';
const { RangePicker } = DatePicker;
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';
import zhCN from 'antd/es/date-picker/locale/zh_CN';
import MDEditor from '@uiw/react-md-editor';
import PageHeader from '../../components/page-header';
import ChapterList from '../../components/ChapterList';
import { Chapter } from './folder_modal/AddChapterModal';
import IntelligentExtractModal from './intelligent_extract_modal';
import { ExtractManager } from '../../utils/extract_manager';
import {
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  UndoOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  FileImageOutlined,
  SoundOutlined,
  DatabaseOutlined,
  FormOutlined,
  InboxOutlined,
  FolderOutlined,
  TableOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { knowledgebaseService, KnowledgebaseDocument, KnowledgebaseCategory, KnowledgebaseDocumentCategory } from '../../services/knowledgebase';
import { datasourceService, Datasource } from '../../services/datasource';

interface ChunkConfigFieldDef {
  key: string;
  label: string;
  field_type: string;
  default: unknown;
  description: string;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  min_value?: number;
  max_value?: number;
  step?: number;
  sub_configs?: Record<string, ChunkConfigFieldDef[]>;
}

interface DocumentConstants {
  chunk_methods: Array<{ key: string; label: string }>;
  source_types: Array<{ key: string; label: string }>;
  chunk_configs: Record<string, ChunkConfigFieldDef[]>;
  source_configs: {
    local_document: ChunkConfigFieldDef[];
    datasource: {
      relational_database: ChunkConfigFieldDef[];
      file_storage: ChunkConfigFieldDef[];
    };
    custom_template: ChunkConfigFieldDef[];
  };
}

interface KnowledgebaseDocumentSettingProps {
  knowledgebase: { id: string; name: string };
  document?: KnowledgebaseDocument;
  onBack: () => void;
  onSave: () => void;
  selectedCategoryId?: string;
}

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  local_document: <FileOutlined style={{ fontSize: 24 }} />,
  datasource: <DatabaseOutlined style={{ fontSize: 24 }} />,
  custom_template: <FormOutlined style={{ fontSize: 24 }} />,
  rich_text: <FileTextOutlined style={{ fontSize: 24 }} />,
};

const KnowledgebaseDocumentSetting: React.FC<KnowledgebaseDocumentSettingProps> = ({
  knowledgebase,
  document: doc,
  onBack,
  onSave,
  selectedCategoryId,
}) => {
  const isEdit = !!doc;
  const [currentKnowledgeId, setCurrentKnowledgeId] = useState<string>(doc?.id || `new_${knowledgebase.id}_${Date.now()}`);
  const knowledgeId = currentKnowledgeId;
  
  const [theme, setTheme] = useState<string>('dark');
  const [constants, setConstants] = useState<DocumentConstants | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [sourceType, setSourceType] = useState<string>('local_document');
  const [chunkMethod, setChunkMethod] = useState<string>('naive');
  const [chunkConfig, setChunkConfig] = useState<Record<string, unknown>>({});
  const [userTags, setUserTags] = useState<string[]>([]);
  const [categoryTags, setCategoryTags] = useState<string[]>([]);
  const [metadatas, setMetadatas] = useState<Array<{ field_name: string; field_label: string; field_type: string; field_value: any }>>([]);
  const [metadataFieldTypes, setMetadataFieldTypes] = useState<Array<{ key: string; label: string; es_type: string; type: string }>>([]);
  const [fileList, setFileList] = useState<Array<{ uid: string; name: string; size: number }>>([]);
  const [status, setStatus] = useState<boolean>(true);
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [previousTemplateType, setPreviousTemplateType] = useState<string>('');
  const [availableChunkMethods, setAvailableChunkMethods] = useState<Array<{ key: string; label: string; is_default: boolean }>>([]);
  
  // 左右宽度比例状态（百分比）
  const [leftWidth, setLeftWidth] = useState<number>(65); // 默认左侧50%
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 数据源相关状态
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<string>('');
  const [selectedDatasource, setSelectedDatasource] = useState<Datasource | null>(null);
  const [datasourceLoading, setDatasourceLoading] = useState(false);
  
  // 富文本内容状态
  const [richTextContent, setRichTextContent] = useState<string>('');
  
  // 自定义字段值状态
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  
  // 智能提取新增的自定义字段定义
  const [extraCustomFields, setExtraCustomFields] = useState<any[]>([]);
  
  // 动态章节状态
  const [dynamicChapters, setDynamicChapters] = useState<Chapter[]>([]);
  
  // 合并用户标签和知识目录标签
  const tags = useMemo(() => {
    const allTags = [...categoryTags];
    userTags.forEach(tag => {
      if (!allTags.includes(tag)) {
        allTags.push(tag);
      }
    });
    return allTags;
  }, [userTags, categoryTags]);
  
  // 文件浏览器相关状态
  const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
  const [currentBucket, setCurrentBucket] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<any[]>([]);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [directories, setDirectories] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [fileSearchKeyword, setFileSearchKeyword] = useState<string>('');
  const [fileCurrentPage, setFileCurrentPage] = useState<number>(1);
  const [filePageSize, setFilePageSize] = useState<number>(10);
  
  // 数据库表浏览器相关状态
  const [tableBrowserLoading, setTableBrowserLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableColumns, setTableColumns] = useState<any[]>([]);

  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());
  
  const [showIntelligentExtract, setShowIntelligentExtract] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const extractManagerRef = useRef(ExtractManager.getInstance());

  useEffect(() => {
    const detectExtractStatus = async () => {
      console.log('开始检测提取状态，knowledgeId:', knowledgeId);

      // 先从localStorage检查
      const localState = extractManagerRef.current.getState(knowledgeId);
      console.log('localStorage中的提取状态:', localState);

      if (localState && localState.extractId) {
        // localStorage有状态，直接使用
        setIsExtracting(localState.status === 'extracting');
      } else {
        // localStorage没有状态，从后端查询是否有正在进行的提取任务
        try {
          const response = await knowledgebaseService.getIntelligentExtractStatusByKnowledgeId(knowledgeId);
          console.log('从后端查询的提取状态:', response);

          if (response && response.code === 200 && response.data) {
            const statusData = response.data;

            if (statusData.status !== 'none') {
              // 有提取任务，保存到localStorage
              const { extract_id, status, full_reasoning, full_text, extracted_data, finish_reason } = statusData;

              if (status === 'extracting') {
                // 保存extractId和提取内容到localStorage
                extractManagerRef.current.setState(knowledgeId, {
                  status: 'extracting',
                  extractId,
                  reasoningContent: full_reasoning || '',
                  textContent: full_text || '',
                  extractParams: null,
                  result: null
                });
                setIsExtracting(true);
              } else if (status === 'completed') {
                // 保存完成状态和结果到localStorage
                extractManagerRef.current.setCompleted(knowledgeId, extracted_data, full_reasoning, full_text);
                setIsExtracting(false);
              }
            }
          }
        } catch (error) {
          console.error('查询提取状态失败:', error);
        }
      }
    };

    detectExtractStatus();

    const unsubscribe = extractManagerRef.current.addListener(knowledgeId, (state) => {
      console.log('监听到提取状态变化:', state);
      setIsExtracting(state.status === 'extracting');
    });

    return () => {
      unsubscribe();
    };
  }, [knowledgeId]);

  // 监听页面关闭事件（不再清理缓存，以便刷新后能继续看到提取信息）
  useEffect(() => {
    // 注意：不再清理缓存，提取会继续在后台运行，刷新后可以从后端获取状态
  }, []);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间为北京时间（精确到秒）
  const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      // 直接使用本地时间显示，不再手动加8小时
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return '-';
    }
  };

  // 根据文件扩展名获取图标和颜色
  const getFileIcon = (fileName: string) => {
    if (!fileName) return <FileOutlined style={{ color: '#8c8c8c' }} />;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ color: '#1890ff' }} />;
      case 'txt':
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImageOutlined style={{ color: '#722ed1' }} />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <SoundOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <FileOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // 自定义文件列表项渲染
  const renderFileItem = (originNode: React.ReactNode, file: any) => {
    const fileInfo = fileList.find(f => f.uid === file.uid);
    const icon = getFileIcon(file.name);
    const size = file.size || (fileInfo && fileInfo.size);

    const handleDelete = () => {
      setFileList(prev => prev.filter(f => f.uid !== file.uid));
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 32 }}>{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 500 }}>{file.name}</span>
            {size && <span style={{ color: '#999', fontSize: 12 }}>{formatFileSize(size)}</span>}
          </div>
        </div>
        <div>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            danger
          />
        </div>
      </div>
    );
  };

  // 分类管理相关状态
  const [categories, setCategories] = useState<KnowledgebaseDocumentCategory[]>([]);

  const [originalData, setOriginalData] = useState({
    sourceType: 'local_document',
    chunkMethod: 'naive',
    chunkConfig: {},
    tags: [] as string[],
    status: true,
    fileList: [] as Array<{ uid: string; name: string; size: number }>,
    categoryId: '',
    metadatas: [] as Array<{ field_name: string; field_label: string; field_type: string; field_value: any }>,
    richTextContent: '',
    title: '',
    customFieldValues: {} as Record<string, any>,
    dynamicChapters: [] as Chapter[],
  });

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
    fetchConstants();
    fetchCategories();
    fetchDatasources();
  }, []);
  
  // 初始化时设置默认选中的知识目录
  useEffect(() => {
    if (!isEdit && selectedCategoryId && !categoryId) {
      setCategoryId(selectedCategoryId);
    }
  }, [isEdit, selectedCategoryId, categoryId]);

  const fetchCategories = async () => {
    try {
      const data = await knowledgebaseService.getDocumentCategoryTree(knowledgebase.id);
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch document categories:', error);
    }
  };

  const fetchDatasources = async () => {
    try {
      setDatasourceLoading(true);
      const result = await datasourceService.getDatasources();
      setDatasources(result.data || []);
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      message.error('获取数据源列表失败');
    } finally {
      setDatasourceLoading(false);
    }
  };

  const handleDatasourceSelect = async (datasourceId: string) => {
    setSelectedDatasourceId(datasourceId);
    const datasource = datasources.find(d => d.id === datasourceId);
    setSelectedDatasource(datasource || null);
    
    // 重置浏览器状态
    setFiles([]);
    setDirectories([]);
    setTables([]);
    setTableColumns([]);
    setSelectedTable('');
    setCurrentBucket('');
    setCurrentPath('');
    setFileSearchKeyword('');
    setFileCurrentPage(1);
    
    if (datasource) {
      // 根据数据源类型加载内容
      const isFileStorage = ['s3', 'minio', 'rustfs'].includes(datasource.type);
      const isRelationalDb = ['mysql', 'postgresql', 'oracle', 'sql_server'].includes(datasource.type);
      
      if (isFileStorage) {
        await loadFileList(datasourceId);
      } else if (isRelationalDb) {
        await loadTableList(datasourceId);
      }
    }
  };

  const loadFileList = async (datasourceId: string, bucket?: string, prefix?: string, searchKeyword?: string) => {
    try {
      setFileBrowserLoading(true);
      const result = await datasourceService.listFiles(datasourceId, bucket, prefix, 100, searchKeyword);
      // http.get 已经返回了 data 字段，直接使用 result
      setDirectories(result?.directories || []);
      setFiles(result?.files || []);
      // 更新allFiles，保存所有已加载的文件信息
      if (result?.files && result.files.length > 0) {
        setAllFiles(prev => {
          const newFiles = result.files.filter((file: any) => 
            !prev.some((prevFile: any) => prevFile.path === file.path)
          );
          return [...prev, ...newFiles];
        });
      }
      if (result?.bucket) {
        setCurrentBucket(result.bucket);
      }
      setCurrentPath(prefix || '');
    } catch (error) {
      console.error('Failed to load file list:', error);
      message.error('获取文件列表失败');
    } finally {
      setFileBrowserLoading(false);
    }
  };

  const loadTableList = async (datasourceId: string) => {
    try {
      setTableBrowserLoading(true);
      const result = await datasourceService.listTables(datasourceId);
      // http.get 已经返回了 data 字段，直接使用 result
      setTables(result?.tables || []);
    } catch (error) {
      console.error('Failed to load table list:', error);
      message.error('获取表列表失败');
    } finally {
      setTableBrowserLoading(false);
    }
  };

  const handleDirectoryClick = (directory: any) => {
    if (!selectedDatasourceId) return;
    
    // 重置搜索和分页状态
    setFileSearchKeyword('');
    setFileCurrentPage(1);
    
    // 如果是桶，设置currentBucket并加载桶内的文件列表
    if (directory.type === 'bucket') {
      setCurrentBucket(directory.name);
      setCurrentPath('');
      loadFileList(selectedDatasourceId, directory.name, undefined);
    } 
    // 如果是目录，加载目录内的文件列表
    else if (directory.type === 'directory') {
      loadFileList(selectedDatasourceId, currentBucket, directory.path);
    }
  };

  const handleTableClick = async (tableName: string) => {
    if (!selectedDatasourceId) return;
    try {
      setSelectedTable(tableName);
      const result = await datasourceService.getTableColumns(selectedDatasourceId, tableName);
      // http.get 已经返回了 data 字段，直接使用 result
      setTableColumns(result?.columns || []);
    } catch (error) {
      console.error('Failed to load table columns:', error);
      message.error('获取表字段失败');
    }
  };

  // 处理文件勾选
  const handleFileSelect = (file: any, checked: boolean) => {
    if (checked) {
      // 添加文件到选中列表
      setSelectedFiles(prev => [...prev, file.path]);
    } else {
      // 从选中列表移除文件
      setSelectedFiles(prev => prev.filter(path => path !== file.path));
    }
  };

  // 移除已选择的文件
  const handleRemoveSelectedFile = (filePath: string) => {
    setSelectedFiles(prev => prev.filter(path => path !== filePath));
  };

  // 获取文件名（从路径中提取）
  const getFileName = (path: string): string => {
    return path.split('/').pop() || path;
  };

  const buildCategoryTreeSelectData = () => {
    const buildTree = (cats: KnowledgebaseDocumentCategory[]): any[] => {
      return cats.map(cat => ({
        title: cat.name,
        value: cat.id,
        key: cat.id,
        children: cat.children && cat.children.length > 0 ? buildTree(cat.children) : undefined
      }));
    };
    return buildTree(categories);
  };

  // 查找目录对象
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

  // 当选中目录变化时，更新切片配置为目录的配置
  useEffect(() => {
    if (categoryId) {
      const category = findCategoryById(categories, categoryId);
      if (category) {
        const templateType = category.document_config?.template_type || 'file';
        const defaultSourceType = getDefaultSourceType(templateType);
        
        // 检查知识模版是否有变动（包括第一次选择）
        // 编辑模式下，只有在切换知识目录时才更新sourceType
        if (!isEdit || (isEdit && previousTemplateType && previousTemplateType !== templateType)) {
          // 第一次选择或模版类型发生变化，需要设置数据来源
          setSourceType(defaultSourceType);
          
          // 获取可用的切片方法
          const fetchAvailableMethods = async () => {
            try {
              const methodsData = await knowledgebaseService.getAvailableChunkMethods(undefined, '', templateType);
              setAvailableChunkMethods(methodsData.available_methods);
              
              // 优先使用知识目录的切片方法，否则使用第一个可用方法
              if (category.chunk_method) {
                // 检查知识目录的切片方法是否在可用列表中
                const isCategoryMethodAvailable = methodsData.available_methods.some(
                  (method: any) => method.key === category.chunk_method
                );
                if (isCategoryMethodAvailable) {
                  setChunkMethod(category.chunk_method);
                  // 使用知识目录的切片配置
                  if (category.chunk_config && Object.keys(category.chunk_config).length > 0) {
                    setChunkConfig(category.chunk_config);
                  } else {
                    initDefaultChunkConfig(category.chunk_method);
                  }
                } else {
                  // 知识目录的切片方法不可用，使用第一个可用方法
                  const defaultMethod = methodsData.available_methods[0].key;
                  setChunkMethod(defaultMethod);
                  initDefaultChunkConfig(defaultMethod);
                }
              } else {
                // 知识目录没有切片方法，使用第一个可用方法
                const defaultMethod = methodsData.available_methods[0].key;
                setChunkMethod(defaultMethod);
                initDefaultChunkConfig(defaultMethod);
              }
            } catch (error) {
              console.error('Failed to fetch available chunk methods:', error);
            }
          };
          
          fetchAvailableMethods();
        } else if (!isEdit) {
          // 非编辑模式下，模版类型没有变化，直接使用知识目录的切片方法和配置
          if (category.chunk_method) {
            setChunkMethod(category.chunk_method);
          }
          if (category.chunk_config && Object.keys(category.chunk_config).length > 0) {
            setChunkConfig(category.chunk_config);
          }
        }
        
        setPreviousTemplateType(templateType);
        
        // 更新知识目录的标签配置
        if (category.document_config?.tags && Array.isArray(category.document_config.tags)) {
          setCategoryTags(category.document_config.tags);
        } else {
          setCategoryTags([]);
        }
        
        // 如果切换到非动态章节的知识目录，清空动态章节
        const chapterType = category.document_config?.chapter_type || 'fixed';
        if (chapterType !== 'dynamic') {
          setDynamicChapters([]);
        }
      }
    }
  }, [categoryId, categories, isEdit]);

  const getDefaultSourceType = (templateType: string): string => {
    switch (templateType) {
      case 'rich_text':
        return 'rich_text';
      case 'custom_template':
        return 'custom_template';
      default:
        return 'local_document';
    }
  };

  useEffect(() => {
    if (isEdit && doc) {
      const docSourceType = doc.source_type || 'local_document';
      const docChunkMethod = doc.chunk_method || 'naive';
      const docChunkConfig = doc.chunk_config || {};
      const docTags = doc.tags || [];
      const docStatus = typeof doc.status === 'string' ? doc.status === 'active' : !!doc.status;
      const docCategoryId = doc.category_id || '';

      // 解析元数据
      const initMetadatas: Array<{ field_name: string; field_label: string; field_type: string; field_value: any }> = [];
      if (doc.metadatas) {
        try {
          const metadatasObj = typeof doc.metadatas === 'string' ? JSON.parse(doc.metadatas) : doc.metadatas;
          if (typeof metadatasObj === 'object' && metadatasObj !== null) {
            const schema = metadatasObj._schema || {};
            for (const [key, value] of Object.entries(metadatasObj)) {
              if (key === '_schema') continue;
              const fieldSchema = schema[key] || {};
              initMetadatas.push({ 
                field_name: key, 
                field_label: fieldSchema.label || '', 
                field_type: fieldSchema.type || 'text', 
                field_value: value 
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse metadatas:', e);
        }
      }

      setSourceType(docSourceType);
      setChunkMethod(docChunkMethod);
      setChunkConfig(docChunkConfig as Record<string, unknown>);
      setStatus(docStatus);
      setCategoryId(docCategoryId);
      setMetadatas([...initMetadatas]);
      setTitle(doc.title || '');
      
      // 加载document_config中的数据
      if (doc.document_config) {
        try {
          const documentConfig = typeof doc.document_config === 'string' 
            ? JSON.parse(doc.document_config) 
            : doc.document_config;
          
          // 加载自定义字段值
          if (documentConfig.custom_fields_values) {
            setCustomFieldValues(documentConfig.custom_fields_values);
          }
          
          // 加载富文本内容（从document_config.content）
          if (documentConfig.content) {
            setRichTextContent(documentConfig.content);
          }
        } catch (e) {
          console.error('Failed to parse document_config:', e);
        }
      }
      
      // 兼容旧数据：如果document_config中没有content，则从source_config加载
      if (docSourceType === 'rich_text' && doc.source_config && !richTextContent) {
        try {
          const sourceConfig = typeof doc.source_config === 'string' ? JSON.parse(doc.source_config) : doc.source_config;
          if (sourceConfig && sourceConfig.content) {
            setRichTextContent(sourceConfig.content);
          }
        } catch (e) {
          console.error('Failed to parse rich text content:', e);
        }
      }
      
      // 编辑模式下获取可用的切片方法
      if (docCategoryId) {
        const category = findCategoryById(categories, docCategoryId);
        if (category) {
          const templateType = category.document_config?.template_type || 'file';
          
          // 设置知识目录的标签
          const categoryTagList = category.document_config?.tags && Array.isArray(category.document_config.tags) 
            ? category.document_config.tags 
            : [];
          setCategoryTags(categoryTagList);
          
          // 设置用户标签（文档标签中不属于知识目录的部分）
          const userTagList = docTags.filter(tag => !categoryTagList.includes(tag));
          setUserTags(userTagList);
          
          const fetchAvailableMethods = async () => {
            try {
              const methodsData = await knowledgebaseService.getAvailableChunkMethods(undefined, '', templateType);
              setAvailableChunkMethods(methodsData.available_methods);
            } catch (error) {
              console.error('Failed to fetch available chunk methods:', error);
            }
          };
          fetchAvailableMethods();
        }
      }

      // 从 source_config 中提取数据源ID和桶名（如果是数据源类型）
      if (docSourceType === 'datasource' && doc.source_config) {
        try {
          const sourceConfig = typeof doc.source_config === 'string' ? JSON.parse(doc.source_config) : doc.source_config;
          if (sourceConfig && sourceConfig.datasource_id) {
            setSelectedDatasourceId(sourceConfig.datasource_id);
            if (sourceConfig.bucket_name) {
              setCurrentBucket(sourceConfig.bucket_name);
            }
          }
        } catch (error) {
          console.error('Failed to parse source_config:', error);
        }
      }
      
      // 从document_config中读取richTextContent和customFieldValues
      let initRichTextContent = '';
      let initCustomFieldValues: Record<string, any> = {};
      let initDynamicChapters: Chapter[] = [];
      
      if (doc.document_config) {
        try {
          const documentConfig = typeof doc.document_config === 'string' 
            ? JSON.parse(doc.document_config) 
            : doc.document_config;
          
          // 兼容旧格式：custom_fields_values
          if (documentConfig.custom_fields_values) {
            initCustomFieldValues = documentConfig.custom_fields_values;
          }
          
          // 新格式：从custom_fields中读取value
          if (documentConfig.custom_fields && Array.isArray(documentConfig.custom_fields)) {
            for (const field of documentConfig.custom_fields) {
              if (field.id && field.value !== undefined) {
                initCustomFieldValues[field.id] = field.value;
              }
            }
          }
          
          // 新格式：从chapters中读取value
          if (documentConfig.chapters && Array.isArray(documentConfig.chapters)) {
            const chapterFieldsValues: Record<string, any> = {};
            
            // 检查是否是动态章节
            const category = findCategoryById(categories, docCategoryId);
            const isDynamicChapter = category && 
              category.document_config?.template_type === 'custom_template' && 
              category.document_config?.chapter_type === 'dynamic';
            
            // 如果是动态章节，加载章节结构
            if (isDynamicChapter) {
              initDynamicChapters = documentConfig.chapters.map((chapter: any) => ({
                id: chapter.id,
                name: chapter.name,
                parentId: chapter.parentId,
                type: chapter.type,
                fields: chapter.fields,
              }));
              setDynamicChapters(initDynamicChapters);
            }
            
            for (const chapter of documentConfig.chapters) {
              if (chapter.id && chapter.value !== undefined) {
                switch (chapter.type) {
                  case 'form':
                    // 表单类型：value是对象 {"字段id":"字段值"}
                    chapterFieldsValues[chapter.id] = chapter.value;
                    break;
                  case 'list':
                    // 列表类型：value是数组 [{"字段id":"字段值"}]
                    chapterFieldsValues[chapter.id] = { list_data: chapter.value };
                    break;
                  case 'rich_text':
                    // 富文本类型：value是字符串
                    chapterFieldsValues[chapter.id] = { rich_text_content: chapter.value };
                    break;
                }
              }
            }
            
            if (Object.keys(chapterFieldsValues).length > 0) {
              initCustomFieldValues.chapter_fields_values = chapterFieldsValues;
            }
          }

          // 处理富文本章节类型：从content字段读取内容
          const category = findCategoryById(categories, docCategoryId);
          if (category && 
              category.document_config?.template_type === 'custom_template' && 
              category.document_config?.chapter_type === 'rich_text' &&
              documentConfig.content) {
            initCustomFieldValues.chapter_rich_text_content = documentConfig.content;
          }
          
          if (documentConfig.content) {
            initRichTextContent = documentConfig.content;
          }
        } catch (e) {
          console.error('Failed to parse document_config:', e);
        }
      }
      
      // 兼容旧数据：如果document_config中没有content，则从source_config加载
      if (docSourceType === 'rich_text' && !initRichTextContent && doc.source_config) {
        try {
          const sourceConfig = typeof doc.source_config === 'string' ? JSON.parse(doc.source_config) : doc.source_config;
          if (sourceConfig && sourceConfig.content) {
            initRichTextContent = sourceConfig.content;
          }
        } catch (e) {
          console.error('Failed to parse rich text content:', e);
        }
      }

      const initData = {
        sourceType: docSourceType,
        chunkMethod: docChunkMethod,
        chunkConfig: docChunkConfig as Record<string, unknown>,
        tags: docTags,
        status: docStatus,
        fileList: [], // 文件列表在编辑模式下不会重新初始化，因为文件已上传
        categoryId: docCategoryId,
        metadatas: initMetadatas,
        richTextContent: initRichTextContent,
        title: doc.title || '',
        customFieldValues: initCustomFieldValues,
        dynamicChapters: initDynamicChapters,
      };
      setOriginalData(initData);
      setCustomFieldValues(initCustomFieldValues);
      setRichTextContent(initRichTextContent);
      setIsInitialized(true);
    } else if (constants) {
      initDefaultChunkConfig('naive');
      setIsInitialized(true);
    }
  }, [doc, constants, categories]);

  const normalizeValue = (value: any): any => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number' && isNaN(value)) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const num = Number(trimmed);
      if (!isNaN(num) && trimmed === num.toString()) {
        return num;
      }
      return trimmed;
    }
    return value;
  };

  const deepCompareValues = (a: any, b: any): boolean => {
    const normA = normalizeValue(a);
    const normB = normalizeValue(b);
    
    if (normA === null && normB === null) return true;
    if (normA === null || normB === null) return false;
    
    if (typeof normA === 'number' && typeof normB === 'number') {
      return normA === normB;
    }
    
    if (Array.isArray(normA) && Array.isArray(normB)) {
      if (normA.length !== normB.length) return false;
      for (let i = 0; i < normA.length; i++) {
        if (!deepCompareValues(normA[i], normB[i])) {
          return false;
        }
      }
      return true;
    }
    
    if (typeof normA === 'object' && typeof normB === 'object') {
      const keysA = Object.keys(normA);
      const keysB = Object.keys(normB);
      const allKeys = new Set([...keysA, ...keysB]);
      for (const key of allKeys) {
        if (!deepCompareValues(normA[key], normB[key])) {
          return false;
        }
      }
      return true;
    }
    
    return normA === normB;
  };

  const compareCustomFieldValues = (current: Record<string, any>, original: Record<string, any>): boolean => {
    const allKeys = new Set([...Object.keys(current), ...Object.keys(original)]);
    for (const key of allKeys) {
      if (!deepCompareValues(current[key], original[key])) {
        return false;
      }
    }
    return true;
  };

  const fieldChanges = useMemo(() => {
    if (!isInitialized) {
      return {
        sourceType: false,
        chunkMethod: false,
        chunkConfig: false,
        tags: false,
        status: false,
        fileList: false,
        categoryId: false,
        metadatas: false,
        richTextContent: false,
        title: false,
        customFieldValues: false,
        dynamicChapters: false,
      };
    }
    return {
      sourceType: sourceType !== originalData.sourceType,
      chunkMethod: chunkMethod !== originalData.chunkMethod,
      chunkConfig: JSON.stringify(chunkConfig) !== JSON.stringify(originalData.chunkConfig),
      tags: JSON.stringify(tags) !== JSON.stringify(originalData.tags),
      status: status !== originalData.status,
      fileList: JSON.stringify(fileList) !== JSON.stringify(originalData.fileList),
      categoryId: categoryId !== originalData.categoryId,
      metadatas: JSON.stringify(metadatas) !== JSON.stringify(originalData.metadatas),
      richTextContent: richTextContent !== originalData.richTextContent,
      title: title !== originalData.title,
      customFieldValues: !compareCustomFieldValues(customFieldValues, originalData.customFieldValues),
      dynamicChapters: JSON.stringify(dynamicChapters) !== JSON.stringify(originalData.dynamicChapters),
    };
  }, [sourceType, chunkMethod, chunkConfig, tags, status, fileList, categoryId, metadatas, richTextContent, title, customFieldValues, originalData, isInitialized]);

  const changedFieldStyle = {
    border: `1px solid ${theme === 'dark' ? '#faad14' : '#faad14'}`,
    borderRadius: 4,
    padding: 8,
    margin: -8,
    backgroundColor: theme === 'dark' ? 'rgba(250, 173, 20, 0.1)' : 'rgba(250, 173, 20, 0.05)',
  };

  useEffect(() => {
    if (!constants || !isInitialized) return;
    const current = {
      sourceType,
      chunkMethod,
      chunkConfig,
      tags: [...tags],
      status,
      fileList: [...fileList],
      categoryId,
      metadatas: [...metadatas],
      richTextContent,
      title,
      customFieldValues,
      dynamicChapters: [...dynamicChapters],
    };
    const changed =
      current.sourceType !== originalData.sourceType ||
      current.chunkMethod !== originalData.chunkMethod ||
      JSON.stringify(current.chunkConfig) !== JSON.stringify(originalData.chunkConfig) ||
      JSON.stringify(current.tags) !== JSON.stringify(originalData.tags) ||
      current.status !== originalData.status ||
      JSON.stringify(current.fileList) !== JSON.stringify(originalData.fileList) ||
      current.categoryId !== originalData.categoryId ||
      JSON.stringify(current.metadatas) !== JSON.stringify(originalData.metadatas) ||
      current.richTextContent !== originalData.richTextContent ||
      current.title !== originalData.title ||
      JSON.stringify(current.customFieldValues) !== JSON.stringify(originalData.customFieldValues) ||
      JSON.stringify(current.dynamicChapters) !== JSON.stringify(originalData.dynamicChapters);
    setHasChanges(changed);
    }, [sourceType, chunkMethod, chunkConfig, tags, status, fileList, categoryId, metadatas, richTextContent, title, customFieldValues, dynamicChapters, originalData, constants, isInitialized]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEdit && hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEdit, hasChanges]);

  // 当数据源列表和选中的数据源ID都有值时，设置selectedDatasource
  useEffect(() => {
    if (selectedDatasourceId && datasources.length > 0) {
      const datasource = datasources.find(d => d.id === selectedDatasourceId);
      if (datasource) {
        setSelectedDatasource(datasource);
      }
    }
  }, [datasources, selectedDatasourceId]);

  const fetchConstants = async () => {
    try {
      const data = await knowledgebaseService.getDocumentConstants();
      setConstants(data);
      setMetadataFieldTypes(data.metadata_field_types || []);
    } catch (error) {
      console.error('Failed to fetch document constants:', error);
    }
  };

  const initDefaultChunkConfig = (method: string) => {
    if (!constants) return;
    const fields = constants.chunk_configs[method] || [];
    const defaultConfig: Record<string, unknown> = {};
    fields.forEach(field => {
      defaultConfig[field.key] = field.default;
      // 初始化子配置的默认值
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

  const handleSourceTypeChange = (type: string) => {
    setSourceType(type);
  };

  const handleChunkMethodChange = (method: string) => {
    setChunkMethod(method);
    initDefaultChunkConfig(method);
  };

  const handleChunkConfigChange = (key: string, value: unknown) => {
    setChunkConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      // 添加到用户标签
      setUserTags([...userTags, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleTagClose = (removedTag: string) => {
    // 判断是从用户标签还是知识目录标签中删除
    if (userTags.includes(removedTag)) {
      setUserTags(userTags.filter(tag => tag !== removedTag));
    } else if (categoryTags.includes(removedTag)) {
      setCategoryTags(categoryTags.filter(tag => tag !== removedTag));
    }
  };

  // 拖拽分隔线处理
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

  /**
   * 校验document_config必填项并添加value_status字段
   * @param documentConfig document_config对象
   * @returns boolean 是否所有必填项都通过校验
   */
  const validateDocumentConfigRequiredFields = (documentConfig: Record<string, any>): boolean => {
    let allPassed = true;

    // 校验自定义字段必填项
    if (documentConfig.custom_fields && Array.isArray(documentConfig.custom_fields)) {
      documentConfig.custom_fields.forEach((field: any) => {
        if (field.is_required) {
          const value = field.value;
          const isMissing = value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

          field.value_status = isMissing ? 'missing' : 'pass';
          if (isMissing) {
            allPassed = false;
          }
        }
      });
    }

    // 校验章节字段必填项
    if (documentConfig.chapters && Array.isArray(documentConfig.chapters)) {
      documentConfig.chapters.forEach((chapter: any) => {
        if (chapter.fields && Array.isArray(chapter.fields)) {
          chapter.fields.forEach((field: any) => {
            if (field.is_required) {
              let value: any;

              // 根据章节类型获取字段值
              if (chapter.type === 'form') {
                value = chapter.value && chapter.value[field.field_code];
              } else if (chapter.type === 'list' && chapter.value && Array.isArray(chapter.value)) {
                // 列表类型：检查每一行的字段值
                const hasMissingInList = chapter.value.some((rowItem: any) => {
                  const rowValue = rowItem[field.field_code];
                  return rowValue === undefined || rowValue === null || rowValue === '' ||
                    (Array.isArray(rowValue) && rowValue.length === 0) ||
                    (typeof rowValue === 'object' && !Array.isArray(rowValue) && Object.keys(rowValue).length === 0);
                });
                value = hasMissingInList ? null : 'pass'; // 列表类型特殊处理
              } else if (chapter.type === 'rich_text') {
                value = chapter.value;
              }

              const isMissing = value === undefined || value === null || value === '' ||
                (Array.isArray(value) && value.length === 0) ||
                (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

              field.value_status = isMissing ? 'missing' : 'pass';
              if (isMissing) {
                allPassed = false;
              }
            }
          });
        }
      });
    }

    // 在document_config根级别添加value_status字段，表示整体校验状态
    documentConfig.value_status = allPassed ? 'pass' : 'missing';

    return allPassed;
  };

  /**
   * 智能提取前保存知识（仅校验标题并保存基础信息）
   * @returns Promise<{success: boolean; knowledgeId?: string}> 是否成功保存，以及真实的knowledgeId
   */
  const handleSaveBeforeExtract = async (): Promise<{success: boolean; knowledgeId?: string}> => {
    // 校验标题
    if (!title.trim()) {
      message.error('请输入知识标题');
      return {success: false};
    }

    // 构建document_config对象
    const documentConfig: Record<string, any> = {};

    // 如果选择了知识目录，构建document_config
    if (categoryId) {
      const category = findCategoryById(categories, categoryId);
      if (category && category.document_config?.template_type === 'custom_template') {
        const categoryDocConfig = category.document_config;

        // 合并字段定义
        const categoryFields = categoryDocConfig.custom_fields || [];
        const allCustomFields = [...categoryFields];
        const existingFieldIds = new Set(allCustomFields.map((f: any) => f.id));
        extraCustomFields.forEach(f => {
          if (f.id && !existingFieldIds.has(f.id)) {
            allCustomFields.push(f);
          }
        });

        if (allCustomFields.length > 0) {
          documentConfig.custom_fields = allCustomFields.map((field: any) => {
            let value = customFieldValues[field.id];
            if (value === undefined || value === null) {
              if (field.default_value !== undefined && field.default_value !== null) {
                value = field.default_value;
              } else {
                switch (field.field_type) {
                  case 'object':
                    value = {};
                    break;
                  case 'array':
                    value = [];
                    break;
                  default:
                    value = null;
                }
              }
            }
            return {
              ...field,
              value,
            };
          });
        }

        // 处理章节
        if (categoryDocConfig.chapters && categoryDocConfig.chapters.length > 0) {
          const chapterFieldsValues = customFieldValues.chapter_fields_values || {};

          documentConfig.chapters = categoryDocConfig.chapters.map((chapter: any) => {
            const chapterValue = chapterFieldsValues[chapter.id] || {};
            let value: any = null;

            switch (chapter.type) {
              case 'form':
                value = {};
                if (chapter.fields && chapter.fields.length > 0) {
                  for (const field of chapter.fields) {
                    let fieldValue = chapterValue[field.id];
                    if (fieldValue === undefined || fieldValue === null) {
                      if (field.default_value !== undefined && field.default_value !== null) {
                        fieldValue = field.default_value;
                      } else {
                        switch (field.field_type) {
                          case 'object':
                            fieldValue = {};
                            break;
                          case 'array':
                            fieldValue = [];
                            break;
                          default:
                            fieldValue = null;
                        }
                      }
                    }
                    value[field.id] = fieldValue;
                  }
                }
                break;
              case 'list':
                value = chapterValue.list_data || [];
                break;
              case 'rich_text':
                value = chapterValue.rich_text_content || '';
                break;
            }

            return {
              ...chapter,
              value,
            };
          });
        }

        // 处理富文本章节类型
        if (categoryDocConfig.chapter_type === 'rich_text') {
          documentConfig.content = customFieldValues.chapter_rich_text_content || '';
        }
      }
    }

    // 如果是富文本类型，添加content字段
    if (sourceType === 'rich_text') {
      documentConfig.content = richTextContent;
    }

    // 校验document_config必填项并添加value_status字段
    if (Object.keys(documentConfig).length > 0) {
      validateDocumentConfigRequiredFields(documentConfig);
    }

    // 保存知识
    try {
      const metadatasObj: Record<string, any> = {};
      const schema: Record<string, { type: string; label: string }> = {};
      for (const item of metadatas) {
        if (item.field_name) {
          metadatasObj[item.field_name] = item.field_value;
          schema[item.field_name] = {
            type: item.field_type,
            label: item.field_label,
          };
        }
      }

      const documentData: any = {
        kb_id: knowledgebase.id,
        title: title.trim(),
        tags: tags,
        chunk_method: chunkMethod || 'naive',
        chunk_config: chunkConfig,
        category_id: categoryId || undefined,
        source_type: sourceType,
        source_config: sourceType === 'datasource' ? {
          datasource_id: selectedDatasourceId,
          config: selectedDatasource?.type === 'file_storage' ? {
            files: selectedFiles.map(f => f.path)
          } : undefined
        } : undefined,
        metadatas: Object.keys(metadatasObj).length > 0 ? JSON.stringify(metadatasObj) : undefined,
        schema: Object.keys(schema).length > 0 ? JSON.stringify(schema) : undefined,
        document_config: Object.keys(documentConfig).length > 0 ? documentConfig : undefined,
        status: status,
      };

      // 新增知识
      const savedDoc = await knowledgebaseService.createDocument(knowledgebase.id, documentData);
      message.success('知识保存成功');

      // 返回真实的knowledgeId
      return {success: true, knowledgeId: savedDoc.id};
    } catch (error) {
      console.error('保存知识失败:', error);
      message.error('保存知识失败');
      return {success: false};
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      message.error('请输入知识标题');
      return;
    }
    if (!sourceType) {
      message.error('请选择数据来源');
      return;
    }
    if (!chunkMethod) {
      message.error('请选择切片方法');
      return;
    }
    if (!isEdit && sourceType === 'local_document' && fileList.length === 0) {
      message.error('请上传文档');
      return;
    }
    if (!isEdit && sourceType === 'rich_text' && !richTextContent.trim()) {
      message.error('请输入知识内容');
      return;
    }
    if (!isEdit && sourceType === 'datasource') {
      const isFileStorage = selectedDatasource && ['s3', 'minio', 'rustfs'].includes(selectedDatasource.type);
      if (isFileStorage && selectedFiles.length === 0) {
        message.error('请至少选择一个文件');
        return;
      }
    }

    // 构建document_config对象
    const documentConfig: Record<string, any> = {};

    // 如果是自定义模版类型，按照知识目录的document_config格式构建
    if (categoryId) {
      const category = findCategoryById(categories, categoryId);
      if (category && category.document_config?.template_type === 'custom_template') {
        const categoryDocConfig = category.document_config;
        
        // 编辑时优先从数据集的document_config获取字段定义
        let docDocConfig: any = null;
        if (isEdit && doc?.document_config) {
          try {
            docDocConfig = typeof doc.document_config === 'string' 
              ? JSON.parse(doc.document_config) 
              : doc.document_config;
          } catch (e) {
            console.error('Failed to parse doc document_config:', e);
          }
        }
        
        // 合并字段定义：数据集字段 + 目录中存在但数据集中没有的字段 + 智能提取新增的字段
        const categoryFields = categoryDocConfig.custom_fields || [];
        const docFields = docDocConfig?.custom_fields || [];
        const docFieldIds = new Set(docFields.map((f: any) => f.id));
        const allCustomFields = [...docFields, ...categoryFields.filter((f: any) => !docFieldIds.has(f.id))];
        // 合并智能提取新增的字段
        const existingFieldIds = new Set(allCustomFields.map((f: any) => f.id));
        extraCustomFields.forEach(f => {
          if (f.id && !existingFieldIds.has(f.id)) {
            allCustomFields.push(f);
          }
        });
        if (allCustomFields.length > 0) {
          documentConfig.custom_fields = allCustomFields.map((field: any) => {
            let value = customFieldValues[field.id];
            if (value === undefined || value === null) {
              if (field.default_value !== undefined && field.default_value !== null) {
                value = field.default_value;
              } else {
                switch (field.field_type) {
                  case 'object':
                    value = {};
                    break;
                  case 'array':
                    value = [];
                    break;
                  default:
                    value = null;
                }
              }
            }
            return {
              ...field,
              value,
            };
          });
        }
        
        // 复制chapters，并为每个章节添加value属性
        if (categoryDocConfig.chapters && categoryDocConfig.chapters.length > 0) {
          const chapterFieldsValues = customFieldValues.chapter_fields_values || {};
          
          documentConfig.chapters = categoryDocConfig.chapters.map((chapter: any) => {
            const chapterValue = chapterFieldsValues[chapter.id] || {};
            let value: any = null;
            
            switch (chapter.type) {
              case 'form':
                // 表单类型：value是对象 {"字段id":"字段值"}
                value = {};
                if (chapter.fields && chapter.fields.length > 0) {
                  for (const field of chapter.fields) {
                    let fieldValue = chapterValue[field.id];
                    if (fieldValue === undefined || fieldValue === null) {
                      if (field.default_value !== undefined && field.default_value !== null) {
                        fieldValue = field.default_value;
                      } else {
                        switch (field.field_type) {
                          case 'object':
                            fieldValue = {};
                            break;
                          case 'array':
                            fieldValue = [];
                            break;
                          default:
                            fieldValue = null;
                        }
                      }
                    }
                    value[field.id] = fieldValue;
                  }
                }
                break;
              case 'list':
                // 列表类型：value是数组 [{"字段id":"字段值"}]
                value = chapterValue.list_data || [];
                break;
              case 'rich_text':
                // 富文本类型：value是字符串
                value = chapterValue.rich_text_content || '';
                break;
            }
            
            return {
              ...chapter,
              value,
            };
          });
        }
        
        // 处理动态章节
        if (categoryDocConfig.chapter_type === 'dynamic' && dynamicChapters.length > 0) {
          const chapterFieldsValues = customFieldValues.chapter_fields_values || {};
          
          documentConfig.chapters = dynamicChapters.map((chapter: any) => {
            const chapterValue = chapterFieldsValues[chapter.id] || {};
            let value: any = null;
            
            switch (chapter.type) {
              case 'form':
                // 表单类型：value是对象 {"字段id":"字段值"}
                value = {};
                if (chapter.fields && chapter.fields.length > 0) {
                  for (const field of chapter.fields) {
                    let fieldValue = chapterValue[field.id];
                    if (fieldValue === undefined || fieldValue === null) {
                      if (field.default_value !== undefined && field.default_value !== null) {
                        fieldValue = field.default_value;
                      } else {
                        switch (field.field_type) {
                          case 'object':
                            fieldValue = {};
                            break;
                          case 'array':
                            fieldValue = [];
                            break;
                          default:
                            fieldValue = null;
                        }
                      }
                    }
                    value[field.id] = fieldValue;
                  }
                }
                break;
              case 'list':
                // 列表类型：value是数组 [{"字段id":"字段值"}]
                value = chapterValue.list_data || [];
                break;
              case 'rich_text':
                // 富文本类型：value是字符串
                value = chapterValue.rich_text_content || '';
                break;
            }
            
            return {
              ...chapter,
              value,
            };
          });
        }

        // 处理富文本章节类型
        if (categoryDocConfig.chapter_type === 'rich_text') {
          documentConfig.content = customFieldValues.chapter_rich_text_content || '';
        }
      }
    }
    
    // 如果是富文本类型，添加content字段
    if (sourceType === 'rich_text') {
      documentConfig.content = richTextContent;
    }

    // 校验document_config必填项并添加value_status字段
    if (Object.keys(documentConfig).length > 0) {
      validateDocumentConfigRequiredFields(documentConfig);
    }

    setSaving(true);
    try {
      if (isEdit && doc) {
          // 保存元数据
          if (metadatas.length > 0) {
            const metadatasObj: Record<string, any> = {};
            const schema: Record<string, { type: string; label: string }> = {};
            for (const item of metadatas) {
              if (item.field_name) {
                metadatasObj[item.field_name] = item.field_value;
                schema[item.field_name] = {
                  type: item.field_type,
                  label: item.field_label,
                };
              }
            }
            metadatasObj._schema = schema;
            try {
              await knowledgebaseService.updateDocumentMetadata(knowledgebase.id, doc.id, metadatasObj);
            } catch (e) {
              console.error('Failed to save metadatas:', e);
            }
          }

          await knowledgebaseService.updateDocument(knowledgebase.id, doc.id, {
            chunk_method: chunkMethod,
            chunk_config: chunkConfig,
            tags,
            status: status,
            category_id: categoryId || undefined,
            title: title.trim(),
            document_config: Object.keys(documentConfig).length > 0 ? documentConfig : undefined,
          });
          message.success('保存成功');
        } else {
        if (sourceType === 'local_document') {
          const files = fileList.map(f => fileMapRef.current.get(f.uid)).filter(Boolean) as File[];
          console.log('准备上传的文件:', files);
          const result = await knowledgebaseService.uploadDocuments(
            knowledgebase.id,
            files,
            sourceType,
            categoryId || undefined,
            chunkMethod,
            chunkConfig,
            tags,
            status,
            title.trim(),
            Object.keys(documentConfig).length > 0 ? documentConfig : undefined
          );
          if (result.errors && result.errors.length > 0) {
            message.warning(`${result.errors.length}个文件上传失败`);
          }
          message.success('创建成功');
        } else if (sourceType === 'rich_text') {
          // 富文本类型：创建单个数据集记录
          
          await knowledgebaseService.createDocument(knowledgebase.id, {
            kb_id: knowledgebase.id,
            chunk_method: chunkMethod,
            chunk_config: chunkConfig,
            tags,
            source_type: 'rich_text',
            status: status,
            category_id: categoryId || undefined,
            title: title.trim(),
            document_config: documentConfig,
          } as Partial<KnowledgebaseDocument>);
          
          message.success('创建成功');
        } else if (sourceType === 'custom_template') {
          // 自定义模版类型：创建单个数据集记录
          
          await knowledgebaseService.createDocument(knowledgebase.id, {
            kb_id: knowledgebase.id,
            chunk_method: chunkMethod,
            chunk_config: chunkConfig,
            tags,
            source_type: 'custom_template',
            status: status,
            category_id: categoryId || undefined,
            title: title.trim(),
            document_config: documentConfig,
          } as Partial<KnowledgebaseDocument>);
          
          message.success('创建成功');
        } else if (sourceType === 'datasource') {
          if (selectedDatasource) {
            const isFileStorage = ['s3', 'minio', 'rustfs'].includes(selectedDatasource.type);
            const isRelationalDb = ['mysql', 'postgresql', 'oracle', 'sql_server'].includes(selectedDatasource.type);
            
            if (isFileStorage) {
              // 文件存储类型：为每个已选择的文件创建一个单独的数据集记录
              // 根据 SourceConfigDefinition.FILE_STORAGE_CONFIG 定义字段
              for (const filePath of selectedFiles) {
                // 从 allFiles 数组中找到对应的文件信息
                const file = allFiles.find(f => f.path === filePath);
                
                // 从后端获取的 source_configs 字段定义
                const fileStorageConfigFields = constants?.source_configs?.datasource?.file_storage || [];
                const sourceConfig: any = {};
                
                // 根据字段定义构建 sourceConfig
                fileStorageConfigFields.forEach(field => {
                  switch (field.key) {
                    case 'datasource_id':
                      sourceConfig[field.key] = selectedDatasourceId;
                      break;
                    case 'bucket_name':
                      sourceConfig[field.key] = currentBucket;
                      break;
                    case 'location':
                      sourceConfig[field.key] = filePath;
                      break;
                    case 'selected_files':
                      sourceConfig[field.key] = JSON.stringify([filePath]);
                      break;
                    default:
                      // 如果有其他字段，可以在这里添加
                      break;
                  }
                });
                
                // 从文件路径中提取文件名
                const fileName = filePath.split('/').pop() || filePath;
                
                await knowledgebaseService.createDocument(knowledgebase.id, {
                  kb_id: knowledgebase.id,
                  chunk_method: chunkMethod,
                  chunk_config: chunkConfig,
                  tags,
                  source_type: 'datasource',  // 固定为 'datasource'
                  source_config: sourceConfig,
                  status: status,
                  category_id: categoryId || undefined,
                  // 添加文件相关字段（file_type 和 mime_type 由后端自动生成）
                  file_name: fileName,
                  location: filePath,
                  // 从文件列表中获取 thumbnail 和 file_size
                  thumbnail: file?.thumbnail || null,
                  file_size: file?.size || 0,
                } as Partial<KnowledgebaseDocument>);
              }
              message.success(`成功创建 ${selectedFiles.length} 个数据集`);
            } else if (isRelationalDb) {
              // 关系型数据库类型：创建单个数据集记录
              // 根据 SourceConfigDefinition.RELATIONAL_DATABASE_CONFIG 定义字段
              // 从后端获取的 source_configs 字段定义
              const relationalDbConfigFields = constants?.source_configs?.datasource?.relational_database || [];
              const sourceConfig: any = {};
              
              // 根据字段定义构建 sourceConfig
              relationalDbConfigFields.forEach(field => {
                switch (field.key) {
                  case 'datasource_id':
                    sourceConfig[field.key] = selectedDatasourceId;
                    break;
                  case 'table_name':
                    sourceConfig[field.key] = selectedTable;
                    break;
                  case 'column_names':
                    sourceConfig[field.key] = []; // 可选：字段列表（TODO: 添加字段选择支持）
                    break;
                  case 'where_clause':
                    sourceConfig[field.key] = ''; // 可选：WHERE条件（TODO: 添加WHERE条件输入支持）
                    break;
                  default:
                    // 如果有其他字段，可以在这里添加
                    break;
                }
              });
              
              await knowledgebaseService.createDocument(knowledgebase.id, {
                kb_id: knowledgebase.id,
                chunk_method: chunkMethod,
                chunk_config: chunkConfig,
                tags,
                source_type: sourceType,
                source_config: sourceConfig,
                status: status,
                category_id: categoryId || undefined,
              } as Partial<KnowledgebaseDocument>);
              message.success('创建成功');
            }
          }
        } else {
          await knowledgebaseService.createDocument(knowledgebase.id, {
            kb_id: knowledgebase.id,
            chunk_method: chunkMethod,
            chunk_config: chunkConfig,
            tags,
            source_type: sourceType,
            status: status,
            category_id: categoryId || undefined,
          } as Partial<KnowledgebaseDocument>);
          message.success('创建成功');
        }
      }
      onSave();
    } catch (error) {
      console.error('Failed to save document:', error);
      // 错误信息已经在 request.ts 中处理并显示
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = () => {
    setSourceType(originalData.sourceType);
    setChunkMethod(originalData.chunkMethod);
    setChunkConfig(originalData.chunkConfig);
    // 恢复时，将 originalData.tags 中不属于 categoryTags 的部分作为 userTags
    const restoredUserTags = originalData.tags.filter(tag => !categoryTags.includes(tag));
    setUserTags(restoredUserTags);
    setStatus(originalData.status);
    setCategoryId(originalData.categoryId);
    setFileList([]);
    setMetadatas([...originalData.metadatas]);
    setRichTextContent(originalData.richTextContent);
    setTitle(originalData.title);
    setCustomFieldValues(originalData.customFieldValues);
    setDynamicChapters([...originalData.dynamicChapters]);
  };

  const renderSourceTypes = () => {
    if (!constants) return null;
    
    // 获取当前分类的知识模版类型
    const getCurrentTemplateType = () => {
      if (!categoryId) return 'file';
      const category = findCategoryById(categories, categoryId);
      return category?.document_config?.template_type || 'file';
    };
    
    const templateType = getCurrentTemplateType();
    
    // 富文本或自定义模版时隐藏数据来源配置项
    if (templateType === 'rich_text' || templateType === 'custom_template') {
      return null;
    }
    
    // 根据知识模版类型过滤数据来源
    const filterSourceTypes = (st: any) => {
      // 编辑模式下只显示当前数据源
      if (isEdit) {
        return st.key === sourceType;
      }
      
      // 根据知识模版类型过滤
      switch (templateType) {
        case 'rich_text':
          return st.key === 'rich_text';
        case 'custom_template':
          return st.key === 'custom_template';
        case 'chapter':
          return ['local_document', 'datasource'].includes(st.key);
        default: // file
          return ['local_document', 'datasource'].includes(st.key);
      }
    };
    
    return (
      <div style={{ ...(isEdit && fieldChanges.sourceType ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          数据来源 <span style={{ color: '#ff4d4f' }}>*</span>
          {isEdit && fieldChanges.sourceType && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {constants.source_types
            .filter(filterSourceTypes)
            .map(st => {
              // 根据分类的模板类型确定应该选中的数据来源
              const effectiveSourceType = categoryId && !isEdit ? getDefaultSourceType(templateType) : sourceType;
              const isSelected = effectiveSourceType === st.key;
              const isDisabled = isEdit; // 编辑模式下禁用修改
              
              // 计算卡片宽度：文件类型时占满一行，其他类型固定宽度
              const filteredCount = constants.source_types.filter(filterSourceTypes).length;
              const cardWidth = (templateType === 'file' || templateType === 'chapter') && filteredCount <= 2
                ? 'calc(50% - 8px)'
                : 140;
              
              return (
                <Tooltip key={st.key} title={isDisabled ? (isEdit ? '编辑模式下不可修改' : st.label) : st.label}>
                  <div
                    onClick={() => !isDisabled && handleSourceTypeChange(st.key)}
                    style={{
                      width: cardWidth,
                      padding: '16px 12px',
                      borderRadius: 8,
                      border: `2px solid ${isSelected ? 'var(--primary-color)' : theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#e8e8e8'}`,
                      background: isSelected
                        ? theme === 'dark' ? 'rgba(102,126,234,0.15)' : 'rgba(102,126,234,0.08)'
                        : theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ color: isSelected ? 'var(--primary-color)' : theme === 'dark' ? '#aaa' : '#666' }}>
                      {SOURCE_TYPE_ICONS[st.key]}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: isSelected ? 'var(--primary-color)' : theme === 'dark' ? '#ccc' : '#666',
                      fontWeight: isSelected ? 600 : 400,
                    }}>
                      {st.label}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
        </div>
      </div>
    );
  };

  const renderUploadArea = () => {
    if (sourceType !== 'local_document') return null;
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          上传文档 <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <div style={{ width: '100%' }}>
          {!isEdit ? (
            <Upload.Dragger
              multiple
              beforeUpload={(file) => {
                const isExe = file.name.toLowerCase().endsWith('.exe');
                if (isExe) {
                  message.error('不支持上传可执行文件（.exe）');
                  return false;
                }
                fileMapRef.current.set(file.uid, file);
                setFileList(prev => {
                  const newFileList = [...prev, { uid: file.uid, name: file.name, size: file.size }];
                  // 如果是第一个上传的文件且标题为空，自动填充标题（去掉文件后缀）
                  if (prev.length === 0 && !title.trim()) {
                    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    setTitle(fileNameWithoutExt);
                  }
                  return newFileList;
                });
                return false;
              }}
              onRemove={(file) => {
                fileMapRef.current.delete(file.uid);
                setFileList(prev => prev.filter(f => f.uid !== file.uid));
              }}
              showUploadList={true}
              fileList={fileList.map(f => ({
                uid: f.uid,
                name: f.name,
                status: 'done',
                size: f.size
              }))}
              itemRender={(originNode, file) => renderFileItem(originNode, file)}
              style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
                border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#d9d9d9'}`,
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: 'var(--primary-color)', fontSize: 40 }} />
              </p>
              <p style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                点击或拖拽文件到此区域上传
              </p>
              <p style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                支持上传文档、图片或音频文件
              </p>
            </Upload.Dragger>
          ) : (
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
              color: theme === 'dark' ? '#ccc' : '#666',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <span style={{ fontSize: 24, marginTop: 2 }}>{getFileIcon(doc?.file_name || '')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333' }}>
                  {doc?.file_name || '已上传文档'}
                </span>
                {doc?.location && (
                  <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                    路径: {doc.location}
                  </span>
                )}
                {doc?.file_size && doc.file_size > 0 && (
                  <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                    大小: {formatFileSize(doc.file_size)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDatasourceSelector = () => {
    if (sourceType !== 'datasource') return null;
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          选择数据源 <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <div style={{ width: '100%' }}>
          <Select
            value={selectedDatasourceId}
            onChange={handleDatasourceSelect}
            placeholder="请选择数据源"
            loading={datasourceLoading}
            disabled={isEdit}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          >
            {datasources.map(ds => (
              <Select.Option key={ds.id} value={ds.id} label={ds.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DatabaseOutlined />
                  <span>{ds.name}</span>
                  <Tag size="small" style={{ marginLeft: 8 }}>
                    {constants?.source_types?.find(st => st.key === ds.type)?.label || ds.type}
                  </Tag>
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>
    );
  };

  const renderRichTextEditor = () => {
    if (sourceType !== 'rich_text') return null;
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.richTextContent ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            知识内容 <span style={{ color: '#ff4d4f' }}>*</span>
            {isEdit && fieldChanges.richTextContent && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
          </div>
          <Button
            type="primary"
            icon={isExtracting ? <LoadingOutlined /> : <ThunderboltOutlined />}
            size="small"
            onClick={() => setShowIntelligentExtract(true)}
            style={{ marginLeft: 8 }}
          >
            {isExtracting ? '提取中...' : '智能提取'}
          </Button>
        </div>
        <div style={{ width: '100%' }}>
          <MDEditor
            value={richTextContent}
            onChange={(val) => setRichTextContent(val || '')}
            height={250}
            preview="edit"
          />
        </div>
      </div>
    );
  };

  const renderFileBrowser = () => {
    if (sourceType !== 'datasource') return null;
    
    // 编辑模式下显示文件信息，不需要依赖selectedDatasource
    if (isEdit && doc) {
      // 解析source_config获取桶名
      let bucketName = '';
      try {
        if (doc.source_config) {
          const sourceConfig = typeof doc.source_config === 'string' ? JSON.parse(doc.source_config) : doc.source_config;
          if (sourceConfig && sourceConfig.bucket_name) {
            bucketName = sourceConfig.bucket_name;
          }
        }
      } catch (error) {
        console.error('Failed to parse source_config for bucket name:', error);
      }

      return (
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
            文件信息
          </div>
          <div style={{ width: '100%' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
              color: theme === 'dark' ? '#ccc' : '#666',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <span style={{ fontSize: 24, marginTop: 2 }}>{getFileIcon(doc.file_name || '')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333' }}>
                  {doc.file_name || '已上传文件'}
                </span>
                {bucketName && (
                  <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                    桶名: {bucketName}
                  </span>
                )}
                {doc.location && (
                  <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                    路径: {doc.location}
                  </span>
                )}
                {doc.file_size > 0 && (
                  <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                    大小: {formatFileSize(doc.file_size)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // 非编辑模式需要selectedDatasource
    if (!selectedDatasource) return null;
    const isFileStorage = ['s3', 'minio', 'rustfs'].includes(selectedDatasource.type);
    if (!isFileStorage) return null;
    
    // 计算分页数据
    const totalItems = directories.length + files.length;
    const startIndex = (fileCurrentPage - 1) * filePageSize;
    const endIndex = startIndex + filePageSize;
    
    // 先显示目录，再显示文件
    const paginatedDirectories = directories.slice(
      Math.max(0, startIndex), 
      Math.min(directories.length, endIndex)
    );
    const paginatedFiles = files.slice(
      Math.max(0, startIndex - directories.length), 
      Math.min(files.length, endIndex - directories.length)
    );
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          文件浏览
        </div>
        <div style={{ width: '100%' }}>
          {/* 搜索框 */}
          <div style={{ marginBottom: 8 }}>
            <Input
              placeholder="搜索文件或目录名称"
              value={fileSearchKeyword}
              onChange={(e) => {
                const keyword = e.target.value;
                setFileSearchKeyword(keyword);
                setFileCurrentPage(1); // 搜索时重置页码
                // 调用后端接口搜索
                loadFileList(selectedDatasourceId, currentBucket || undefined, currentPath || undefined, keyword);
              }}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
          
          <div style={{ 
            width: '100%',
            maxHeight: 400,
            overflowY: 'auto',
            padding: 16,
            borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
          }}>
            {fileBrowserLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Spin size="large" />
              </div>
            ) : directories.length === 0 && files.length === 0 ? (
              <Empty description={fileSearchKeyword ? "未找到匹配的文件或目录" : "暂无文件"} />
            ) : (
              <div>
                {/* 面包屑导航 */}
                <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#d9d9d9'}` }}>
                  {currentBucket ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button 
                        type="text" 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => {
                          // 返回到桶列表
                          setCurrentBucket('');
                          setCurrentPath('');
                          setFileSearchKeyword('');
                          setFileCurrentPage(1);
                          loadFileList(selectedDatasourceId, undefined, undefined);
                        }}
                      >
                        返回桶列表
                      </Button>
                      {currentPath && (
                        <>
                          <Button 
                            type="text" 
                            icon={<ArrowLeftOutlined />} 
                            onClick={() => {
                              // 返回上级目录
                              const pathParts = currentPath.split('/').filter(part => part);
                              if (pathParts.length > 0) {
                                pathParts.pop();
                                const parentPath = pathParts.join('/');
                                setFileSearchKeyword('');
                                setFileCurrentPage(1);
                                loadFileList(selectedDatasourceId, currentBucket, parentPath || undefined);
                              }
                            }}
                          >
                            返回上级目录
                          </Button>
                        </>
                      )}
                      <span style={{ color: theme === 'dark' ? '#888' : '#999' }}>|</span>
                      <span style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                        桶: {currentBucket}
                      </span>
                      {currentPath && (
                        <>
                          <span style={{ color: theme === 'dark' ? '#888' : '#999' }}>/</span>
                          <span style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                            {currentPath}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: theme === 'dark' ? '#ccc' : '#666' }}>
                      请选择一个桶
                    </div>
                  )}
                </div>
                
                {/* 目录和文件列表 */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 8 
                }}>
                  {/* 目录列表 */}
                  {paginatedDirectories.map((dir, index) => (
                    <div
                      key={`dir-${index}`}
                      onClick={() => handleDirectoryClick(dir)}
                      style={{
                        padding: 12,
                        borderRadius: 4,
                        background: theme === 'dark' ? 'rgba(102,126,234,0.1)' : 'rgba(102,126,234,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.2s',
                      }}
                    >
                      <FolderOutlined style={{ color: 'var(--primary-color)' }} />
                      <span style={{ flex: 1, color: theme === 'dark' ? '#ccc' : '#666' }}>
                        {dir.name}
                      </span>
                      <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                        {dir.type === 'bucket' ? '桶' : '目录'}
                      </span>
                    </div>
                  ))}
                  {/* 文件列表 */}
                  {paginatedFiles.map((file, index) => (
                    <div
                      key={`file-${index}`}
                      style={{
                        padding: 12,
                        borderRadius: 4,
                        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.path)}
                        onChange={(e) => handleFileSelect(file, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      {getFileIcon(file.name)}
                      <span style={{ flex: 1, color: theme === 'dark' ? '#ccc' : '#666' }}>
                        {file.name}
                      </span>
                      <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12, minWidth: 80 }}>
                        {file.size ? formatFileSize(file.size) : '-'}
                      </span>
                      <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12, minWidth: 150 }}>
                        {formatDateTime(file.last_modified)}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* 分页 */}
                {totalItems > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                        共 {totalItems} 项
                      </span>
                      {/* 始终显示分页按钮 */}
                      <Button
                        size="small"
                        disabled={fileCurrentPage === 1}
                        onClick={() => setFileCurrentPage(prev => prev - 1)}
                      >
                        上一页
                      </Button>
                      <span style={{ color: theme === 'dark' ? '#ccc' : '#666', fontSize: 12 }}>
                        第 {fileCurrentPage} / {Math.ceil(totalItems / filePageSize)} 页
                      </span>
                      <Button
                        size="small"
                        disabled={fileCurrentPage >= Math.ceil(totalItems / filePageSize)}
                        onClick={() => setFileCurrentPage(prev => prev + 1)}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* 已选择文件列表 */}
        {selectedFiles.length > 0 && (
          <div style={{ marginTop: 16, width: '50%' }}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
              已选择文件 ({selectedFiles.length})
            </div>
            <div style={{ 
              width: '100%',
              maxHeight: 200,
              overflowY: 'auto',
              padding: 16,
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
            }}>
              {selectedFiles.map((filePath, index) => {
                const file = allFiles.find(f => f.path === filePath);
                return (
                  <div
                    key={`selected-${index}`}
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      borderRadius: 4,
                      background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                      border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {file ? getFileIcon(file.name) : <FileOutlined style={{ color: '#8c8c8c' }} />}
                    <span style={{ flex: 1, color: theme === 'dark' ? '#ccc' : '#666' }}>
                      {getFileName(filePath)}
                    </span>
                    {file && file.size && (
                      <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                        {formatFileSize(file.size)}
                      </span>
                    )}
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveSelectedFile(filePath)}
                      danger
                      size="small"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTableBrowser = () => {
    if (sourceType !== 'datasource' || !selectedDatasource) return null;
    const isRelationalDb = ['mysql', 'postgresql', 'oracle', 'sql_server'].includes(selectedDatasource.type);
    if (!isRelationalDb) return null;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          表浏览
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ 
              width: '100%',
              maxHeight: 400,
              overflowY: 'auto',
              padding: 16,
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
            }}>
              {tableBrowserLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <Spin size="large" />
                </div>
              ) : tables.length === 0 ? (
                <Empty description="暂无表" />
              ) : (
                <List
                  dataSource={tables}
                  renderItem={(table) => (
                    <List.Item
                      onClick={() => handleTableClick(table.table_name)}
                      style={{ 
                        cursor: 'pointer',
                        background: selectedTable === table.table_name 
                          ? (theme === 'dark' ? 'rgba(102,126,234,0.2)' : 'rgba(102,126,234,0.1)') 
                          : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TableOutlined />
                        <span>{table.table_name}</span>
                        {table.table_comment && (
                          <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                            - {table.table_comment}
                          </span>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Col>
          <Col span={12}>
            <div style={{ 
              width: '100%',
              maxHeight: 400,
              overflowY: 'auto',
              padding: 16,
              borderRadius: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
            }}>
              {!selectedTable ? (
                <Empty description="请选择一个表查看字段" />
              ) : tableColumns.length === 0 ? (
                <Empty description="暂无字段" />
              ) : (
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>
                    {selectedTable} - 字段信息
                  </div>
                  <List
                    dataSource={tableColumns}
                    renderItem={(col) => (
                      <List.Item>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 500 }}>{col.column_name}</span>
                            <Tag size="small">{col.column_type}</Tag>
                            {col.is_nullable === 'YES' && <Tag size="small" color="blue">可空</Tag>}
                            {col.column_key && <Tag size="small" color="orange">{col.column_key}</Tag>}
                          </div>
                          {col.column_comment && (
                            <span style={{ fontSize: 12, color: theme === 'dark' ? '#888' : '#999' }}>
                              {col.column_comment}
                            </span>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </div>
          </Col>
        </Row>
      </div>
    );
  };

  const renderChunkMethodSelect = () => {
    // 如果有可用的切片方法列表，则使用它；否则使用全部切片方法
    const displayMethods = availableChunkMethods.length > 0 ? availableChunkMethods : constants?.chunk_methods || [];
    
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.chunkMethod ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          切片方法 <span style={{ color: '#ff4d4f' }}>*</span>
          {isEdit && fieldChanges.chunkMethod && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <Select
          value={chunkMethod}
          onChange={handleChunkMethodChange}
          style={{ width: '100%', background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff' }}
          placeholder="请选择切片方法"
        >
          {displayMethods.map(cm => (
            <Select.Option key={cm.key} value={cm.key}>{cm.label}</Select.Option>
          ))}
        </Select>
      </div>
    );
  };

  const renderChunkConfigFields = () => {
    const fields = constants?.chunk_configs?.[chunkMethod] || [];
    if (fields.length === 0) return null;

    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.chunkConfig ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 12, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          切片配置
          {isEdit && fieldChanges.chunkConfig && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <div style={{ 
          width: '100%',
          padding: 16,
          borderRadius: 8,
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
        }}>
          {fields.map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <div style={{ 
                marginBottom: 4,
                fontSize: 13,
                color: theme === 'dark' ? '#ccc' : '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                justifyContent: 'flex-start',
              }}>
                {field.label}
                {field.description && (
                  <Tooltip title={field.description}>
                    <span style={{ color: theme === 'dark' ? '#666' : '#999', fontSize: 12, cursor: 'help' }}>[?]</span>
                  </Tooltip>
                )}
              </div>
              <div style={{ width: '100%' }}>
                {renderConfigField(field)}
              </div>
              {/* 渲染子配置 */}
              {field.sub_configs && field.field_type === 'select' && (
                <div style={{ marginTop: 12, marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` }}>
                  {field.sub_configs[chunkConfig[field.key] as string]?.map(subField => (
                    <div key={subField.key} style={{ marginBottom: 12 }}>
                      <div style={{ 
                        marginBottom: 4,
                        fontSize: 13,
                        color: theme === 'dark' ? '#ccc' : '#666',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        justifyContent: 'flex-start',
                      }}>
                        {subField.label}
                        {subField.description && (
                          <Tooltip title={subField.description}>
                            <span style={{ color: theme === 'dark' ? '#666' : '#999', fontSize: 12, cursor: 'help' }}>[?]</span>
                          </Tooltip>
                        )}
                      </div>
                      <div style={{ width: '100%' }}>
                        {renderConfigField(subField)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderConfigField = (field: ChunkConfigFieldDef) => {
    const value = chunkConfig[field.key] ?? field.default;

    switch (field.field_type) {
      case 'slider':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Slider
              min={field.min_value}
              max={field.max_value}
              step={field.step || 1}
              value={value as number}
              onChange={v => handleChunkConfigChange(field.key, v)}
              style={{ flex: 1 }}
            />
            <InputNumber
              min={field.min_value}
              max={field.max_value}
              step={field.step || 1}
              value={value as number}
              onChange={v => handleChunkConfigChange(field.key, v)}
              style={{ width: 80 }}
            />
          </div>
        );
      case 'number':
        return (
          <InputNumber
            min={field.min_value}
            max={field.max_value}
            step={field.step || 1}
            value={value as number}
            onChange={v => handleChunkConfigChange(field.key, v)}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <Select
            value={value as string}
            onChange={v => handleChunkConfigChange(field.key, v)}
            style={{ width: '100%' }}
          >
            {field.options?.map(opt => (
              <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
            ))}
          </Select>
        );
      case 'switch':
        return (
          <Switch
            checked={value as boolean}
            onChange={v => handleChunkConfigChange(field.key, v)}
            checkedChildren="是"
            unCheckedChildren="否"
          />
        );
      case 'input':
      default:
        return (
          <Input
            value={value as string}
            onChange={e => handleChunkConfigChange(field.key, e.target.value)}
            placeholder={field.description || `请输入${field.label}`}
          />
        );
    }
  };

  const renderTitle = () => {
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.title ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          知识标题 <span style={{ color: '#ff4d4f' }}>*</span>
          {isEdit && fieldChanges.title && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="请输入知识标题"
          style={{ width: '100%', background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }}
        />
      </div>
    );
  };

  const renderCategory = () => {
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.categoryId ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          知识目录
          {isEdit && fieldChanges.categoryId && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <TreeSelect
          value={categoryId || undefined}
          onChange={setCategoryId}
          placeholder="请选择知识目录"
          treeData={buildCategoryTreeSelectData()}
          style={{ width: '100%', background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff' }}
          allowClear
          treeDefaultExpandAll
        />
      </div>
    );
  };

  const renderTags = () => {
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.tags ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          标签
          {isEdit && fieldChanges.tags && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Array.isArray(tags) && tags.length > 0 ? tags.map((tag, index) => (
              <Tag
                key={index}
                closable
                onClose={() => handleTagClose(tag)}
                style={{ marginBottom: 4 }}
              >
                {tag}
              </Tag>
            )) : null}
            {showTagInput ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input
                  ref={tagInputRef as any}
                  type="text"
                  size="small"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onPressEnter={handleAddTag}
                  onBlur={handleAddTag}
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
      </div>
    );
  };

  const renderMetadatas = () => {
    const handleAddMetadata = () => {
      setMetadatas([...metadatas, { field_name: '', field_label: '', field_type: 'text', field_value: '' }]);
    };

    const handleRemoveMetadata = (index: number) => {
      setMetadatas(metadatas.filter((_, i) => i !== index));
    };

    const handleMetadataChange = (index: number, field: string, value: any) => {
      const newMetadatas = [...metadatas];
      newMetadatas[index] = { ...newMetadatas[index], [field]: value };
      if (field === 'field_type') {
        const defaults: Record<string, any> = {
          boolean: false, long: 0, integer: 0, float: 0.0, double: 0.0,
          date: null, object: '{}', array: '[]',
          integer_range: [0, 0], long_range: [0, 0], float_range: [0.0, 0.0], date_range: null,
        };
        newMetadatas[index].field_value = defaults[value] !== undefined ? defaults[value] : '';
      }
      setMetadatas(newMetadatas);
    };

    const getControlType = (fieldType: string): string => {
      const ft = metadataFieldTypes.find(f => f.key === fieldType);
      return ft?.type || 'input';
    };

    const renderValueInput = (item: typeof metadatas[0], index: number) => {
      const inputStyle = { background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' };
      switch (item.field_type) {
        case 'boolean':
          return <Select value={item.field_value} onChange={(v) => handleMetadataChange(index, 'field_value', v)} style={{ width: '100%' }} size="small"><Option value={true}>true</Option><Option value={false}>false</Option></Select>;
        case 'long': case 'integer':
          return <InputNumber value={item.field_value} onChange={(v) => handleMetadataChange(index, 'field_value', v)} style={{ width: '100%' }} precision={0} size="small" />;
        case 'float': case 'double':
          return <InputNumber value={item.field_value} onChange={(v) => handleMetadataChange(index, 'field_value', v)} style={{ width: '100%' }} step={0.01} size="small" />;
        case 'date':
          return <DatePicker value={item.field_value ? dayjs(item.field_value) : null} onChange={(_, ds) => handleMetadataChange(index, 'field_value', ds)} style={{ width: '100%' }} showTime size="small" locale={zhCN} />;
        case 'integer_range': case 'long_range':
          return <Space><InputNumber value={Array.isArray(item.field_value) ? item.field_value[0] : 0} onChange={(v) => handleMetadataChange(index, 'field_value', [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])} precision={0} size="small" style={{ width: 90 }} /><span style={{ color: theme === 'dark' ? '#aaa' : '#999' }}>~</span><InputNumber value={Array.isArray(item.field_value) ? item.field_value[1] : 0} onChange={(v) => handleMetadataChange(index, 'field_value', [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])} precision={0} size="small" style={{ width: 90 }} /></Space>;
        case 'float_range':
          return <Space><InputNumber value={Array.isArray(item.field_value) ? item.field_value[0] : 0} onChange={(v) => handleMetadataChange(index, 'field_value', [v || 0, Array.isArray(item.field_value) ? item.field_value[1] : 0])} step={0.01} size="small" style={{ width: 90 }} /><span style={{ color: theme === 'dark' ? '#aaa' : '#999' }}>~</span><InputNumber value={Array.isArray(item.field_value) ? item.field_value[1] : 0} onChange={(v) => handleMetadataChange(index, 'field_value', [Array.isArray(item.field_value) ? item.field_value[0] : 0, v || 0])} step={0.01} size="small" style={{ width: 90 }} /></Space>;
        case 'date_range':
          return <RangePicker value={item.field_value ? [dayjs(item.field_value[0]), dayjs(item.field_value[1])] : null} onChange={(_, ds) => handleMetadataChange(index, 'field_value', ds)} style={{ width: '100%' }} showTime size="small" locale={zhCN} />;
        case 'object':
          return <Input value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)} onChange={(e) => handleMetadataChange(index, 'field_value', e.target.value)} placeholder='{"key":"value"}' style={inputStyle} size="small" />;
        case 'array':
          return <Input value={typeof item.field_value === 'string' ? item.field_value : JSON.stringify(item.field_value)} onChange={(e) => handleMetadataChange(index, 'field_value', e.target.value)} placeholder='["item1","item2"]' style={inputStyle} size="small" />;
        default:
          return <Input value={item.field_value} onChange={(e) => handleMetadataChange(index, 'field_value', e.target.value)} style={inputStyle} size="small" />;
      }
    };

    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.metadatas ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          元数据
          {isEdit && fieldChanges.metadatas && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <div style={{ width: '100%' }}>
          {metadatas.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#aaa' : '#666', fontSize: 12 }}>
              <div style={{ width: 120 }}>字段名称</div>
              <div style={{ width: 120 }}>字段中文名</div>
              <div style={{ width: 140 }}>字段类型</div>
              <div style={{ flex: 1 }}>字段值</div>
              <div style={{ width: 32 }}></div>
            </div>
          )}
          {metadatas.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input
                value={item.field_name}
                onChange={(e) => handleMetadataChange(index, 'field_name', e.target.value)}
                placeholder="字段名称"
                style={{ width: 120, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }}
                size="small"
              />
              <Input
                value={item.field_label}
                onChange={(e) => handleMetadataChange(index, 'field_label', e.target.value)}
                placeholder="字段中文名"
                style={{ width: 120, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' }}
                size="small"
              />
              <Select
                value={item.field_type}
                onChange={(v) => handleMetadataChange(index, 'field_type', v)}
                style={{ width: 140 }}
                size="small"
              >
                {metadataFieldTypes.map(ft => (
                  <Option key={ft.key} value={ft.key}>{ft.label}</Option>
                ))}
              </Select>
              <div style={{ flex: 1 }}>
                {renderValueInput(item, index)}
              </div>
              <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => handleRemoveMetadata(index)} />
            </div>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddMetadata} size="small" style={{ width: '100%' }}>
            添加元数据
          </Button>
        </div>
      </div>
    );
  };

  const renderCustomTemplateConfig = () => {
    // 获取当前知识目录的配置
    if (!categoryId) return null;
    const category = findCategoryById(categories, categoryId);
    if (!category || category.document_config?.template_type !== 'custom_template') return null;
    
    const categoryDocConfig = category.document_config || {};
    
    // 编辑时优先从数据集的document_config获取字段定义和章节
    let docDocConfig: any = null;
    if (isEdit && doc?.document_config) {
      try {
        docDocConfig = typeof doc.document_config === 'string' 
          ? JSON.parse(doc.document_config) 
          : doc.document_config;
      } catch (e) {
        console.error('Failed to parse doc document_config:', e);
      }
    }
    
    // 自定义字段：编辑时优先使用数据集的document_config中的字段定义
    const categoryCustomFields = categoryDocConfig.custom_fields || [];
    const docCustomFields = docDocConfig?.custom_fields || [];
    const docFieldIds = new Set(docCustomFields.map((f: any) => f.id));
    // 合并：数据集字段 + 目录中存在但数据集中没有的字段
    const baseCustomFields = [...docCustomFields, ...categoryCustomFields.filter((f: any) => !docFieldIds.has(f.id))];
    // 合并智能提取新增的自定义字段
    const baseFieldIds = new Set(baseCustomFields.map((f: any) => f.id));
    const extraFields = extraCustomFields.filter(f => !baseFieldIds.has(f.id));
    const customFields = [...baseCustomFields, ...extraFields];
    
    const hasKnowledgeContent = categoryDocConfig.has_knowledge_content || false;
    const chapterType = categoryDocConfig.chapter_type || 'fixed';
    // 动态章节使用dynamicChapters状态，固定章节使用目录配置或数据集配置
    const chapters = chapterType === 'dynamic' ? dynamicChapters : (docDocConfig?.chapters || categoryDocConfig.chapters || []);
    
    // 渲染字段值控件
    const renderFieldValue = (field: any) => {
      const inputStyle = { 
        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff', 
        color: theme === 'dark' ? '#fff' : '#000',
        width: '100%',
        height: 32
      };
      
      // 使用customFieldValues中的值，如果没有则使用default_value
      const fieldValue = customFieldValues[field.id] !== undefined 
        ? customFieldValues[field.id] 
        : field.default_value;
      
      // 更新字段值的处理函数
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
              <Option value={true}>true</Option>
              <Option value={false}>false</Option>
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
            />
          );
      }
    };
    
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.customFieldValues ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            知识配置
            {isEdit && fieldChanges.customFieldValues && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
          </div>
          <Button
            type="primary"
            icon={isExtracting ? <LoadingOutlined /> : <ThunderboltOutlined />}
            size="small"
            onClick={() => setShowIntelligentExtract(true)}
            style={{ marginLeft: 8 }}
          >
            {isExtracting ? '提取中...' : '智能提取'}
          </Button>
        </div>
        <div style={{ 
          padding: 16, 
          borderRadius: 8,
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'transparent',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
        }}>
          {/* 基础属性字段 */}
          {customFields.length > 0 && (
            <Row gutter={[16, 12]}>
              {customFields.map((field: any, index: number) => (
                <Col key={index} span={12}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                      {field.field_name}
                      {field.is_required && <span style={{ color: '#ff4d4f' }}> *</span>}
                      {field.description && (
                        <Tooltip title={field.description}>
                          <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
                        </Tooltip>
                      )}
                    </div>
                    <div style={{ width: '100%' }}>
                      {renderFieldValue(field)}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
          
          {/* 章节目录配置 */}
          {hasKnowledgeContent && chapterType === 'fixed' && chapters.length > 0 && (
            <div style={{ marginTop: customFields.length > 0 ? 16 : 0, paddingTop: customFields.length > 0 ? 16 : 0, borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none' }}>
              <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                章节目录
              </div>
              <ChapterList 
                chapters={chapters} 
                onChange={() => {}} 
                editable={false}
                documentConstants={constants}
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
          
          {/* 动态章节配置 */}
          {hasKnowledgeContent && chapterType === 'dynamic' && (
            <div style={{ marginTop: customFields.length > 0 ? 16 : 0, paddingTop: customFields.length > 0 ? 16 : 0, borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none' }}>
              <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                章节目录
                <Tooltip title="动态章节：用户可手动添加章节及章节字段">
                  <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
                </Tooltip>
              </div>
              <ChapterList 
                chapters={dynamicChapters} 
                onChange={(newChapters) => {
                  setDynamicChapters(newChapters);
                  setHasChanges(true);
                }} 
                editable={true}
                documentConstants={constants}
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

          {/* 富文本章节配置 */}
          {hasKnowledgeContent && chapterType === 'rich_text' && (
            <div style={{ marginTop: customFields.length > 0 ? 16 : 0, paddingTop: customFields.length > 0 ? 16 : 0, borderTop: customFields.length > 0 ? `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}` : 'none' }}>
              <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
                知识内容
              </div>
              <div style={{ width: '100%' }}>
                <MDEditor
                  value={customFieldValues.chapter_rich_text_content || ''}
                  onChange={(val) => {
                    setCustomFieldValues(prev => ({
                      ...prev,
                      chapter_rich_text_content: val || ''
                    }));
                    setHasChanges(true);
                  }}
                  height={250}
                  preview="edit"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatus = () => {
    return (
      <div style={{ width: '100%', ...(isEdit && fieldChanges.status ? changedFieldStyle : {}) }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          状态
          {isEdit && fieldChanges.status && <span style={{ color: '#faad14', marginLeft: 8, fontSize: 12 }}>已修改</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Switch 
            checked={status} 
            onChange={setStatus}
            checkedChildren="启用" 
            unCheckedChildren="禁用" 
          />
        </div>
      </div>
    );
  };

  /**
   * 处理知识状态更新（从新增变为编辑）
   * @param newKnowledgeId 新的知识ID
   */
  const handleStatusUpdate = (newKnowledgeId: string) => {
    console.log('知识状态更新，从新增变为编辑，新knowledgeId:', newKnowledgeId);
    setCurrentKnowledgeId(newKnowledgeId);
    // 更新URL或其他状态，使页面变为编辑模式
    // 注意：这里只是更新knowledgeId，实际的页面状态切换由父组件或路由处理
  };

  const handleIntelligentExtractConfirm = (extractedData: {
    title?: string;
    tags?: string[];
    customFieldValues?: Record<string, any>;
    richTextContent?: string;
    chapterFieldsValues?: Record<string, any>;
    dynamicChapters?: any[];
    newCustomFields?: any[];
  }) => {
    if (extractedData.title) {
      setTitle(extractedData.title);
    }
    if (extractedData.tags) {
      const newCategoryTags = extractedData.tags.filter(tag => !categoryTags.includes(tag));
      setUserTags(prev => {
        const mergedTags = [...prev];
        newCategoryTags.forEach(tag => {
          if (!mergedTags.includes(tag)) {
            mergedTags.push(tag);
          }
        });
        return mergedTags;
      });
    }
    // 处理新增的自定义字段定义
    if (extractedData.newCustomFields && extractedData.newCustomFields.length > 0) {
      setExtraCustomFields(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const toAdd = extractedData.newCustomFields!.filter(f => f.id && !existingIds.has(f.id));
        return [...prev, ...toAdd];
      });
    }
    if (extractedData.customFieldValues) {
      setCustomFieldValues(prev => ({
        ...prev,
        ...extractedData.customFieldValues
      }));
    }
    // 处理章节字段值
    if (extractedData.chapterFieldsValues) {
      setCustomFieldValues(prev => ({
        ...prev,
        chapter_fields_values: {
          ...(prev.chapter_fields_values || {}),
          ...extractedData.chapterFieldsValues
        }
      }));
    }
    // 处理动态章节
    if (extractedData.dynamicChapters && extractedData.dynamicChapters.length > 0) {
      setDynamicChapters(extractedData.dynamicChapters);
    }
    if (extractedData.richTextContent) {
      setRichTextContent(extractedData.richTextContent);
    }
    message.success('智能提取结果已填充到配置页面');
  };

  const renderBottomButtons = () => {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: '16px 0 8px 0',
        borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
        marginTop: 16,
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
      }}>
        {isEdit && hasChanges && (
          <span style={{ color: '#faad14', fontSize: 12 }}>
            • 有未保存的变动
          </span>
        )}
        <Button
          onClick={onBack}
        >
          取消
        </Button>
        {isEdit && (
          <Button
            icon={<UndoOutlined />}
            onClick={handleRestore}
            disabled={!hasChanges}
          >
            恢复
          </Button>
        )}
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          保存
        </Button>
      </div>
    );
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'hidden',
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
    }}>
      {/* <PageHeader
        items={[
          {
            title: isEdit ? '编辑知识' : '新增知识'
          }
        ]}
        backButton={
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ padding: 0 }}
          />
        }
        showHome={false}
        className="compact"
      /> */}
      <div style={{ 
        flex: 1, 
        minHeight: 0,
        overflowY: 'auto', 
        padding: '24px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff'
      }} className="hide-scrollbar">
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        <Form layout="vertical" style={{ width: '100%' }}>
          <div 
            ref={containerRef}
            style={{ 
              display: 'flex', 
              width: '100%',
              position: 'relative'
            }}
          >
            {/* 左侧配置区域 */}
            <div style={{ 
              width: `${leftWidth}%`, 
              paddingRight: 12,
              transition: isDragging ? 'none' : 'width 0.1s'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {renderTitle()}
                {renderCategory()}
                {renderCustomTemplateConfig()}
                {renderSourceTypes()}
                {renderUploadArea()}
                {renderDatasourceSelector()}
                {renderRichTextEditor()}
                {renderFileBrowser()}
                {renderTableBrowser()}
                {renderTags()}
                {renderMetadatas()}
                {renderStatus()}
              </div>
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
                  ? 'var(--primary-color)' 
                  : theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                borderRadius: 4,
                cursor: 'col-resize',
                transition: isDragging ? 'none' : 'background 0.2s',
              }} />
            </div>
            
            {/* 右侧配置区域 */}
            <div style={{ 
              width: `${100 - leftWidth}%`, 
              paddingLeft: 12,
              transition: isDragging ? 'none' : 'width 0.1s'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {renderChunkMethodSelect()}
                {renderChunkConfigFields()}
              </div>
            </div>
          </div>
        </Form>
      </div>
      {renderBottomButtons()}
      
      <IntelligentExtractModal
        visible={showIntelligentExtract}
        knowledgebaseId={knowledgebase.id}
        knowledgeId={knowledgeId}
        selectedCategory={categoryId ? findCategoryById(categories, categoryId) : null}
        currentTitle={title}
        currentTags={tags}
        currentCustomFieldValues={customFieldValues}
        currentRichTextContent={richTextContent}
        currentDynamicChapters={dynamicChapters}
        isEdit={isEdit}
        categories={categories}
        categoryId={categoryId}
        onSaveBeforeExtract={handleSaveBeforeExtract}
        onTitleUpdate={setTitle}
        onStatusUpdate={handleStatusUpdate}
        onCancel={() => setShowIntelligentExtract(false)}
        onConfirm={handleIntelligentExtractConfirm}
      />
    </div>
  );
};

export default KnowledgebaseDocumentSetting;
