import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import get from 'lodash/get';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';
import { BeginQueryType, BeginQueryTypeIconMap, BeginQuery } from '../constant/node_constants';

const RightHandleStyle = {};

interface IBeginNode {
  label?: string;
  name?: string;
  form?: {
    query?: BeginQuery[];
  };
}

export function BeginNode({ selected, data }: NodeProps<IBeginNode>) {
  const query: BeginQuery[] = get(data, 'form.query', []);
  const theme = getTheme();
  const displayName = data.name?.toLowerCase() === 'begin' ? '开始' : data.name;
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
        type="source"
        position={Position.Right}
        isConnectable
        className={styles.handle}
        style={RightHandleStyle}
      ></Handle>

      <NodeBody label={data.label || 'Begin'} name={displayName}>
        <Flex gap={8} vertical className={styles.generateParameters}>
          {query.map((x, idx) => {
            const Icon = BeginQueryTypeIconMap[x.type as BeginQueryType];
            return (
              <Flex
                key={idx}
                align="center"
                gap={6}
                className={styles.conditionBlock}
              >
                {Icon && <Icon className="size-4" />}
                <label htmlFor="">{x.key}</label>
                <span className={styles.parameterValue}>{x.name}</span>
                {/* <span className="flex-1">{x.optional ? 'Yes' : 'No'}</span> */}
              </Flex>
            );
          })}
        </Flex>
      </NodeBody>
    </section>
  );
}
