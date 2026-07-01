import React, { useState, useMemo, useEffect } from 'react';
import { Button, Table, Input, Select, Tree, Tooltip, InputNumber, DatePicker, Space } from 'antd';
const { RangePicker } = DatePicker;
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
  chapterFieldsValues?: Record<string, any>;
  onChapterFieldsValuesChange?: (values: Record<string, any>) => void;
  disabled?: boolean;
}

const ChapterList: React.FC<ChapterListProps> = ({ 
  chapters, 
  onChange, 
  editable = false,
  selectedChapterId,
  onSelectChapter,
  documentConstants,
  chapterFieldsValues = {},
  onChapterFieldsValuesChange,
  disabled = false,
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
                  style={{ fontSize: 12, color: 'var(--primary-color)' }} 
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

  const renderFieldValueControl = (field: SimpleTableRow, value: any, onChange: (value: any) => void) => {
    const inputHeight = 32;
    
    switch (field.field_type) {
      case 'boolean':
        return (
          <Select 
            value={value !== undefined ? value : undefined}
            style={{ width: '100%', height: inputHeight }}
            onChange={onChange}
            allowClear
            disabled={disabled}
          >
            <Select.Option value={true}>true</Select.Option>
            <Select.Option value={false}>false</Select.Option>
          </Select>
        );
      case 'long':
      case 'integer':
        return (
          <InputNumber 
            value={value}
            style={{ width: '100%', height: inputHeight }} 
            precision={0}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 'float':
      case 'double':
        return (
          <InputNumber 
            value={value}
            style={{ width: '100%', height: inputHeight }} 
            step={0.01}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 'date':
        return (
          <DatePicker 
            value={value ? dayjs(value) : null}
            style={{ width: '100%', height: inputHeight }} 
            showTime 
            locale={zhCN}
            onChange={(_, dateString) => onChange(dateString)}
            disabled={disabled}
          />
        );
      case 'integer_range':
      case 'long_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber 
              value={Array.isArray(value) && value[0] !== undefined ? value[0] : undefined}
              precision={0} 
              placeholder="最小值" 
              style={{ height: inputHeight, flex: 1 }}
              onChange={(v) => {
                const currentArr = Array.isArray(value) ? value : [undefined, undefined];
                onChange([v, currentArr[1]]);
              }}
              disabled={disabled}
            />
            <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
            <InputNumber 
              value={Array.isArray(value) && value[1] !== undefined ? value[1] : undefined}
              precision={0} 
              placeholder="最大值" 
              style={{ height: inputHeight, flex: 1 }}
              onChange={(v) => {
                const currentArr = Array.isArray(value) ? value : [undefined, undefined];
                onChange([currentArr[0], v]);
              }}
              disabled={disabled}
            />
          </Space>
        );
      case 'float_range':
        return (
          <Space style={{ width: '100%' }}>
            <InputNumber 
              value={Array.isArray(value) && value[0] !== undefined ? value[0] : undefined}
              step={0.01} 
              placeholder="最小值" 
              style={{ height: inputHeight, flex: 1 }}
              onChange={(v) => {
                const currentArr = Array.isArray(value) ? value : [undefined, undefined];
                onChange([v, currentArr[1]]);
              }}
              disabled={disabled}
            />
            <span style={{ color: '#999', alignSelf: 'center' }}>~</span>
            <InputNumber 
              value={Array.isArray(value) && value[1] !== undefined ? value[1] : undefined}
              step={0.01} 
              placeholder="最大值" 
              style={{ height: inputHeight, flex: 1 }}
              onChange={(v) => {
                const currentArr = Array.isArray(value) ? value : [undefined, undefined];
                onChange([currentArr[0], v]);
              }}
              disabled={disabled}
            />
          </Space>
        );
      case 'date_range':
        return (
          <RangePicker
            value={value && Array.isArray(value) && value[0] && value[1] ? [dayjs(value[0]), dayjs(value[1])] : null}
            onChange={(_, dateStrings) => onChange(dateStrings)}
            style={{ width: '100%', height: inputHeight }}
            showTime
            locale={zhCN}
            disabled={disabled}
          />
        );
      case 'object':
        return (
          <Input 
            value={typeof value === 'string' ? value : JSON.stringify(value || {})}
            style={{ width: '100%', height: inputHeight }}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{"key": "value"}'
            disabled={disabled}
          />
        );
      case 'array':
        return (
          <Input 
            value={typeof value === 'string' ? value : JSON.stringify(value || [])}
            style={{ width: '100%', height: inputHeight }}
            onChange={(e) => onChange(e.target.value)}
            placeholder='["item1", "item2"]'
            disabled={disabled}
          />
        );
      case 'text':
      case 'keyword':
      default:
        return (
          <Input 
            value={value || ''}
            style={{ width: '100%', height: inputHeight }}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  const renderFormFields = (chapter: Chapter) => {
    const fields = chapter.fields;
    if (!fields || fields.length === 0) return null;
    
    const chapterValues = chapterFieldsValues[chapter.id] || {};
    
    const handleFieldChange = (fieldId: string, value: any) => {
      const newChapterValues = {
        ...chapterFieldsValues,
        [chapter.id]: {
          ...chapterValues,
          [fieldId]: value,
        },
      };
      onChapterFieldsValuesChange?.(newChapterValues);
    };

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
              {field.field_name}{field.field_code ? `（${field.field_code}）` : ''}
              {field.is_required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
              {field.description && (
                <Tooltip title={field.description}>
                  <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
                </Tooltip>
              )}
            </span>
            <div style={{ flex: 1 }}>
              {renderFieldValueControl(field, chapterValues[field.id], (value) => handleFieldChange(field.id, value))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListFields = (chapter: Chapter) => {
    const fields = chapter.fields;
    if (!fields || fields.length === 0) return null;
    
    const chapterValues = chapterFieldsValues[chapter.id] || {};
    const listData = chapterValues.list_data || [];
    
    const handleAddRow = () => {
      const newRow: Record<string, any> = {};
      fields.forEach(field => {
        const fieldKey = field.id;
        // 根据字段类型设置初始值
        switch (field.field_type) {
          case 'object':
            newRow[fieldKey] = {};
            break;
          case 'array':
            newRow[fieldKey] = [];
            break;
          case 'integer_range':
          case 'long_range':
          case 'float_range':
          case 'date_range':
            newRow[fieldKey] = [undefined, undefined];
            break;
          default:
            newRow[fieldKey] = undefined;
        }
      });
      
      const newChapterValues = {
        ...chapterFieldsValues,
        [chapter.id]: {
          ...chapterValues,
          list_data: [...listData, newRow],
        },
      };
      onChapterFieldsValuesChange?.(newChapterValues);
    };
    
    const handleCellChange = (rowIndex: number, fieldCode: string, value: any) => {
      const newListData = [...listData];
      newListData[rowIndex] = {
        ...newListData[rowIndex],
        [fieldCode]: value,
      };
      
      const newChapterValues = {
        ...chapterFieldsValues,
        [chapter.id]: {
          ...chapterValues,
          list_data: newListData,
        },
      };
      onChapterFieldsValuesChange?.(newChapterValues);
    };
    
    const handleDeleteRow = (rowIndex: number) => {
      const newListData = listData.filter((_: any, index: number) => index !== rowIndex);
      
      const newChapterValues = {
        ...chapterFieldsValues,
        [chapter.id]: {
          ...chapterValues,
          list_data: newListData,
        },
      };
      onChapterFieldsValuesChange?.(newChapterValues);
    };

    const columns = fields.map(field => ({
      title: (
        <span style={{ whiteSpace: 'nowrap' }}>
          {field.field_code ? `${field.field_name}（${field.field_code}）` : field.field_name}
          {field.is_required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
          {field.description && (
            <Tooltip title={field.description}>
              <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 14 }} />
            </Tooltip>
          )}
        </span>
      ),
      dataIndex: field.id,
      key: field.id,
      render: (value: any, record: any, rowIndex: number) => {
        return renderFieldValueControl(
          field,
          value,
          (newValue) => handleCellChange(rowIndex, field.id, newValue)
        );
      },
    }));
    
    // 添加操作列
    columns.push({
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_: any, __: any, rowIndex: number) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteRow(rowIndex)}
          disabled={disabled}
        />
      ),
    });

    return (
      <div style={{ padding: 16 }}>
        {!disabled && (
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
              size="small"
            >
              新增
            </Button>
          </div>
        )}
        <Table
          dataSource={listData}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          locale={{ emptyText: disabled ? '' : '暂无数据，请点击"新增"添加数据' }}
          rowKey={(_, index) => `row_${index}`}
        />
      </div>
    );
  };

  const renderRichTextEditor = (chapter: Chapter) => {
    const chapterValues = chapterFieldsValues[chapter.id] || {};
    const richTextContent = chapterValues.rich_text_content || '';
    
    const handleRichTextChange = (value: string) => {
      const newChapterValues = {
        ...chapterFieldsValues,
        [chapter.id]: {
          ...chapterValues,
          rich_text_content: value,
        },
      };
      onChapterFieldsValuesChange?.(newChapterValues);
    };

    return (
      <div style={{ padding: 16 }}>
        <MDEditorTheme
          value={richTextContent}
          onChange={handleRichTextChange}
          height={300}
          placeholder={disabled ? "该区域为只读模式" : "请输入内容"}
          disabled={disabled}
        />
      </div>
    );
  };

  const renderChapterContent = (chapter: Chapter) => {
    switch (chapter.type) {
      case 'form':
        return renderFormFields(chapter);
      case 'list':
        return renderListFields(chapter);
      case 'rich_text':
        return renderRichTextEditor(chapter);
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
              background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)',
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