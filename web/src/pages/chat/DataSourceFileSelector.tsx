import React, { useState, useEffect } from 'react';
import { Modal, Steps, List, Button, message, Spin, Empty } from 'antd';
import { FolderOpenOutlined, FileTextOutlined } from '@ant-design/icons';
import { datasourceService, Datasource } from '../../services/datasource';

const { Step } = Steps;

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
  const [currentStep, setCurrentStep] = useState(0);
  const [dataSources, setDataSources] = useState<Datasource[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<Datasource | null>(null);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // 文件类型数据源
  const fileDataSourceTypes = ['s3', 'minio', 'rustfs'];

  useEffect(() => {
    if (visible) {
      fetchDataSources();
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setCurrentStep(0);
    setSelectedDataSource(null);
    setSelectedBucket('');
    setBuckets([]);
    setFiles([]);
    setSelectedFiles([]);
  };

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const result = await datasourceService.getDatasources(0, 100);
      // 只显示文件类型的数据源
      const fileDataSources = result.data.filter((ds: Datasource) => 
        fileDataSourceTypes.includes(ds.type)
      );
      setDataSources(fileDataSources);
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
      message.error('获取数据源列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDataSource = async (dataSource: Datasource) => {
    setSelectedDataSource(dataSource);
    setLoadingFiles(true);
    try {
      const result = await datasourceService.listFiles(dataSource.id);
      if (result.success) {
        const data = result.data;
        if (!data.bucket) {
          // 显示桶列表
          setBuckets(data.directories || []);
        } else {
          // 显示文件列表
          setFiles(data.files || []);
        }
      }
      setCurrentStep(1);
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
      const result = await datasourceService.listFiles(
        selectedDataSource!.id,
        bucket.name
      );
      if (result.success) {
        setFiles(result.data.files || []);
      }
    } catch (error) {
      console.error('Failed to list files:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSelectFile = (file: any) => {
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

  const renderDataSourceList = () => (
    <div style={{ maxHeight: 400, overflow: 'auto' }}>
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
                  : 'transparent'
              }}
            >
              <List.Item.Meta
                avatar={<FolderOpenOutlined style={{ fontSize: 24 }} />}
                title={ds.name}
                description={`${ds.code} - ${ds.type}`}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const renderFileList = () => (
    <div style={{ maxHeight: 400, overflow: 'auto' }}>
      {loadingFiles ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : buckets.length > 0 ? (
        <List
          dataSource={buckets}
          renderItem={(bucket) => (
            <List.Item
              key={bucket.name}
              onClick={() => handleSelectBucket(bucket)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                avatar={<FolderOpenOutlined style={{ fontSize: 24 }} />}
                title={bucket.name}
              />
            </List.Item>
          )}
        />
      ) : files.length === 0 ? (
        <Empty description="暂无文件" />
      ) : (
        <List
          dataSource={files}
          renderItem={(file) => {
            const isSelected = selectedFiles.some(f => f.path === file.path);
            return (
              <List.Item
                key={file.path}
                onClick={() => handleSelectFile(file)}
                style={{ 
                  cursor: 'pointer',
                  backgroundColor: isSelected 
                    ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                    : 'transparent'
                }}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                  title={file.name}
                  description={file.size ? `${(file.size / 1024).toFixed(2)} KB` : ''}
                />
                {isSelected && <span style={{ color: '#52c41a' }}>✓</span>}
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
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
      width={600}
    >
      <Steps direction="vertical" current={currentStep} size="small">
        <Step title="选择数据源" description={renderDataSourceList()} />
        <Step title="选择文件" description={renderFileList()} />
      </Steps>
    </Modal>
  );
};

export default DataSourceFileSelector;
