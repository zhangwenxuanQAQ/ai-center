import React from 'react';
import { LinkOutlined } from '@ant-design/icons';
import './WebSearchResult.css';

interface WebSearchItem {
  title?: string;
  url?: string;
  snippet?: string;
  web_content?: string;
}

interface WebSearchResultProps {
  /** 工具返回的原始结果，可能是字符串、数组或对象 */
  result: any;
  /** 主题 */
  theme?: 'dark' | 'light';
}

/**
 * 渲染 web_search 工具的搜索结果
 * 每条结果以独立卡片展示：标题（可点击链接）+ URL + 摘要
 */
const WebSearchResult: React.FC<WebSearchResultProps> = ({ result, theme = 'light' }) => {
  // 解析结果数据
  const parseResults = (): WebSearchItem[] => {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // 不是 JSON，作为纯文本返回空
      }
      return [];
    }
    return [];
  };

  const items = parseResults();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`web-search-results ${theme}`}>
      <div className="web-search-results-header">
        <span className="web-search-results-count">找到 {items.length} 条结果</span>
      </div>
      <div className="web-search-results-list">
        {items.map((item, index) => (
          <div key={index} className="web-search-result-item">
            <div className="web-search-result-title">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title || item.url}
                </a>
              ) : (
                <span>{item.title || '无标题'}</span>
              )}
            </div>
            {item.url && (
              <div className="web-search-result-url">
                <LinkOutlined style={{ marginRight: 4 }} />
                {item.url}
              </div>
            )}
            {item.snippet && (
              <div className="web-search-result-snippet">{item.snippet}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WebSearchResult;
