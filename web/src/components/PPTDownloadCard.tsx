import React, { useState } from 'react';
import { DownloadOutlined, FilePptOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import './PPTDownloadCard.css';

interface PPTDownloadCardProps {
  /** 工具返回的结果对象 */
  result: any;
  /** 主题 */
  theme?: 'dark' | 'light';
}

/**
 * PPT 生成结果下载卡片
 * 识别 type === 'ppt_file' 的结果，展示文件信息和下载按钮
 */
const PPTDownloadCard: React.FC<PPTDownloadCardProps> = ({ result, theme = 'light' }) => {
  const [downloading, setDownloading] = useState(false);

  const parseResult = (): any => {
    if (!result) return null;
    if (typeof result === 'object' && result.type === 'ppt_file') return result;
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed && parsed.type === 'ppt_file') return parsed;
      } catch {
        // ignore
      }
    }
    return null;
  };

  const data = parseResult();
  if (!data) return null;

  const handleDownload = async () => {
    if (!data.file_base64) return;
    setDownloading(true);
    try {
      const response = await fetch('/aicenter/v1/chat/download_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_type: 'local',
          file_name: data.file_name || 'presentation.pptx',
          base64_content: data.file_base64,
        }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.file_name || 'presentation.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载 PPT 失败:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`ppt-download-card ${theme}`}>
      <div className="ppt-card-icon">
        <FilePptOutlined />
      </div>
      <div className="ppt-card-info">
        <div className="ppt-card-title">{data.title || '演示文稿'}</div>
        <div className="ppt-card-meta">
          <span>{data.slide_count || 0} 页幻灯片</span>
          <span className="ppt-card-separator">·</span>
          <span>{data.file_name}</span>
        </div>
      </div>
      <button
        className={`ppt-card-download-btn ${downloading ? 'loading' : ''}`}
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <>
            <LoadingOutlined /> 下载中...
          </>
        ) : (
          <>
            <DownloadOutlined /> 下载PPT
          </>
        )}
      </button>
    </div>
  );
};

export default PPTDownloadCard;
