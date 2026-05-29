import { Handle, NodeProps, Position } from '@xyflow/react';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody, NodeContent } from './node_body';

const LeftHandleStyle = {};
const RightHandleStyle = {};

interface IGenerateNode {
  name?: string;
  label?: string;
  form?: {
    llm_id?: string;
  };
}

export function GenerateNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IGenerateNode>) {
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
        id="c"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className={styles.handle}
        style={LeftHandleStyle}
      ></Handle>
      <Handle
        id="b"
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={styles.handle}
        style={RightHandleStyle}
      ></Handle>

      <NodeBody label={data.label} name={data.name}>
        <NodeContent>
          LLM: {get(data, 'form.llm_id', '未选择')}
        </NodeContent>
      </NodeBody>
    </section>
  );
}
