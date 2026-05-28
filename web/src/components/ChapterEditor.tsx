import React, { useState } from 'react';
import { Button, Table, Input, Select, Form, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CancelOutlined } from '@ant-design/icons';
import MDEditorTheme from './MDEditorTheme';
import { AddChapterModal, Chapter } from '../pages/knowledgebase/folder_modal/AddChapterModal';
import { SimpleTableRow } from './SimpleEditableTable';

interface ChapterEditorProps {
  // 章节类型：fixed（固定章节）、dynamic（动态章节）、rich_text_only（仅正文）
  chapterType: 'fixed' | 'dynamic' | 'rich_text_only';
  // 章节列表（用于固定章节和动态章节）
  chapters: Chapter[];
  // 章节变化回调
  onChaptersChange: (chapters: Chapter[]) => void;
  // 当前选中的章节ID
  selectedChapterId?: string;
  onSelectChapter?: (chapterId: string | null) => void;
}

interface ListRowData {
  id: string;
  [key: string]: any;
}

const ChapterEditor: React.FC<ChapterEditorProps> = ({
  chapterType,
  chapters,
  onChaptersChange,
  selectedChapterId,
  onSelectChapter,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(selectedChapterId || null);
  const [chapterContents, setChapterContents] = useState<Record<string, string>>({});
  // 列表数据状态 - 存储每个章节的列表数据
  const [listData, setListData] = useState<Record<string, ListRowData[]>>({});
  // 正在编辑的列表行
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  // 正在编辑的单元格值
  const [editingCellValue, setEditingCellValue] = useState<string>('');

  const handleSelect = (chapterId: string) => {
    setLocalSelectedId(chapterId);
    onSelectChapter?.(chapterId);
  };

  const handleAddChapter = (chapter: Chapter) => {
    const newChapter: Chapter = {
      ...chapter,
      type: chapterType === 'dynamic' ? 'rich_text' : chapter.type,
    };
    onChaptersChange([...chapters, newChapter]);
    setLocalSelectedId(newChapter.id);
    onSelectChapter?.(newChapter.id);
    // 初始化章节内容
    if (!chapterContents[newChapter.id]) {
      setChapterContents({ ...chapterContents, [newChapter.id]: '' });
    }
  };

  const handleUpdateChapter = (updatedChapter: Chapter) => {
    onChaptersChange(chapters.map(ch => ch.id === updatedChapter.id ? updatedChapter : ch));
    setEditingChapter(null);
    setShowEditModal(false);
  };

  const handleDeleteChapter = (chapterId: string) => {
    onChaptersChange(chapters.filter(ch => ch.id !== chapterId));
    const newContents = { ...chapterContents };
    delete newContents[chapterId];
    setChapterContents(newContents);
    if (localSelectedId === chapterId) {
      setLocalSelectedId(null);
      onSelectChapter?.(null);
    }
  };

  const handleContentChange = (chapterId: string, content: string) => {
    setChapterContents({ ...chapterContents, [chapterId]: content });
  };

  const selectedChapter = chapters.find(chapter => chapter.id === localSelectedId);

  // 仅正文模式：直接显示富文本编辑器
  if (chapterType === 'rich_text_only') {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>知识正文</span>
        </div>
        <Input.TextArea
          rows={15}
          placeholder="请输入知识正文内容..."
          style={{ width: '100%', fontFamily: 'monospace' }}
          value={chapterContents['content'] || ''}
          onChange={(e) => handleContentChange('content', e.target.value)}
        />
      </div>
    );
  }

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
                <Input placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'textarea' && (
                <Input.TextArea rows={3} placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'number' && (
                <Input type="number" placeholder={field.description || `请输入${field.fieldName}`} />
              )}
              {field.fieldType === 'select' && (
                <Select placeholder={field.description || `请选择${field.fieldName}`}>
                  {field.fieldDict?.split(',').map(item => (
                    <Select.Option key={item} value={item}>{item}</Select.Option>
                  ))}
                </Select>
              )}
              {field.fieldType === 'date' && (
                <Input type="date" />
              )}
              {field.fieldType === 'radio' && (
                <div style={{ color: '#666' }}>单选框</div>
              )}
              {field.fieldType === 'checkbox' && (
                <div style={{ color: '#666' }}>多选框</div>
              )}
              {field.fieldType === 'file' && (
                <div style={{ color: '#666' }}>文件上传框</div>
              )}
              {field.fieldType === 'select_multiple' && (
                <Select mode="multiple" placeholder={field.description || `请选择${field.fieldName}`}>
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

  // 获取章节的列表数据
  const getChapterListData = (chapterId: string): ListRowData[] => {
    return listData[chapterId] || [];
  };

  // 添加列表行
  const handleAddListRow = (chapterId: string, fields: SimpleTableRow[]) => {
    const currentData = getChapterListData(chapterId);
    const newRowId = `row_${Date.now()}`;
    const newRow: ListRowData = { id: newRowId };
    fields.forEach(field => {
      newRow[field.fieldCode] = '';
    });
    setListData({ ...listData, [chapterId]: [...currentData, newRow] });
  };

  // 删除列表行
  const handleDeleteListRow = (chapterId: string, rowId: string) => {
    const currentData = getChapterListData(chapterId);
    setListData({ ...listData, [chapterId]: currentData.filter(row => row.id !== rowId) });
  };

  // 编辑列表单元格
  const handleEditListCell = (chapterId: string, rowId: string, fieldCode: string, value: any) => {
    const currentData = getChapterListData(chapterId);
    setListData({
      ...listData,
      [chapterId]: currentData.map(row =>
        row.id === rowId ? { ...row, [fieldCode]: value } : row
      ),
    });
  };

  // 根据字段类型渲染表单组件
  const renderFieldComponent = (field: SimpleTableRow, value: any, onChange: (value: any) => void) => {
    const { fieldType, fieldCode, fieldDict, description, isRequired } = field;
    
    const requiredMark = isRequired ? <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span> : null;
    
    switch (fieldType) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={description || `请输入${field.fieldName}`}
            style={{ width: '100%' }}
            required={isRequired}
          />
        );
      case 'textarea':
        return (
          <Input.TextArea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={description || `请输入${field.fieldName}`}
            rows={2}
            style={{ width: '100%' }}
            required={isRequired}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={description || `请输入${field.fieldName}`}
            style={{ width: '100%' }}
            required={isRequired}
          />
        );
      case 'select':
        return (
          <Select
            value={value || undefined}
            onChange={(v) => onChange(v)}
            placeholder={description || `请选择${field.fieldName}`}
            style={{ width: '100%' }}
            required={isRequired}
          >
            {fieldDict?.split(',').map(item => (
              <Select.Option key={item.trim()} value={item.trim()}>{item.trim()}</Select.Option>
            ))}
          </Select>
        );
      case 'select_multiple':
        return (
          <Select
            mode="multiple"
            value={value || []}
            onChange={(v) => onChange(v)}
            placeholder={description || `请选择${field.fieldName}`}
            style={{ width: '100%' }}
            required={isRequired}
          >
            {fieldDict?.split(',').map(item => (
              <Select.Option key={item.trim()} value={item.trim()}>{item.trim()}</Select.Option>
            ))}
          </Select>
        );
      case 'date':
        return (
          <DatePicker
            value={value ? new Date(value) : null}
            onChange={(date) => onChange(date ? date.format('YYYY-MM-DD') : '')}
            style={{ width: '100%' }}
            required={isRequired}
          />
        );
      case 'radio':
        return (
          <div>
            {fieldDict?.split(',').map(item => (
              <label key={item.trim()} style={{ marginRight: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`${fieldCode}_radio`}
                  value={item.trim()}
                  checked={value === item.trim()}
                  onChange={(e) => onChange(e.target.value)}
                />
                {item.trim()}
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <div>
            {fieldDict?.split(',').map(item => (
              <label key={item.trim()} style={{ marginRight: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  value={item.trim()}
                  checked={(value || []).includes(item.trim())}
                  onChange={(e) => {
                    const current = value || [];
                    if (e.target.checked) {
                      onChange([...current, item.trim()]);
                    } else {
                      onChange(current.filter((v: string) => v !== item.trim()));
                    }
                  }}
                />
                {item.trim()}
              </label>
            ))}
          </div>
        );
      case 'file':
        return (
          <div style={{ color: '#666', fontSize: 12 }}>文件上传</div>
        );
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={description || `请输入${field.fieldName}`}
            style={{ width: '100%' }}
            required={isRequired}
          />
        );
    }
  };

  const renderListFields = (fields?: SimpleTableRow[]) => {
    if (!fields || fields.length === 0) return null;

    const chapterId = localSelectedId || '';
    const currentData = getChapterListData(chapterId);

    const columns = fields.map(field => ({
      title: (
        <span>
          {field.fieldName}
          {field.isRequired && <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>}
        </span>
      ),
      dataIndex: field.fieldCode,
      key: field.fieldCode,
      width: Math.floor(100 / (fields.length + 1)), // 平均分配宽度
      render: (_: any, record: ListRowData) => {
        return renderFieldComponent(
          field,
          record[field.fieldCode],
          (value) => handleEditListCell(chapterId, record.id, field.fieldCode, value)
        );
      },
    }));

    columns.push({
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: ListRowData) => (
        <Popconfirm
          title="确定删除此行？"
          onConfirm={() => handleDeleteListRow(chapterId, record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />}>
            删除
          </Button>
        </Popconfirm>
      ),
    });

    return (
      <div
        style={{
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          padding: 16,
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => handleAddListRow(chapterId, fields)}
          >
            添加行
          </Button>
        </div>
        <Table
          dataSource={currentData.length > 0 ? currentData : [{ id: 'empty', _empty: true }]}
          columns={columns}
          pagination={false}
          size="small"
          bordered
          rowKey="id"
        />
      </div>
    );
  };

  const renderRichTextEditor = (chapterId: string) => {
    return (
      <div style={{ padding: 16 }}>
        {/* <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>富文本内容</span>
        </div> */}
        <MDEditorTheme
          height={300}
          placeholder="请输入内容..."
          value={chapterContents[chapterId] || ''}
          onChange={(value) => handleContentChange(chapterId, value)}
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
        return renderRichTextEditor(chapter.id);
      default:
        return null;
    }
  };

  // 动态章节模式下可编辑章节结构（添加、编辑、删除章节）
  // 固定章节模式下只能编辑章节内容，不能修改章节结构
  const isEditable = chapterType === 'dynamic';
  // 固定章节模式下可以查看章节结构
  const isFixedMode = chapterType === 'fixed';

  return (
    <div>
      {/* 只有动态章节模式下可以添加章节 */}
      {isEditable && (
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
            添加章节
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 200, borderRight: '1px solid #e8e8e8', paddingRight: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>章节列表</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chapters.length > 0 ? chapters.map((chapter) => (
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
                {isEditable && (
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
        // 动态章节模式下仅显示富文本类型，固定章节模式下可以选择所有类型
        richTextOnly={chapterType === 'dynamic'}
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
          richTextOnly={chapterType === 'dynamic'}
        />
      )}
    </div>
  );
};

export default ChapterEditor;