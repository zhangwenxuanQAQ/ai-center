/**
 * 任务结果抽屉分发器：按任务类型渲染对应的结果抽屉
 */

import React from 'react';
import { TaskResult } from '../../../services/taskCenter';
import { TASK_TYPE } from '../constants';
import ApiTaskResult from './api_task_result';
import DataExtractResult from './data_extract_result';
import DocChunkResult from './doc_chunk_result';

interface TaskResultDrawerProps {
  open: boolean;
  taskType: string;
  result: TaskResult | null;
  loading: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
}

/** 按任务类型渲染对应结果抽屉 */
const TaskResultDrawer: React.FC<TaskResultDrawerProps> = (props) => {
  const { taskType } = props;
  switch (taskType) {
    case TASK_TYPE.DATA_EXTRACT:
      return <DataExtractResult {...props} />;
    case TASK_TYPE.API:
      return <ApiTaskResult {...props} />;
    case TASK_TYPE.DOC_CHUNK:
      return <DocChunkResult {...props} />;
    default:
      return null;
  }
};

export default TaskResultDrawer;
