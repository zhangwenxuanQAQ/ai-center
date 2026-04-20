import React, { useState, useEffect } from 'react';
import { Modal, List, Button, message, Spin, Empty, Pagination, Breadcrumb } from 'antd';

// 样式
const styles = `
  .breadcrumb-item-hover {
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .breadcrumb-item-hover:hover {
    color: #667eea;
  }
`;
import {
  FolderOpenOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileImageOutlined,
  SoundOutlined,
  CheckOutlined,
  HomeOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { datasourceService, Datasource } from '../../services/datasource';

interface DataSourceFileSelectorProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (files: any[]) => void;
  theme: 'light' | 'dark';
}

const DataSourceFileSelector: React.FC<DataSourceFileSelectorProps> = ({
  visible,
  onCancel,
  onConfirm,
  theme
}) => {
  const [dataSources, setDataSources] = useState<Datasource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<Datasource | null>(null);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDataSource, setTotalDataSource] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // 文件类型数据源
  const fileDataSourceTypes = ['s3', 'minio', 'rustfs'];

  useEffect(() => {
    if (visible) {
      fetchDataSources();
      resetState();
    }
  }, [visible, currentPage, pageSize]);

  const resetState = () => {
    setSelectedDataSource(null);
    setSelectedBucket('');
    setBuckets([]);
    setFiles([]);
    setSelectedFiles([]);
    setCurrentPage(1);
  };

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      // 传递文件类型过滤参数给后端接口
      const fileTypeFilter = fileDataSourceTypes.join(',');
      const result = await datasourceService.getDatasources(undefined, currentPage, pageSize, undefined, undefined, fileTypeFilter);
      setDataSources(result.data);
      setTotalDataSource(result.total);
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDataSource = async (dataSource: Datasource) => {
    setSelectedDataSource(dataSource);
    setSelectedBucket('');
    setLoadingFiles(true);
    try {
      const data = await datasourceService.listFiles(dataSource.id);
      if (!data.bucket) {
        // 显示桶列表
        setBuckets(data.directories || []);
        setFiles([]);
      } else {
        // 显示文件列表
        setFiles(data.files || []);
        setBuckets([]);
      }
    } catch (error) {
      console.error('Failed to list files:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectBucket = async (bucket: any) => {
    setSelectedBucket(bucket.name);
    setLoadingFiles(true);
    try {
      const data = await datasourceService.listFiles(
        selectedDataSource!.id,
        bucket.name
      );
      // 合并目录和文件，目录显示在前面
      const allItems = [
        ...(data.directories || []).map(dir => ({ ...dir, isDirectory: true })),
        ...(data.files || []).map(file => ({ ...file, isDirectory: false }))
      ];
      setFiles(allItems);
    } catch (error) {
      console.error('Failed to list files:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectFile = (file: any) => {
    // 只允许选择文件，不允许选择目录
    if (file.isDirectory) return;
    
    setSelectedFiles(prev => {
      const exists = prev.find(f => f.path === file.path);
      if (exists) {
        return prev.filter(f => f.path !== file.path);
      } else {
        return [...prev, file];
      }
    });
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }
    const filesWithDataSource = selectedFiles.map(file => ({
      ...file,
      datasource_id: selectedDataSource!.id,
      bucket: selectedBucket
    }));
    onConfirm(filesWithDataSource);
    onCancel();
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

  const renderDataSourceList = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : dataSources.length === 0 ? (
          <Empty description="暂无文件类型的数据源" />
        ) : (
          <List
            dataSource={dataSources}
            renderItem={(ds) => (
              <List.Item
                key={ds.id}
                onClick={() => handleSelectDataSource(ds)}
                style={{ 
                  cursor: 'pointer',
                  backgroundColor: selectedDataSource?.id === ds.id 
                    ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                    : 'transparent',
                  padding: '12px',
                  borderRadius: 6,
                  marginBottom: 6,
                  transition: 'all 0.3s ease'
                }}
                hoverable
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                    }}>
                      <img 
                        src={getDatasourceAvatar(ds.type)} 
                        alt={ds.type}
                        style={{
                          width: 28,
                          height: 28,
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/src/assets/datasource/datasource.svg';
                        }}
                      />
                    </div>
                  }
                  title={
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 500,
                      marginBottom: 2
                    }}>
                      {ds.name}
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)', marginBottom: 2 }}>
                        {ds.code} · {ds.type}
                      </div>
                      {ds.created_at && (
                        <div style={{ fontSize: 11, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                          创建时间: {formatDate(ds.created_at)}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
      {totalDataSource > 0 && (
        <div style={{ padding: 12, borderTop: `1px solid ${theme === 'dark' ? '#303030' : '#e8e8e8'}` }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalDataSource}
            onChange={(page) => setCurrentPage(page)}
            onShowSizeChange={(_, size) => setPageSize(size)}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 个数据源`}
            style={{ textAlign: 'center' }}
            size="small"
            simple
            itemRender={(current, type, originalElement) => {
              if (type === 'prev') {
                return <a>上一页</a>;
              }
              if (type === 'next') {
                return <a>下一页</a>;
              }
              return originalElement;
            }}
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
          />
        </div>
      )}
    </div>
  );

  const renderBucketList = () => (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {loadingFiles ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : buckets.length === 0 ? (
        <Empty description="暂无桶" />
      ) : (
        <List
          dataSource={buckets}
          renderItem={(bucket) => (
            <List.Item
              key={bucket.name}
              onClick={() => handleSelectBucket(bucket)}
              style={{ 
                cursor: 'pointer',
                padding: '12px',
                borderRadius: 6,
                marginBottom: 6,
                transition: 'all 0.3s ease',
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa'
              }}
              hoverable
            >
              <List.Item.Meta
                avatar={
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)'
                  }}>
                    <FolderOpenOutlined style={{ fontSize: 20, color: '#667eea' }} />
                  </div>
                }
                title={
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 500
                  }}>
                    {bucket.name}
                  </div>
                }
                description={
                  <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                    桶
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  // 根据文件扩展名获取图标
  const getFileIcon = (fileName: string) => {
    if (!fileName) return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
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
        return <FileTextOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const renderFileList = () => (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {loadingFiles ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : files.length === 0 ? (
        <Empty description="暂无文件" />
      ) : (
        <List
          dataSource={files}
          renderItem={(item) => {
            const isSelected = selectedFiles.some(f => f.path === item.path);
            
            const handleItemClick = async () => {
              if (item.isDirectory) {
                // 点击目录，进入目录查看文件
                setLoadingFiles(true);
                try {
                  const data = await datasourceService.listFiles(
                    selectedDataSource!.id,
                    selectedBucket,
                    item.path
                  );
                  // 合并目录和文件，目录显示在前面
                  const allItems = [
                    ...(data.directories || []).map(dir => ({ ...dir, isDirectory: true })),
                    ...(data.files || []).map(file => ({ ...file, isDirectory: false }))
                  ];
                  setFiles(allItems);
                } catch (error) {
                  console.error('Failed to list files in directory:', error);
                  message.error('获取目录内容失败');
                } finally {
                  setLoadingFiles(false);
                }
              } else {
                // 点击文件，选择文件
                handleSelectFile(item);
              }
            };
            
            return (
              <List.Item
                key={item.path}
                onClick={handleItemClick}
                style={{ 
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: 6,
                  marginBottom: 6,
                  transition: 'all 0.3s ease',
                  backgroundColor: isSelected 
                    ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa')
                }}
                hoverable
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: item.isDirectory 
                        ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                        : (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)')
                    }}>
                      {item.isDirectory ? (
                        <FolderOpenOutlined style={{ fontSize: 20, color: '#667eea' }} />
                      ) : (
                        getFileIcon(item.name)
                      )}
                    </div>
                  }
                  title={
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 500
                    }}>
                      {item.name}
                    </div>
                  }
                  description={
                    <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                      {item.isDirectory ? '目录' : (item.size ? `${(item.size / 1024).toFixed(2)} KB` : '')}
                    </div>
                  }
                />
                {!item.isDirectory && isSelected && <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} />}
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  const renderSelectedFiles = () => (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {selectedFiles.length === 0 ? (
        <Empty description="暂无选择的文件" />
      ) : (
        <List
          dataSource={selectedFiles}
          renderItem={(file, index) => (
            <List.Item
              key={file.path}
              actions={[
                <Button 
                  type="text" 
                  size="small" 
                  danger
                  onClick={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                  }}
                >
                  移除
                </Button>
              ]}
              style={{
                padding: '12px',
                borderRadius: 6,
                marginBottom: 6,
                transition: 'all 0.3s ease',
                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa'
              }}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                  }}>
                    {getFileIcon(file.name)}
                  </div>
                }
                title={
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 500
                  }}>
                    {file.name}
                  </div>
                }
                description={
                  <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
                    {file.size ? `${(file.size / 1024).toFixed(2)} KB` : ''}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <>
      <style>{styles}</style>
      <Modal
        title="从数据源选择文件"
        open={visible}
        onCancel={onCancel}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            取消
          </Button>,
          <Button 
            key="confirm" 
            type="primary" 
            onClick={handleConfirm}
            disabled={selectedFiles.length === 0}
          >
            确定 ({selectedFiles.length})
          </Button>
        ]}
        width={1000}
        style={{ top: 20 }}
      >
      <div style={{ display: 'flex', flexDirection: 'column', height: 500 }}>
        {/* 导航栏 */}
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb>
            <Breadcrumb.Item className="breadcrumb-item-hover" onClick={() => {
              setSelectedDataSource(null);
              setSelectedBucket('');
              setBuckets([]);
              setFiles([]);
            }}>
              <HomeOutlined /> 数据源
            </Breadcrumb.Item>
            {selectedDataSource && (
              <Breadcrumb.Item className="breadcrumb-item-hover" onClick={async () => {
                setSelectedBucket('');
                setFiles([]);
                setLoadingFiles(true);
                try {
                  const data = await datasourceService.listFiles(selectedDataSource.id);
                  if (!data.bucket) {
                    // 显示桶列表
                    setBuckets(data.directories || []);
                  }
                } catch (error) {
                  console.error('Failed to list files:', error);
                  message.error('获取桶列表失败');
                } finally {
                  setLoadingFiles(false);
                }
              }}>
                <AppstoreOutlined /> 桶
              </Breadcrumb.Item>
            )}
            {selectedDataSource && selectedBucket && (
              <Breadcrumb.Item className="breadcrumb-item-hover">文件</Breadcrumb.Item>
            )}
          </Breadcrumb>
        </div>
        
        {/* 主内容区域 */}
        <div style={{ display: 'flex', flex: 1, gap: 16 }}>
          {/* 左侧文件选择区域 */}
          <div style={{ flex: 1, border: `1px solid ${theme === 'dark' ? '#303030' : '#e8e8e8'}`, borderRadius: 4, overflow: 'hidden' }}>
            {!selectedDataSource && renderDataSourceList()}
            {selectedDataSource && !selectedBucket && renderBucketList()}
            {selectedDataSource && selectedBucket && renderFileList()}
          </div>
          
          {/* 右侧已选择文件区域 */}
          <div style={{ flex: 1, border: `1px solid ${theme === 'dark' ? '#303030' : '#e8e8e8'}`, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: 12, borderBottom: `1px solid ${theme === 'dark' ? '#303030' : '#e8e8e8'}` }}>
              已选择文件 ({selectedFiles.length})
            </div>
            {renderSelectedFiles()}
          </div>
        </div>
      </div>
      </Modal>
    </>
  );
};

export default DataSourceFileSelector;
