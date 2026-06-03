import React, { useState, useMemo, useEffect } from 'react';
import { Button, Table, Input, Select, Tree, Tooltip, InputNumber, DatePicker, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import MDEditorTheme from './MDEditorTheme';
import { AddChapterModal, Chapter } from '../pages/knowledgebase/folder_modal/AddChapterModal';
import { SimpleTableRow } from './SimpleEditableTable';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import zhCN from 'antd/es/date-picker/locale/zh_CN';

interface ChapterListProps {
  chapters: Chapter[];
  onChange: (chapters: Chapter[]) => void;
  editable?: boolean;
  selectedChapterId?: string;
  onSelectChapter?: (chapterId: string | null) => void;
  documentConstants?: any;
}

const ChapterList: React.FC<ChapterListProps> = ({ 
  chapters, 
  onChange, 
  editable = false,
  selectedChapterId,
  onSelectChapter,
  documentConstants,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedChapterId || null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const allChapterIds = useMemo(() => chapters.map(ch => ch.id), [chapters]);

  useEffect(() => {
    if (chapters.length > 0 && expandedKeys.length === 0) {
      setExpandedKeys(allChapterIds);
    }
  }, [chapters, allChapterIds]);

  const handleSelect = (chapterId: string) => {
    setLocalSelectedId(chapterId);
    onSelectChapter?.(chapterId);
  };

  const handleAddChapter = (chapter: Chapter) => {
    onChange([...chapters, chapter]);
    setLocalSelectedId(chapter.id);
    onSelectChapter?.(chapter.id);
    if (chapter.parentId && !expandedKeys.includes(chapter.parentId)) {
      setExpandedKeys([...expandedKeys, chapter.parentId]);
    }
  };

  const handleUpdateChapter = (updatedChapter: Chapter) => {
    onChange(chapters.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));
    setEditingChapter(null);
    setShowEditModal(false);
  };

  const handleDeleteChapter = (chapterId: string) => {
    const deleteRecursive = (id: string): string[] => {
      const children = chapters.filter(ch => ch.parentId === id);
      let idsToDelete = [id];
      children.forEach(child => {
        idsToDelete = idsToDelete.concat(deleteRecursive(child.id));
      });
      return idsToDelete;
    };
    
    const idsToDelete = deleteRecursive(chapterId);
    onChange(chapters.filter(ch => !idsToDelete.includes(ch.id)));
    
    if (localSelectedId && idsToDelete.includes(localSelectedId)) {
      setLocalSelectedId(null);
      onSelectChapter?.(null);
    }
  };

  const selectedChapter = chapters.find(chapter => chapter.id === localSelectedId);

  const buildTreeData = useMemo(() => {
    const buildNode = (chapter: Chapter): TreeDataNode => {
      const children = chapters.filter(ch => ch.parentId === chapter.id);
      return {
        title: (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              width: '100%',
              paddingRight: 8,
            }}
          >
            <span>{chapter.name}</span>
            {editable && (
              <span 
                style={{ display: 'flex', gap: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                <EditOutlined 
                  style={{ fontSize: 12, color: '#667eea' }} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingChapter(chapter);
                    setShowEditModal(true);
                  }}
                />
                <DeleteOutlined 
                  style={{ fontSize: 12, color: '#ff4d4f' }} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChapter(chapter.id);
                  }}
                />
              </span>
            )}
          </div>
        ),
        key: chapter.id,
        children: children.length > 0 ? children.map(buildNode) : undefined,
      };
    };

    const rootChapters = chapters.filter(ch => !ch.parentId);
    return rootChapters.map(buildNode);
  }, [chapters, editable]);

  const handleTreeSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length > 0) {
      const key = keys[0] as string;
      handleSelect(key);
    }
  };

  const handleTreeExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys as string[]);
  };

  const renderFieldValueControl = (field: SimpleTableRow) => {
    const inputHeight = 32;
    
    switch (field.fieldType) {
      case 'boolean':
        return (
          <Select disabled style={{ width: '100%', height: inputHeight }}>
            <Select.Option value={true}>true</Select.Option>
            <Select.Option value={false}>false</Select.Option>
          </Select>
        );
      case 'long':
      case 'integer':
        return (
          <InputNumber disabled style={{ width: '100%', height: inputHeight }} precision={0} />
        );
      case 'float':
      case 'double':
        return (
          <InputNumber disabled style={{ width: '100%', height: inputHeight }} step={0.01} />
        );
      case 'date':
        return (
          <DatePicker disabled style={{ width: '100%', height: inputHeight }} showTime locale={zhCN} />
        );
      case 'integer_range':
      case 'long_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber disabled precision={0} placeholder="最小值" style={{ height: inputHeight, flex: 1 }} />
            <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
            <InputNumber disabled precision={0} placeholder="最大值" style={{ height: inputHeight, flex: 1 }} />
          </Space>
        );
      case 'float_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber disabled step={0.01} placeholder="最小值" style={{ height: inputHeight, flex: 1 }} />
            <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
            <InputNumber disabled step={0.01} placeholder="最大值" style={{ height: inputHeight, flex: 1 }} />
          </Space>
        );
      case 'text':
      case 'keyword':
      default:
        return (
          <Input disabled style={{ width: '100%', height: inputHeight }} />
        );
    }
  };

  const renderFormFields = (fields?: SimpleTableRow[], editableField = false) => {
    if (!fields || fields.length === 0) return null;

    return (
      <div style={{ padding: 16 }}>
        {fields.map(field => (
          <div 
            key={field.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 16,
              gap: 16 
            }}
          >
            <span style={{ 
              fontWeight: 500, 
              minWidth: 150,
              textAlign: 'left',
            }}>
              {field.fieldName}{field.fieldCode ? `（${field.fieldCode}）` : ''}
              {field.isRequired && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
              {field.description && (
                <Tooltip title={field.description}>
                  <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
                </Tooltip>
              )}
            </span>
            <div style={{ flex: 1 }}>
              {renderFieldValueControl(field)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListFields = (fields?: SimpleTableRow[], editableField = false) => {
    if (!fields || fields.length === 0) return null;

    const columns = fields.map(field => ({
      title: (
        <span>
          {field.fieldCode ? `${field.fieldName}（${field.fieldCode}）` : field.fieldName}
          {field.description && (
            <Tooltip title={field.description}>
              <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
            </Tooltip>
          )}
        </span>
      ),
      dataIndex: field.fieldCode,
      key: field.fieldCode,
    }));

    return (
      <div style={{ padding: 16 }}>
        <Table
          dataSource={[]}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          locale={{ emptyText: '暂无数据' }}
        />
      </div>
    );
  };

  const renderRichTextEditor = (editableField = false) => {
    return (
      <div style={{ padding: 16 }}>
        <MDEditorTheme
          height={300}
          placeholder="该区域为只读模式"
          disabled={true}
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
        <div style={{ width: 240, borderRight: '1px solid #e8e8e8', paddingRight: 16 }}>
          {chapters.length > 0 ? (
            <Tree
              showLine
              selectedKeys={localSelectedId ? [localSelectedId] : []}
              expandedKeys={expandedKeys}
              onSelect={handleTreeSelect}
              onExpand={handleTreeExpand}
              treeData={buildTreeData}
              style={{
                background: 'transparent',
                fontSize: 13,
              }}
            />
          ) : (
            <div style={{ color: '#999', padding: '8px 12px' }}>暂无章节</div>
          )}
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
        documentConstants={documentConstants}
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
          editingChapter={editingChapter}
          documentConstants={documentConstants}
        />
      )}
    </div>
  );
};

export default ChapterList;