import { Handle, NodeProps, Position } from '@xyflow/react';
import { Divider, Flex } from 'antd';
import classNames from 'classnames';
import { getTheme } from '../utils/theme';
import { useBuildSwitchHandlePositions } from './hooks';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const RightHandleStyle = {};

interface ISwitchCondition {
  items?: Array<{
    cpn_id?: string;
    operator?: string;
    value?: string;
  }>;
  logical_operator?: string;
}

interface ISwitchNode {
  name?: string;
  label?: string;
  form?: {
    conditions?: ISwitchCondition[];
  };
}

const getConditionKey = (idx: number, length: number) => {
  if (idx === 0 && length !== 1) {
    return 'If';
  } else if (idx === length - 1) {
    return 'Else';
  }
  return 'ElseIf';
};

const ConditionBlock = ({
  condition,
}: {
  condition: ISwitchCondition;
}) => {
  const items = condition?.items ?? [];
  return (
    <Flex vertical className={styles.conditionBlock}>
      {items.map((x, idx) => (
        <div key={idx}>
          <Flex>
            <div
              className={classNames(styles.conditionLine, styles.conditionKey)}
            >
              {x?.cpn_id}
            </div>
            <span className={styles.conditionOperator}>{x?.operator}</span>
            <Flex flex={1} className={styles.conditionLine}>
              {x?.value}
            </Flex>
          </Flex>
          {idx + 1 < items.length && (
            <Divider orientationMargin="0" className={styles.zeroDivider}>
              {condition?.logical_operator}
            </Divider>
          )}
        </div>
      ))}
    </Flex>
  );
};

export function SwitchNode({ id, data, selected }: NodeProps<ISwitchNode>) {
  const { positions } = useBuildSwitchHandlePositions({ data, id });
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
        <Flex vertical gap={10}>
          {positions.map((position, idx) => {
            return (
              <div key={idx}>
                <Flex vertical>
                  <Flex justify={'space-between'}>
                    <span>{idx < positions.length - 1 && position.text}</span>
                    <span>{getConditionKey(idx, positions.length)}</span>
                  </Flex>
                  {position.condition && (
                    <ConditionBlock
                      condition={position.condition}
                    ></ConditionBlock>
                  )}
                </Flex>
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
