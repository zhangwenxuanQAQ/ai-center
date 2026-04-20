import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Select, Tag, Upload, message, Slider, InputNumber, Tooltip, Form, Switch, TreeSelect, Spin, Empty, Row, Col, List } from 'antd';
import PageHeader from '../../components/page-header';
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
}

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  local_document: <FileOutlined style={{ fontSize: 24 }} />,
  datasource: <DatabaseOutlined style={{ fontSize: 24 }} />,
  custom_template: <FormOutlined style={{ fontSize: 24 }} />,
};

const KnowledgebaseDocumentSetting: React.FC<KnowledgebaseDocumentSettingProps> = ({
  knowledgebase,
  document: doc,
  onBack,
  onSave,
}) => {
  const isEdit = !!doc;
  const [theme, setTheme] = useState<string>('dark');
  const [constants, setConstants] = useState<DocumentConstants | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sourceType, setSourceType] = useState<string>('local_document');
  const [chunkMethod, setChunkMethod] = useState<string>('naive');
  const [chunkConfig, setChunkConfig] = useState<Record<string, unknown>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [fileList, setFileList] = useState<Array<{ uid: string; name: string; size: number }>>([]);
  const [status, setStatus] = useState<boolean>(true);
  const [categoryId, setCategoryId] = useState<string>('');
  
  // 数据源相关状态
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<string>('');
  const [selectedDatasource, setSelectedDatasource] = useState<Datasource | null>(null);
  const [datasourceLoading, setDatasourceLoading] = useState(false);
  
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

  useEffect(() => {
    if (isEdit && doc) {
      const docSourceType = doc.source_type || 'local_document';
      const docChunkMethod = doc.chunk_method || 'naive';
      const docChunkConfig = doc.chunk_config || {};
      const docTags = doc.tags || [];
      const docStatus = typeof doc.status === 'string' ? doc.status === 'active' : !!doc.status;
      const docCategoryId = doc.category_id || '';

      setSourceType(docSourceType);
      setChunkMethod(docChunkMethod);
      setChunkConfig(docChunkConfig as Record<string, unknown>);
      setTags(docTags);
      setStatus(docStatus);
      setCategoryId(docCategoryId);

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

      const initData = {
        sourceType: docSourceType,
        chunkMethod: docChunkMethod,
        chunkConfig: docChunkConfig as Record<string, unknown>,
        tags: docTags,
        status: docStatus,
        fileList: [], // 文件列表在编辑模式下不会重新初始化，因为文件已上传
        categoryId: docCategoryId,
      };
      setOriginalData(initData);
    } else if (constants) {
      initDefaultChunkConfig('naive');
    }
  }, [doc, constants]);

  useEffect(() => {
    if (!constants) return;
    const current = {
      sourceType,
      chunkMethod,
      chunkConfig,
      tags: [...tags],
      status,
      fileList: [...fileList],
      categoryId,
    };
    const changed =
      current.sourceType !== originalData.sourceType ||
      current.chunkMethod !== originalData.chunkMethod ||
      JSON.stringify(current.chunkConfig) !== JSON.stringify(originalData.chunkConfig) ||
      JSON.stringify(current.tags) !== JSON.stringify(originalData.tags) ||
      current.status !== originalData.status ||
      JSON.stringify(current.fileList) !== JSON.stringify(originalData.fileList) ||
      current.categoryId !== originalData.categoryId;
    setHasChanges(changed);
  }, [sourceType, chunkMethod, chunkConfig, tags, status, fileList, categoryId, originalData, constants]);

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
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleTagClose = (removedTag: string) => {
    setTags(tags.filter(tag => tag !== removedTag));
  };

  const handleSave = async () => {
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
    if (!isEdit && sourceType === 'datasource') {
      const isFileStorage = selectedDatasource && ['s3', 'minio', 'rustfs'].includes(selectedDatasource.type);
      if (isFileStorage && selectedFiles.length === 0) {
        message.error('请至少选择一个文件');
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit && doc) {
          await knowledgebaseService.updateDocument(knowledgebase.id, doc.id, {
            chunk_method: chunkMethod,
            chunk_config: chunkConfig,
            tags,
            status: status,
            category_id: categoryId || undefined,
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
            status
          );
          if (result.errors && result.errors.length > 0) {
            message.warning(`${result.errors.length}个文件上传失败`);
          }
          if (result.documents && result.documents.length > 0) {
            for (const doc of result.documents) {
              await knowledgebaseService.updateDocument(knowledgebase.id, doc.id, {
                chunk_method: chunkMethod,
                chunk_config: chunkConfig,
                tags,
                status: status,
                category_id: categoryId || undefined,
              });
            }
          }
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
    setTags(originalData.tags);
    setStatus(originalData.status);
    setCategoryId(originalData.categoryId);
    setFileList([]);
  };

  const renderSourceTypes = () => {
    if (!constants) return null;
    return (
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          数据来源 <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {constants.source_types
            .filter(st => !isEdit || st.key === sourceType) // 编辑模式下只显示当前数据源
            .map(st => {
              const isSelected = sourceType === st.key;
              const isDisabled = isEdit; // 编辑模式下禁用修改
              return (
                <Tooltip key={st.key} title={isDisabled ? (isEdit ? '编辑模式下不可修改' : st.label) : st.label}>
                  <div
                    onClick={() => !isDisabled && handleSourceTypeChange(st.key)}
                    style={{
                      width: 140,
                      padding: '16px 12px',
                      borderRadius: 8,
                      border: `2px solid ${isSelected ? '#667eea' : theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#e8e8e8'}`,
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
                    <div style={{ color: isSelected ? '#667eea' : theme === 'dark' ? '#aaa' : '#666' }}>
                      {SOURCE_TYPE_ICONS[st.key]}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: isSelected ? '#667eea' : theme === 'dark' ? '#ccc' : '#666',
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
        <div style={{ width: '50%' }}>
          {!isEdit ? (
            <Upload.Dragger
              multiple
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.wav,.ogg"
              beforeUpload={(file) => {
                fileMapRef.current.set(file.uid, file);
                setFileList(prev => [...prev, { uid: file.uid, name: file.name, size: file.size }]);
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
                <InboxOutlined style={{ color: '#667eea', fontSize: 40 }} />
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
        <div style={{ width: '50%' }}>
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
          <div style={{ width: '50%' }}>
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
        <div style={{ width: '50%' }}>
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
                      <FolderOutlined style={{ color: '#667eea' }} />
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
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          切片方法 <span style={{ color: '#ff4d4f' }}>*</span>
        </div>
        <Select
          value={chunkMethod}
          onChange={handleChunkMethodChange}
          style={{ width: '50%', float: 'left' }}
          placeholder="请选择切片方法"
        >
          {constants?.chunk_methods?.map(cm => (
            <Select.Option key={cm.key} value={cm.key}>{cm.label}</Select.Option>
          )) || []}
        </Select>
      </div>
    );
  };

  const renderChunkConfigFields = () => {
    const fields = constants?.chunk_configs?.[chunkMethod] || [];
    if (fields.length === 0) return null;

    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 12, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          切片配置
        </div>
        <div style={{ 
          width: '50%',
          padding: 16,
          borderRadius: 8,
          background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
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

  const renderCategory = () => {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          分类
        </div>
        <TreeSelect
          value={categoryId || undefined}
          onChange={setCategoryId}
          placeholder="请选择分类"
          treeData={buildCategoryTreeSelectData()}
          style={{ width: '50%', float: 'left' }}
          allowClear
          treeDefaultExpandAll
        />
      </div>
    );
  };

  const renderTags = () => {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          标签
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((tag, index) => (
              <Tag
                key={index}
                closable
                onClose={() => handleTagClose(tag)}
                style={{ marginBottom: 4 }}
              >
                {tag}
              </Tag>
            ))}
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

  const renderStatus = () => {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          状态
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
          disabled={!hasChanges && isEdit}
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
    }}>
      <PageHeader
        items={[
          {
            title: isEdit ? '编辑数据集' : '新增数据集'
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
      />
      <div style={{ 
        flex: 1, 
        minHeight: 0,
        overflowY: 'auto', 
        padding: '24px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }} className="hide-scrollbar">
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        <Form layout="vertical" style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, alignItems: 'flex-start' }}>
          {renderSourceTypes()}
          {renderUploadArea()}
          {renderDatasourceSelector()}
          {renderFileBrowser()}
          {renderTableBrowser()}
          {renderCategory()}
          {renderChunkMethodSelect()}
          {renderChunkConfigFields()}
          {renderTags()}
          {renderStatus()}
        </Form>
      </div>
      {renderBottomButtons()}
    </div>
  );
};

export default KnowledgebaseDocumentSetting;
