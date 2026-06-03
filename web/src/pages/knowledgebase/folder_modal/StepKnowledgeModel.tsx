import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { Card, Switch, Radio, Input } from 'antd';
import TagsInput from '../../../components/TagsInput';
import DynamicTable, { DynamicTableRow, DynamicTableRef } from '../../../components/DynamicTable';
import ChapterList from '../../../components/ChapterList';
import { Chapter } from './AddChapterModal';
import { FileOutlined, UploadOutlined, FileTextOutlined, BookOutlined, SettingOutlined, IconType } from '@ant-design/icons';

interface StepKnowledgeModelProps {
  knowledgeTags: string[];
  setKnowledgeTags: (tags: string[]) => void;
  selectedTemplate: string;
  setSelectedTemplate: (template: string) => void;
  customFields: DynamicTableRow[];
  setCustomFields: (fields: DynamicTableRow[]) => void;
  hasKnowledgeContent: boolean;
  setHasKnowledgeContent: (value: boolean) => void;
  chapterType: string;
  setChapterType: (type: string) => void;
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;
  editingRequirements: string;
  setEditingRequirements: (value: string) => void;
  knowledgeTemplates: Array<{
    key: string;
    title: string;
    description: string;
    icon: string;
  }>;
  documentConstants?: any;
}

export interface StepKnowledgeModelRef {
  validateCustomFields: () => boolean;
}

// 图标映射
const iconMap: Record<string, IconType> = {
  'UploadOutlined': UploadOutlined,
  'FileTextOutlined': FileTextOutlined,
  'BookOutlined': BookOutlined,
  'SettingOutlined': SettingOutlined,
  'FileOutlined': FileOutlined,
};

const StepKnowledgeModel = forwardRef<StepKnowledgeModelRef, StepKnowledgeModelProps>(({
  knowledgeTags,
  setKnowledgeTags,
  selectedTemplate,
  setSelectedTemplate,
  customFields,
  setCustomFields,
  hasKnowledgeContent,
  setHasKnowledgeContent,
  chapterType,
  setChapterType,
  chapters,
  setChapters,
  editingRequirements,
  setEditingRequirements,
  knowledgeTemplates,
  documentConstants,
}, ref) => {
  const dynamicTableRef = useRef<DynamicTableRef>(null);

  useImperativeHandle(ref, () => ({
    validateCustomFields: () => {
      if (selectedTemplate !== 'custom_template') {
        return true;
      }
      return dynamicTableRef.current?.validate() ?? true;
    }
  }));
  // 使用从后端获取的模板数据，如果没有则使用默认数据
  const templateCards = knowledgeTemplates.length > 0 ? knowledgeTemplates : [
    {
      key: 'file',
      title: '文件',
      description: '上传本地文件/选择文件数据源快速录入知识',
      icon: 'FileOutlined',
    },
    {
      key: 'rich_text',
      title: '富文本',
      description: '富文本框录入知识',
      icon: 'FileTextOutlined',
    },
/*     {
      key: 'template',
      title: '从模版库选择',
      description: '选择模版快速新建',
      icon: 'BookOutlined',
    }, */
    {
      key: 'custom_template',
      title: '自定义模版',
      description: '根据业务自定义模版采编知识',
      icon: 'SettingOutlined',
    },
  ];

  // 获取图标组件
  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent style={{ fontSize: 24 }} /> : null;
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>
          知识标签
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
          {templateCards.map(card => {
            const isSelected = selectedTemplate === card.key;
            return (
              <Card
                key={card.key}
                onClick={() => setSelectedTemplate(card.key)}
                className={`knowledge-template-card ${isSelected ? 'selected' : ''}`}
                hoverable
              >
                <div className="knowledge-template-card-content">
                  <div className="knowledge-template-icon">{getIcon(card.icon)}</div>
                  <div className="knowledge-template-title">{card.title}</div>
                  <div className="knowledge-template-description">{card.description}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {selectedTemplate === 'custom_template' && (
        <>
          <div style={{ 
            marginTop: 24, 
            padding: 16, 
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <DynamicTable
              ref={dynamicTableRef}
              value={customFields}
              onChange={setCustomFields}
              label="基础属性"
              fieldTypes={documentConstants?.metadata_field_types || []}
            />

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 500, marginRight: 8 }}>
                  知识正文
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
                      <ChapterList 
                        chapters={chapters} 
                        onChange={setChapters} 
                        editable={true}
                        documentConstants={documentConstants}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 24 }}>
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
