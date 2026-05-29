import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody, NodeContent } from './node_body';

const RightHandleStyle = {};

interface IIntentDetectionNode {
  name?: string;
  label?: string;
  form?: {
    llm_id?: string;
    intent_description?: Record<string, string>;
  };
}

export function IntentDetectionV2Node({
  id,
  data,
  selected,
}: NodeProps<IIntentDetectionNode>) {
  const theme = getTheme();
  const intents = get(data, 'form.intent_description', {});
  const intentKeys = Object.keys(intents);

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
          {intentKeys.map((intent, idx) => {
            const top = 57 + idx * 40;
            return (
              <div key={idx}>
                <div className={styles.nodeText}>{intent}</div>
                <Handle
                  key={intent}
                  id={intent}
                  type="source"
                  position={Position.Right}
                  isConnectable
                  className={styles.handle}
                  style={{ ...RightHandleStyle, top }}
                ></Handle>
              </div>
            );
          })}
        </Flex>
      </NodeBody>
    </section>
  );
}
