import React, { useState, useEffect } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';

const LLMModel: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

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

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader 
        items={[
          { title: '模型库', icon: <SettingOutlined /> }
        ]} 
      />
      <div className="page-content">
        <p>这里是模型库页面</p>
      </div>
    </div>
  );
};

export default LLMModel;
