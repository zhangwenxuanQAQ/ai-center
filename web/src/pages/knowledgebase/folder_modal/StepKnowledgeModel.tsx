import React, { useState } from 'react';
import { Card, Switch, Radio, Input } from 'antd';
import TagsInput from '../../../components/TagsInput';
import DynamicTable, { DynamicTableRow } from '../../../components/DynamicTable';
import ChapterList from '../../../components/ChapterList';
import { Chapter } from './AddChapterModal';
import { UploadOutlined, FileTextOutlined, BookOutlined, SettingOutlined } from '@ant-design/icons';

interface StepKnowledgeModelProps {
  knowledgeTags: string[];
  setKnowledgeTags: (tags: string[]) => void;
  selectedTemplate: string;
  setSelectedTemplate: (template: string) => void;
  customFields: DynamicTableRow[];
  setCustomFields: (fields: DynamicTableRow[]) => void;
}

const StepKnowledgeModel: React.FC<StepKnowledgeModelProps> = ({
  knowledgeTags,
  setKnowledgeTags,
  selectedTemplate,
  setSelectedTemplate,
  customFields,
  setCustomFields,
}) => {
  const [hasKnowledgeContent, setHasKnowledgeContent] = useState(false);
  const [chapterType, setChapterType] = useState<string>('fixed');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [editingRequirements, setEditingRequirements] = useState('');

  const templateCards = [
    {
      key: 'file',
      title: '文件',
      description: '上传本地文件快速录入知识',
      icon: <UploadOutlined style={{ fontSize: 24 }} />,
    },
    {
      key: 'rich_text',
      title: '富文本',
      description: '富文本框录入知识',
      icon: <FileTextOutlined style={{ fontSize: 24 }} />,
    },
    {
      key: 'template',
      title: '从模版库选择',
      description: '选择模版快速新建',
      icon: <BookOutlined style={{ fontSize: 24 }} />,
    },
    {
      key: 'custom',
      title: '自定义模版',
      description: '根据业务自定义模版采编知识',
      icon: <SettingOutlined style={{ fontSize: 24 }} />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
          知识标签字典 <span style={{ color: '#ff4d4f' }}>*</span>
        </label>
        <TagsInput
          value={knowledgeTags}
          onChange={setKnowledgeTags}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
          知识模板 <span style={{ color: '#ff4d4f' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          {templateCards.map(card => (
            <Card
              key={card.key}
              onClick={() => setSelectedTemplate(card.key)}
              style={{
                cursor: 'pointer',
                borderColor: selectedTemplate === card.key ? '#667eea' : undefined,
                borderWidth: selectedTemplate === card.key ? 2 : undefined,
                flex: 1,
                minWidth: 'auto',
                padding: '8px',
              }}
              hoverable
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 4, color: selectedTemplate === card.key ? '#667eea' : '#999' }}>
                  {card.icon}
                </div>
                <div style={{ fontWeight: 500, fontSize: 12 }}>{card.title}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{card.description}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {selectedTemplate === 'custom' && (
        <div style={{ marginTop: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8 }}>
          <DynamicTable
            value={customFields}
            onChange={setCustomFields}
            label="基础属性"
          />
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 500, marginRight: 8 }}>
            知识正文 <span style={{ color: '#ff4d4f' }}>*</span>
          </label>
          <Switch
            checked={hasKnowledgeContent}
            onChange={setHasKnowledgeContent}
          />
        </div>

        {hasKnowledgeContent && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e8e8' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
                章节目录 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Radio.Group
                value={chapterType}
                onChange={e => setChapterType(e.target.value)}
                style={{ display: 'flex', gap: 24 }}
              >
                <Radio value="fixed">固定章节</Radio>
                <Radio value="dynamic">动态章节</Radio>
                <Radio value="rich_text">仅正文(富文本)</Radio>
              </Radio.Group>
            </div>

            {chapterType === 'fixed' && (
              <div style={{ marginBottom: 16 }}>
                <ChapterList chapters={chapters} onChange={setChapters} />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8 }}>
        <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
          采编要求
        </label>
        <Input.TextArea
          rows={4}
          value={editingRequirements}
          onChange={e => setEditingRequirements(e.target.value)}
          placeholder="请输入采编要求"
        />
      </div>
    </div>
  );
};

export default StepKnowledgeModel;
