import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { get } from 'lodash';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const LeftHandleStyle = {};
const RightHandleStyle = {};

interface IGenerateParameter {
  id?: string;
  key?: string;
  component_id?: string;
}

interface ITemplateNode {
  name?: string;
  label?: string;
  form?: {
    parameters?: IGenerateParameter[];
  };
}

export function TemplateNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<ITemplateNode>) {
  const parameters: IGenerateParameter[] = get(data, 'form.parameters', []);
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
        <Flex gap={8} vertical className={styles.generateParameters}>
          {parameters.map((x) => (
            <Flex
              key={x.id}
              align="center"
              gap={6}
              className={styles.conditionBlock}
            >
              <label htmlFor="">{x.key}</label>
              <span className={styles.parameterValue}>
                {x.component_id}
              </span>
            </Flex>
          ))}
        </Flex>
      </NodeBody>
    </section>
  );
}
