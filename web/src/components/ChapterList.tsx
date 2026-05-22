import React, { useState } from 'react';
import { Button, Table, Input, Select, Switch, Form } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { AddChapterModal, Chapter } from '../pages/knowledgebase/folder_modal/AddChapterModal';
import { SimpleTableRow } from './SimpleEditableTable';

interface ChapterListProps {
  chapters: Chapter[];
  onChange: (chapters: Chapter[]) => void;
}

const ChapterList: React.FC<ChapterListProps> = ({ chapters, onChange }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const handleAddChapter = (chapter: Chapter) => {
    onChange([...chapters, chapter]);
    setSelectedChapterId(chapter.id);
  };

  const selectedChapter = chapters.find(chapter => chapter.id === selectedChapterId);

  const renderFormFields = (fields?: SimpleTableRow[]) => {
    if (!fields || fields.length === 0) return null;

    return (
      <div style={{ padding: 16 }}>
        <Form layout="vertical">
          {fields.map(field => (
            <Form.Item
              key={field.id}
              label={field.fieldName}
              required={field.isRequired}
            >
              {field.fieldType === 'text' && (
                <Input disabled placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'textarea' && (
                <Input.TextArea disabled rows={3} placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'number' && (
                <Input type="number" disabled placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'select' && (
                <Select disabled placeholder={field.description || `请选择${field.fieldName}`}>
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item} value={item}>{item}</Select.Option>
                  ))}
                </Select>
              )}
              {field.fieldType === 'date' && (
                <Input type="date" disabled />
              )}
              {field.fieldType === 'radio' && (
                <div style={{ color: '#999' }}>单选框</div>
              )}
              {field.fieldType === 'checkbox' && (
                <div style={{ color: '#999' }}>多选框</div>
              )}
              {field.fieldType === 'file' && (
                <div style={{ color: '#999' }}>文件上传框</div>
              )}
              {field.fieldType === 'select_multiple' && (
                <Select disabled mode="multiple" placeholder={field.description || `请选择${field.fieldName}`}>
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item} value={item}>{item}</Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>
          ))}
        </Form>
      </div>
    );
  };

  const renderListFields = (fields?: SimpleTableRow[]) => {
    if (!fields || fields.length === 0) return null;

    const columns = fields.map(field => ({
      title: field.fieldName,
      dataIndex: field.fieldCode,
      key: field.fieldCode,
      render: () => <span style={{ color: '#999' }}>-</span>,
    }));

    columns.push({
      title: '操作',
      key: 'actions',
      width: 100,
      render: () => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" disabled>编辑</Button>
          <Button size="small" disabled danger>删除</Button>
        </div>
      ),
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="dashed" disabled style={{ opacity: 0.5 }}>
            +添加
          </Button>
        </div>
        <Table
          dataSource={[{}]}
          columns={columns}
          pagination={false}
          size="small"
          bordered
        />
      </div>
    );
  };

  const renderChapterContent = (chapter: Chapter) => {
    switch (chapter.type) {
      case 'form':
        return renderFormFields(chapter.fields);
      case 'list':
        return renderListFields(chapter.fields);
      case 'rich_text':
        return (
          <div style={{ padding: 16, color: '#999' }}>
            富文本内容区域
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }}
        >
          添加章节目录
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 200, borderRight: '1px solid #e8e8e8', paddingRight: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>章节列表</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chapters.length > 0 ? chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                onClick={() => setSelectedChapterId(chapter.id)}
                style={{
                  padding: '8px 12px',
                  background:'#667eea',
                  // color: selectedChapterId === chapter.id ? '#fff' : undefined,
                  border:selectedChapterId === chapter.id ? '1px solid #fff' : undefined,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {chapter.icon && (
                  <img
                    src={chapter.icon}
                    alt=""
                    style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2 }}
                  />
                )}
                <span>{chapter.name}</span>
              </div>
            )) : (
              <div style={{ color: '#999', padding: '8px 12px' }}>暂无章节</div>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {selectedChapter ? (
            <div key={selectedChapter.id}>
              
              {renderChapterContent(selectedChapter)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
              {chapters.length > 0 ? '请选择一个章节' : '暂无章节内容'}
            </div>
          )}
        </div>
      </div>

      <AddChapterModal
        visible={showAddModal}
        chapters={chapters}
        onCancel={() => setShowAddModal(false)}
        onAdd={handleAddChapter}
      />
    </div>
  );
};

export default ChapterList;
