import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Tag, Spin, Tooltip, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  RobotOutlined,
  BookOutlined,
  FileTextOutlined,
  ApiOutlined,
  CommentOutlined,
  SettingOutlined,
  CodeOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import PageHeader from '../../../components/page-header';
import {
  systemService, SystemOverview, DatabaseInfo, ModuleStats,
  CategoryStatItem, KnowledgebaseStats, ModelStats, DatasourceStats
} from '../../../services/system';
import './monitor.less';

type ModuleKey = 'overview' | 'chatbot' | 'knowledgebase' | 'mcp' | 'prompt' | 'model' | 'datasource';

interface PieDataItem {
  type: string;
  value: number;
}

const SystemMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState<string | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('overview');
  const [detailData, setDetailData] = useState<PieDataItem[]>([]);
  const [detailTitle, setDetailTitle] = useState<string>('模块分布');

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

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await systemService.getOverview();
      setOverview(data);
    } catch (error) {
      console.error('Failed to fetch system overview:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const refreshDatabase = async (dbType: string) => {
    setDbLoading(dbType);
    try {
      const dbs = await systemService.getDatabaseStatus();
      if (overview) {
        setOverview({ ...overview, databases: dbs });
      }
    } catch (error) {
      console.error('Failed to refresh database:', error);
    } finally {
      setDbLoading(null);
    }
  };

  const refreshModules = async () => {
    setModuleLoading(true);
    try {
      const data = await systemService.getOverview();
      setOverview(data);
      if (selectedModule !== 'overview') {
        handleModuleClick(selectedModule);
      }
    } catch (error) {
      console.error('Failed to refresh modules:', error);
    } finally {
      setModuleLoading(false);
    }
  };

  const handleModuleClick = useCallback(async (key: ModuleKey) => {
    setSelectedModule(key);

    if (key === 'overview') {
      if (!overview) return;
      const items: { label: string; key: string; count: number }[] = [
        { label: '机器人', key: 'chatbot_count', count: overview.modules.chatbot_count },
        { label: '知识库', key: 'knowledgebase_count', count: overview.modules.knowledgebase_count },
        { label: 'MCP服务', key: 'mcp_server_count', count: overview.modules.mcp_server_count },
        { label: '提示词', key: 'prompt_count', count: overview.modules.prompt_count },
        { label: '模型', key: 'model_count', count: overview.modules.model_count },
        { label: '数据源', key: 'datasource_count', count: overview.modules.datasource_count },
      ];
      setDetailData(items.filter(item => item.count > 0).map(item => ({ type: item.label, value: item.count })));
      setDetailTitle('模块分布');
      return;
    }

    try {
      let data: PieDataItem[] = [];
      switch (key) {
        case 'chatbot': {
          const res = await systemService.getChatbotStats();
          data = res.map(item => ({ type: item.category, value: item.count }));
          setDetailTitle('机器人分类分布');
          break;
        }
        case 'knowledgebase': {
          const res: KnowledgebaseStats = await systemService.getKnowledgebaseStats();
          data = res.categories.map(item => ({ type: item.category, value: item.count }));
          setDetailTitle('知识库分类分布');
          break;
        }
        case 'mcp': {
          const res = await systemService.getMcpStats();
          data = res.map(item => ({ type: item.category, value: item.count }));
          setDetailTitle('MCP服务分类分布');
          break;
        }
        case 'prompt': {
          const res = await systemService.getPromptStats();
          data = res.map(item => ({ type: item.category, value: item.count }));
          setDetailTitle('提示词分类分布');
          break;
        }
        case 'model': {
          const res: ModelStats = await systemService.getModelStats();
          data = res.types.map(item => ({ type: item.type, value: item.count }));
          setDetailTitle('模型类型分布');
          break;
        }
        case 'datasource': {
          const res: DatasourceStats = await systemService.getDatasourceStats();
          data = res.types.map(item => ({ type: item.type, value: item.count }));
          setDetailTitle('数据源类型分布');
          break;
        }
      }
      setDetailData(data.filter(d => d.value > 0));
    } catch (error) {
      console.error('Failed to fetch detail stats:', error);
      setDetailData([]);
    }
  }, [overview]);

  const renderStatusTag = (status: string) => {
    if (status === 'connected') {
      return <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>;
    }
    return <Tag icon={<CloseCircleOutlined />} color="error">未连接</Tag>;
  };

  const renderMetricStatus = (status: string) => {
    if (status === 'warning') {
      return <WarningOutlined style={{ color: '#faad14', marginLeft: 4 }} />;
    }
    return null;
  };

  const renderDatabaseCard = (db: DatabaseInfo) => {
    const monitorInfo = db.monitor_info;
    const isConnected = monitorInfo?.status === 'connected';

    return (
      <div className={`monitor-db-card ${theme === 'dark' ? 'dark' : 'light'} ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="db-card-header">
          <div className="db-card-title">
            <DatabaseOutlined className="db-icon" />
            <span className="db-name">{db.name}</span>
            {monitorInfo?.version && (
              <Tooltip title={`版本: ${monitorInfo.version}`}>
                <Tag color="blue" style={{ fontSize: 11 }}>{monitorInfo.version.split('(')[0].trim()}</Tag>
              </Tooltip>
            )}
            {renderStatusTag(monitorInfo?.status || 'disconnected')}
          </div>
        </div>

        <div className="db-card-body">
          <div className="db-info-row">
            <span className="info-label">地址</span>
            <span className="info-value">{db.host}:{db.port}</span>
          </div>
          {db.database && (
            <div className="db-info-row">
              <span className="info-label">数据库</span>
              <span className="info-value">{db.database}</span>
            </div>
          )}
          {db.db !== undefined && (
            <div className="db-info-row">
              <span className="info-label">DB</span>
              <span className="info-value">{db.db}</span>
            </div>
          )}
          {db.user && (
            <div className="db-info-row">
              <span className="info-label">用户</span>
              <span className="info-value">{db.user}</span>
            </div>
          )}

          {monitorInfo?.error && (
            <div className="db-error-row">
              <Tooltip title={monitorInfo.error}>
                <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
                <span className="error-text">{monitorInfo.error}</span>
              </Tooltip>
            </div>
          )}

          {isConnected && monitorInfo?.metrics && monitorInfo.metrics.length > 0 && (
            <div className="db-metrics-grid">
              {monitorInfo.metrics.map((metric, idx) => (
                <div className="metric-cell" key={idx}>
                  <span className="metric-label">
                    {metric.name_zh}{renderMetricStatus(metric.status)}
                    {metric.description && (
                      <Tooltip title={metric.description}>
                        <InfoCircleOutlined className="desc-icon" />
                      </Tooltip>
                    )}
                  </span>
                  <span className="metric-val">{metric.value}<span className="metric-unit">{metric.unit}</span></span>
                </div>
              ))}
            </div>
          )}

          {isConnected && monitorInfo?.stats && monitorInfo.stats.length > 0 && (
            <div className="db-stats-list">
              {monitorInfo.stats.map((stat, idx) => (
                <div className="stat-cell" key={idx}>
                  <span className="stat-label">
                    {stat.name_zh}
                    {stat.description && (
                      <Tooltip title={stat.description}>
                        <InfoCircleOutlined className="desc-icon" />
                      </Tooltip>
                    )}
                  </span>
                  <span className="stat-val">{stat.value}<span className="stat-unit">{stat.unit}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const moduleCards: { key: ModuleKey; label: string; icon: React.ReactNode; color: string; getCount: () => number }[] = [
    { key: 'overview', label: '总览', icon: <DashboardOutlined />, color: '#667eea', getCount: () => 0 },
    { key: 'chatbot', label: '机器人', icon: <RobotOutlined />, color: '#667eea', getCount: () => overview?.modules.chatbot_count || 0 },
    { key: 'knowledgebase', label: '知识库', icon: <BookOutlined />, color: '#52c41a', getCount: () => overview?.modules.knowledgebase_count || 0 },
    { key: 'mcp', label: 'MCP服务', icon: <ApiOutlined />, color: '#13c2c2', getCount: () => overview?.modules.mcp_server_count || 0 },
    { key: 'prompt', label: '提示词', icon: <CommentOutlined />, color: '#eb2f96', getCount: () => overview?.modules.prompt_count || 0 },
    { key: 'model', label: '模型', icon: <SettingOutlined />, color: '#1890ff', getCount: () => overview?.modules.model_count || 0 },
    { key: 'datasource', label: '数据源', icon: <CloudServerOutlined />, color: '#faad14', getCount: () => overview?.modules.datasource_count || 0 },
  ];

  const pieConfig = {
    appendPadding: 10,
    data: detailData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.55,
    label: {
      text: (d: any) => `${d.type}\n${d.value}`,
      position: 'outside' as const,
      style: {
        fontSize: 12,
        fill: theme === 'dark' ? '#ffffff' : '#333333',
      },
    },
    tooltip: {
      formatter: (d: any) => ({ name: d.type, value: d.value }),
    },
    legend: {
      position: 'bottom' as const,
      layout: 'horizontal' as const,
      color: {
        itemName: {
          style: {
            fill: theme === 'dark' ? '#ffffff' : '#333333',
          },
        },
      },
    },
    theme: theme === 'dark' ? 'dark' : 'light',
    interactions: [{ type: 'element-active' }],
    pieStyle: {
      lineWidth: 1,
      stroke: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
    },
  };

  return (
    <div className={`monitor-page ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[{ title: '系统监控', icon: <DashboardOutlined /> }]}
      />

      <div className="monitor-content">
        <Spin spinning={loading}>
          {/* 系统版本信息 */}
          <div className={`version-bar ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className="version-left">
              <DashboardOutlined className="version-icon" />
              <span className="version-value">{overview?.version || '—'}</span>
            </div>
          </div>

          {/* 数据库状态 */}
          <div className="section-block">
            <div className="section-header">
              <DatabaseOutlined className="section-icon" />
              <span className="section-title">数据库状态</span>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={dbLoading !== null} />}
                onClick={() => refreshDatabase('all')}
                className="refresh-btn-small"
              />
            </div>
            <div className="database-list">
              {overview?.databases?.map(db => renderDatabaseCard(db))}
            </div>
          </div>

          {/* 功能模块统计 */}
          <div className="section-block">
            <div className="section-header">
              <SettingOutlined className="section-icon" />
              <span className="section-title">功能模块统计</span>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={moduleLoading} />}
                onClick={refreshModules}
                className="refresh-btn-small"
              />
            </div>

            <div className="module-layout">
              {/* 左侧模块卡片列表 */}
              <div className="module-sidebar">
                {moduleCards.map(card => {
                  const isSelected = selectedModule === card.key;
                  const count = card.getCount();
                  return (
                    <Card
                      key={card.key}
                      className={`module-card ${theme === 'dark' ? 'dark' : 'light'} ${isSelected ? 'selected' : ''}`}
                      size="small"
                      bodyStyle={{ padding: '12px 16px' }}
                      hoverable
                      onClick={() => handleModuleClick(card.key)}
                    >
                      <div className="module-card-inner">
                        <div className="module-icon-wrap" style={{ borderColor: card.color }}>
                          {card.icon}
                        </div>
                        <span className="module-label">{card.label}</span>
                        {card.key !== 'overview' && count > 0 && (
                          <span className="module-badge" style={{ background: card.color }}>{count}</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* 右侧饼图区域 */}
              <div className="chart-area">
                <Card
                  className={`pie-card ${theme === 'dark' ? 'dark' : 'light'}`}
                  size="small"
                  title={
                    <span className="chart-title">
                      <InfoCircleOutlined style={{ marginRight: 6 }} />
                      {detailTitle}
                    </span>
                  }
                >
                  {detailData.length > 0 ? (
                    <Pie {...pieConfig} />
                  ) : (
                    <div className="empty-chart">
                      <InfoCircleOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                      <p>暂无数据</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </Spin>
      </div>
    </div>
  );
};

export default SystemMonitor;
