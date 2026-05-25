import React, { useState } from 'react';
import { Button, Table, Input, Select, Switch, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AddChapterModal, Chapter } from '../pages/knowledgebase/folder_modal/AddChapterModal';
import { SimpleTableRow } from './SimpleEditableTable';

interface ChapterListProps {
  chapters: Chapter[];
  onChange: (chapters: Chapter[]) => void;
  // 是否可编辑（用于新增目录时）
  editable?: boolean;
  // 当前选中的章节ID
  selectedChapterId?: string;
  onSelectChapter?: (chapterId: string | null) => void;
}

const ChapterList: React.FC<ChapterListProps> = ({ 
  chapters, 
  onChange, 
  editable = false,
  selectedChapterId,
  onSelectChapter 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedChapterId || null);

  const handleSelect = (chapterId: string) => {
    setLocalSelectedId(chapterId);
    onSelectChapter?.(chapterId);
  };

  const handleAddChapter = (chapter: Chapter) => {
    onChange([...chapters, chapter]);
    setLocalSelectedId(chapter.id);
    onSelectChapter?.(chapter.id);
  };

  const handleUpdateChapter = (updatedChapter: Chapter) => {
    onChange(chapters.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));
    setEditingChapter(null);
    setShowEditModal(false);
  };

  const handleDeleteChapter = (chapterId: string) => {
    onChange(chapters.filter(ch => ch.id !== chapterId));
    if (localSelectedId === chapterId) {
      setLocalSelectedId(null);
      onSelectChapter?.(null);
    }
  };

  const selectedChapter = chapters.find(chapter => chapter.id === localSelectedId);

  const renderFormFields = (fields?: SimpleTableRow[], editableField = false) => {
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
                <Input 
                  disabled={!editableField}
                  placeholder={field.description || `请输入${field.fieldName}`} 
                />
              )}
              {field.fieldType === 'textarea' && (
                <Input.TextArea 
                  disabled={!editableField}
                  rows={3} 
                  placeholder={field.description || `请输入${field.fieldName}`} 
                />
              )}
              {field.fieldType === 'number' && (
                <Input 
                  type="number" 
                  disabled={!editableField}
                  placeholder={field.description || `请输入${field.fieldName}`} 
                />
              )}
              {field.fieldType === 'select' && (
                <Select 
                  disabled={!editableField}
                  placeholder={field.description || `请选择${field.fieldName}`}
                >
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item} value={item}>{item}</Select.Option>
                  ))}
                </Select>
              )}
              {field.fieldType === 'date' && (
                <Input type="date" disabled={!editableField} />
              )}
              {field.fieldType === 'radio' && (
                <div style={{ color: editableField ? '#666' : '#999' }}>单选框</div>
              )}
              {field.fieldType === 'checkbox' && (
                <div style={{ color: editableField ? '#666' : '#999' }}>多选框</div>
              )}
              {field.fieldType === 'file' && (
                <div style={{ color: editableField ? '#666' : '#999' }}>文件上传框</div>
              )}
              {field.fieldType === 'select_multiple' && (
                <Select 
                  disabled={!editableField}
                  mode="multiple" 
                  placeholder={field.description || `请选择${field.fieldName}`}
                >
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

  const renderListFields = (fields?: SimpleTableRow[], editableField = false) => {
    if (!fields || fields.length === 0) return null;

    const columns = fields.map(field => ({
      title: field.fieldName,
      dataIndex: field.fieldCode,
      key: field.fieldCode,
      render: () => <span style={{ color: editableField ? '#666' : '#999' }}>-</span>,
    }));

    columns.push({
      title: '操作',
      key: 'actions',
      width: 100,
      render: () => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" disabled={!editableField}>编辑</Button>
          <Button size="small" disabled={!editableField} danger>删除</Button>
        </div>
      ),
    });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="dashed" disabled={!editableField} style={{ opacity: editableField ? 1 : 0.5 }}>
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

  const renderRichTextEditor = (editableField = false) => {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 500, marginRight: 8 }}>富文本内容</span>
          {!editableField && <span style={{ color: '#999', fontSize: 12 }}>（只读模式）</span>}
        </div>
        <Input.TextArea
          disabled={!editableField}
          rows={12}
          placeholder={editableField ? '请输入富文本内容...' : '该区域为只读模式'}
          style={{ 
            width: '100%', 
            fontFamily: 'monospace',
            background: editableField ? '#fff' : '#f5f5f5'
          }}
        />
      </div>
    );
  };

  const renderChapterContent = (chapter: Chapter) => {
    switch (chapter.type) {
      case 'form':
        return renderFormFields(chapter.fields, editable);
      case 'list':
        return renderListFields(chapter.fields, editable);
      case 'rich_text':
        return renderRichTextEditor(editable);
      default:
        return null;
    }
  };

  return (
    <div>
      {editable && (
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
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 200, borderRight: '1px solid #e8e8e8', paddingRight: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>章节列表</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chapters.length > 0 ? chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                onClick={() => handleSelect(chapter.id)}
                style={{
                  padding: '8px 12px',
                  background: localSelectedId === chapter.id ? '#667eea' : undefined,
                  color: localSelectedId === chapter.id ? '#fff' : undefined,
                  border: localSelectedId === chapter.id ? '1px solid #fff' : undefined,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>{chapter.name}</span>
                {editable && (
                  <span style={{ display: 'flex', gap: 4 }}>
                    <EditOutlined 
                      style={{ fontSize: 12 }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChapter(chapter);
                        setShowEditModal(true);
                      }}
                    />
                    <DeleteOutlined 
                      style={{ fontSize: 12 }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChapter(chapter.id);
                      }}
                    />
                  </span>
                )}
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

      {editingChapter && (
        <AddChapterModal
          visible={showEditModal}
          chapters={chapters.filter(ch => ch.id !== editingChapter.id)}
          onCancel={() => {
            setShowEditModal(false);
            setEditingChapter(null);
          }}
          onAdd={handleUpdateChapter}
        />
      )}
    </div>
  );
};

export default ChapterList;