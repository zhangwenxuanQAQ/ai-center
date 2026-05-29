import { Handle, NodeProps, Position } from '@xyflow/react';
import classNames from 'classnames';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const LeftHandleStyle = {};
const RightHandleStyle = {};

interface IKeywordNode {
  name?: string;
  label?: string;
}

export function KeywordNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IKeywordNode>) {
  const theme = getTheme();
  return (
    <section
      className={classNames(
        styles.ragNode,
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
      <NodeBody label={data.label} name={data.name} />
    </section>
  );
}
