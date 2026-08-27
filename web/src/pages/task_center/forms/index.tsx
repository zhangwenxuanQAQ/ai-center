/**
 * 任务表单弹窗分发器：按任务类型渲染对应的新增/编辑弹窗
 */

import React from 'react';
import { TaskInfo } from '../../../services/taskCenter';
import { TASK_TYPE } from '../constants';
import ApiTaskForm from './api_task_form';
import DataExtractForm from './data_extract_form';
import DocChunkForm from './doc_chunk_form';

interface TaskFormModalProps {
  open: boolean;
  taskType: string;
  taskTypeLabel: string;
  editingTask: TaskInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

/** 按任务类型渲染对应表单弹窗 */
const TaskFormModal: React.FC<TaskFormModalProps> = (props) => {
  const { taskType } = props;
  switch (taskType) {
    case TASK_TYPE.DATA_EXTRACT:
      return <DataExtractForm {...props} />;
    case TASK_TYPE.API:
      return <ApiTaskForm {...props} />;
    case TASK_TYPE.DOC_CHUNK:
      return <DocChunkForm {...props} />;
    default:
      return null;
  }
};

export default TaskFormModal;
