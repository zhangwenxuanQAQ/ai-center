import React, { useState, useEffect } from 'react';
import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './page-header.css';

interface BreadcrumbItem {
  title: string;
  icon?: React.ReactNode;
  path?: string;
}

interface PageHeaderProps {
  items: BreadcrumbItem[];
  actionButton?: React.ReactNode;
  backButton?: React.ReactNode;
  showHome?: boolean;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ items, actionButton, backButton, showHome = true, className }) => {
  const navigate = useNavigate();
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

  const breadcrumbItems = showHome ? [
    {
      title: (
        <span className="breadcrumb-home" onClick={() => navigate('/')}>
          <HomeOutlined />
          <span>首页</span>
        </span>
      ),
    },
    ...items.map((item, index) => ({
      title: (
        <span 
          className={index === items.length - 1 ? 'breadcrumb-current' : 'breadcrumb-item'}
          onClick={() => item.path && navigate(item.path)}
          style={{ cursor: item.path ? 'pointer' : 'default' }}
        >
          {item.icon}
          {item.icon && <span style={{ marginLeft: 4 }} />}
          <span>{item.title}</span>
        </span>
      ),
    })),
  ] : items.map((item, index) => ({
    title: (
      <span 
        className={index === items.length - 1 ? 'breadcrumb-current' : 'breadcrumb-item'}
        onClick={() => item.path && navigate(item.path)}
        style={{ cursor: item.path ? 'pointer' : 'default' }}
      >
        {item.icon}
        {item.icon && <span style={{ marginLeft: 4 }} />}
        <span>{item.title}</span>
      </span>
    ),
  }));

  return (
    <div className={`page-header ${theme === 'dark' ? 'dark' : 'light'} ${className || ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {backButton && (
          <div className="page-header-back">
            {backButton}
          </div>
        )}
        <Breadcrumb
          className={`ant-breadcrumb ${theme === 'dark' ? 'dark' : 'light'}`}
          items={breadcrumbItems}
        />
      </div>
      {actionButton && (
        <div className="page-header-actions">
          {actionButton}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
