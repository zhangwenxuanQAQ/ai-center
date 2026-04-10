import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Spin, message } from 'antd';
import { BookOutlined, SettingOutlined, FolderOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import PageHeader from '../../components/page-header';
import KnowledgebaseSetting from './knowledgebase_setting';
import KnowledgebaseDocument from './knowledgebase_document';
import KnowledgebaseRetrieval from './knowledgebase_retrieval';
import '../../styles/common.css';
import './knowledgebase.less';

const KnowledgebaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [knowledgebase, setKnowledgebase] = useState<Knowledgebase | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab] = useState('setting');

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
    if (id) {
      fetchKnowledgebase(id);
    }
  }, [id]);

  const fetchKnowledgebase = async (kbId: string) => {
    setLoading(true);
    try {
      const data = await knowledgebaseService.getKnowledgebase(kbId);
      setKnowledgebase(data);
    } catch (error) {
      console.error('Failed to fetch knowledgebase:', error);
      message.error('获取知识库信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/knowledgebases');
  };

  if (loading) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!knowledgebase) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          知识库不存在
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'setting',
      label: (
        <span>
          <SettingOutlined />
          知识库配置
        </span>
      ),
      children: <KnowledgebaseSetting knowledgebase={knowledgebase} onUpdate={fetchKnowledgebase} />,
    },
    {
      key: 'document',
      label: (
        <span>
          <FolderOutlined />
          数据集
        </span>
      ),
      children: <KnowledgebaseDocument knowledgebase={knowledgebase} />,
    },
    {
      key: 'retrieval',
      label: (
        <span>
          <SearchOutlined />
          检索测试
        </span>
      ),
      children: <KnowledgebaseRetrieval knowledgebase={knowledgebase} />,
    },
  ];

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { 
            title: '知识库管理', 
            icon: <BookOutlined />, 
            onClick: handleBack 
          },
          { title: knowledgebase.name }
        ]}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        type="card"
        className={`knowledgebase-detail-tabs ${theme === 'dark' ? 'dark' : 'light'}`}
        style={{ height: 'calc(100% - 60px)', display: 'flex', flexDirection: 'column' }}
      />
    </div>
  );
};

export default KnowledgebaseDetail;
