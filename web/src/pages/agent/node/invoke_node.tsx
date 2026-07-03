import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const LeftHandleStyle = {};
const RightHandleStyle = {};

interface IInvokeNode {
  name?: string;
  label?: string;
  form?: {
    url?: string;
  };
}

export function InvokeNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IInvokeNode>) {
  const theme = getTheme();
  const url = get(data, 'form.url');
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
      <NodeBody label={data.label} name={data.name}>
        <Flex vertical>
          <div>URL</div>
          <div className={styles.nodeText}>{url}</div>
        </Flex>
      </NodeBody>
    </section>
  );
}
