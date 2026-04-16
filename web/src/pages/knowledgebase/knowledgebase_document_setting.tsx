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
  const [directories, setDirectories] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
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

  const loadFileList = async (datasourceId: string, bucket?: string, prefix?: string) => {
    try {
      setFileBrowserLoading(true);
      const result = await datasourceService.listFiles(datasourceId, bucket, prefix);
      if (result.success) {
        setDirectories(result.data?.data?.directories || []);
        setFiles(result.data?.data?.files || []);
        if (result.data?.data?.bucket) {
          setCurrentBucket(result.data.data.bucket);
        }
        setCurrentPath(prefix || '');
      } else {
        message.error(result.message || '获取文件列表失败');
      }
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
      if (result.success) {
        setTables(result.data?.data?.tables || []);
      } else {
        message.error(result.message || '获取表列表失败');
      }
    } catch (error) {
      console.error('Failed to load table list:', error);
      message.error('获取表列表失败');
    } finally {
      setTableBrowserLoading(false);
    }
  };

  const handleDirectoryClick = (directory: any) => {
    if (selectedDatasourceId) {
      loadFileList(selectedDatasourceId, currentBucket, directory.path);
    }
  };

  const handleTableClick = async (tableName: string) => {
    if (!selectedDatasourceId) return;
    try {
      setSelectedTable(tableName);
      const result = await datasourceService.getTableColumns(selectedDatasourceId, tableName);
      if (result.success) {
        setTableColumns(result.data?.data?.columns || []);
      } else {
        message.error(result.message || '获取表字段失败');
      }
    } catch (error) {
      console.error('Failed to load table columns:', error);
      message.error('获取表字段失败');
    }
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
    if (doc && constants) {
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
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>{getFileIcon(doc?.file_name || '')}</span>
              <span>{doc?.file_name || '已上传文档'}</span>
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
    if (sourceType !== 'datasource' || !selectedDatasource) return null;
    const isFileStorage = ['s3', 'minio', 'rustfs'].includes(selectedDatasource.type);
    if (!isFileStorage) return null;
    
    return (
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 8, fontWeight: 500, color: theme === 'dark' ? '#fff' : '#333', textAlign: 'left' }}>
          文件浏览
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
            <Empty description="暂无文件" />
          ) : (
            <div>
              {currentPath && (
                <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#d9d9d9'}` }}>
                  <Button 
                    type="text" 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => {
                      const parentPath = currentPath.split('/').slice(0, -1).join('/');
                      loadFileList(selectedDatasourceId, currentBucket, parentPath || undefined);
                    }}
                  >
                    返回上级
                  </Button>
                </div>
              )}
              <Row gutter={[12, 12]}>
                {directories.map((dir, index) => (
                  <Col key={`dir-${index}`} xs={12} sm={8} md={6}>
                    <div
                      onClick={() => handleDirectoryClick(dir)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: theme === 'dark' ? 'rgba(102,126,234,0.1)' : 'rgba(102,126,234,0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                    >
                      <FolderOutlined style={{ fontSize: 32, color: '#667eea' }} />
                      <span style={{ fontSize: 12, color: theme === 'dark' ? '#ccc' : '#666' }}>
                        {dir.name}
                      </span>
                    </div>
                  </Col>
                ))}
                {files.map((file, index) => (
                  <Col key={`file-${index}`} xs={12} sm={8} md={6}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                    >
                      {getFileIcon(file.name)}
                      <span style={{ fontSize: 12, color: theme === 'dark' ? '#ccc' : '#666' }}>
                        {file.name}
                      </span>
                      {file.size && (
                        <span style={{ fontSize: 11, color: theme === 'dark' ? '#888' : '#999' }}>
                          {formatFileSize(file.size)}
                        </span>
                      )}
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </div>
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
