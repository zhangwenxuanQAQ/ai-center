import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import { useBuildCategorizeHandlePositions } from './hooks';
import styles from './node.module.less';
import { NodeBody, NodeContent } from './node_body';

const RightHandleStyle = {};

interface ICategorizeNode {
  name?: string;
  label?: string;
  form?: {
    llm_id?: string;
    category_description?: Record<string, { index: number }>;
  };
}

export function CategorizeNode({
  id,
  data,
  selected,
}: NodeProps<ICategorizeNode>) {
  const { positions } = useBuildCategorizeHandlePositions({ data, id });
  const theme = getTheme();
  return (
    <section
      className={classNames(
        styles.logicNode,
        theme === 'dark' ? styles.dark : '',
        {
          [styles.selectedNode]: selected,
        },
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable
        className={styles.handle}
        id={'a'}
      ></Handle>

      <NodeBody label={data.label} name={data.name}>
        <Flex vertical gap={8}>
          <NodeContent>
            LLM: {get(data, 'form.llm_id', '未选择')}
          </NodeContent>
          {positions.map((position, idx) => {
            return (
              <div key={idx}>
                <div className={styles.nodeText}>{position.text}</div>
                <Handle
                  key={position.text}
                  id={position.text}
                  type="source"
                  position={Position.Right}
                  isConnectable
                  className={styles.handle}
                  style={{ ...RightHandleStyle, top: position.top }}
                ></Handle>
              </div>
            );
          })}
        </Flex>
      </NodeBody>
    </section>
  );
}
