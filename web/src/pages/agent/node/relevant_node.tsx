import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const RightHandleStyle = {};

interface IRelevantNode {
  name?: string;
  label?: string;
  form?: {
    yes?: string;
    no?: string;
  };
}

export function RelevantNode({ id, data, selected }: NodeProps<IRelevantNode>) {
  const yes = get(data, 'form.yes');
  const no = get(data, 'form.no');
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
      <Handle
        type="source"
        position={Position.Right}
        isConnectable
        className={styles.handle}
        id={'yes'}
        style={{ ...RightHandleStyle, top: 57 + 20 }}
      ></Handle>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable
        className={styles.handle}
        id={'no'}
        style={{ ...RightHandleStyle, top: 115 + 20 }}
      ></Handle>
      <NodeBody label={data.label} name={data.name}>
        <Flex vertical gap={10}>
          <Flex vertical>
            <div className={styles.relevantLabel}>Yes</div>
            <div className={styles.nodeText}>{yes}</div>
          </Flex>
          <Flex vertical>
            <div className={styles.relevantLabel}>No</div>
            <div className={styles.nodeText}>{no}</div>
          </Flex>
        </Flex>
      </NodeBody>
    </section>
  );
}
