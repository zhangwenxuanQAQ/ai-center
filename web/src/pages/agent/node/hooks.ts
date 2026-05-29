import { useUpdateNodeInternals } from '@xyflow/react';
import get from 'lodash/get';
import { useEffect, useMemo } from 'react';

interface ICategorizeItemResult {
  [key: string]: { index: number };
}

interface ISwitchCondition {
  items?: Array<{
    cpn_id?: string;
    operator?: string;
    value?: string;
  }>;
  logical_operator?: string;
}

interface RAGFlowNodeData {
  name?: string;
  label?: string;
  form?: Record<string, any>;
}

const SwitchElseTo = 'Else';

const generateSwitchHandleText = (idx: number): string => {
  return `Case ${idx + 1}`;
};

export const useBuildCategorizeHandlePositions = ({
  data,
  id,
}: {
  id: string;
  data: RAGFlowNodeData;
}) => {
  const updateNodeInternals = useUpdateNodeInternals();

  const categoryData: ICategorizeItemResult = useMemo(() => {
    return get(data, `form.category_description`, {});
  }, [data]);

  const positions = useMemo(() => {
    const list: Array<{
      text: string;
      top: number;
      idx: number;
    }> = [];

    Object.keys(categoryData)
      .sort((a, b) => categoryData[a].index - categoryData[b].index)
      .forEach((x, idx) => {
        list.push({
          text: x,
          idx,
          top: idx === 0 ? 98 + 20 : list[idx - 1].top + 8 + 26,
        });
      });

    return list;
  }, [categoryData]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, categoryData]);

  return { positions };
};

export const useBuildSwitchHandlePositions = ({
  data,
  id,
}: {
  id: string;
  data: RAGFlowNodeData;
}) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const conditions: ISwitchCondition[] = useMemo(() => {
    return get(data, 'form.conditions', []);
  }, [data]);

  const positions = useMemo(() => {
    const list: Array<{
      text: string;
      top: number;
      idx: number;
      condition?: ISwitchCondition;
    }> = [];

    [...conditions, ''].forEach((x, idx) => {
      let top = idx === 0 ? 58 + 20 : list[idx - 1].top + 32; // case number (Case 1) height + flex gap
      if (idx - 1 >= 0) {
        const previousItems = conditions[idx - 1]?.items ?? [];
        if (previousItems.length > 0) {
          top += 12; // ConditionBlock padding
          top += previousItems.length * 22; // condition variable height
          top += (previousItems.length - 1) * 25; // operator height
        }
      }

      list.push({
        text:
          idx < conditions.length
            ? generateSwitchHandleText(idx)
            : SwitchElseTo,
        idx,
        top,
        condition: typeof x === 'string' ? undefined : x,
      });
    });

    return list;
  }, [conditions]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, conditions]);

  return { positions };
};
