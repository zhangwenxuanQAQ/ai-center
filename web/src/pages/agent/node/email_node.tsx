import { Handle, NodeProps, Position } from '@xyflow/react';
import { Flex } from 'antd';
import classNames from 'classnames';
import { useState } from 'react';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';
import { NodeBody } from './node_body';

const LeftHandleStyle = {};
const RightHandleStyle = {};

interface IEmailNode {
  name?: string;
  label?: string;
  form?: {
    smtp_server?: string;
    smtp_port?: string;
    email?: string;
  };
}

export function EmailNode({
  id,
  data,
  isConnectable = true,
  selected,
}: NodeProps<IEmailNode>) {
  const [showDetails, setShowDetails] = useState(false);
  const theme = getTheme();

  return (
    <section
      className={classNames(styles.ragNode, theme === 'dark' ? styles.dark : '', {
        [styles.selectedNode]: selected,
      })}
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
        <Flex vertical gap={8} className={styles.emailNodeContainer}>
          <div
            className={styles.emailConfig}
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className={styles.configItem}>
              <span className={styles.configLabel}>SMTP:</span>
              <span className={styles.configValue}>{data.form?.smtp_server}</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Port:</span>
              <span className={styles.configValue}>{data.form?.smtp_port}</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>From:</span>
              <span className={styles.configValue}>{data.form?.email}</span>
            </div>
            <div className={styles.expandIcon}>{showDetails ? '▼' : '▶'}</div>
          </div>

          {showDetails && (
            <div className={styles.jsonExample}>
              <div className={styles.jsonTitle}>Expected Input JSON:</div>
              <pre className={styles.jsonContent}>
                {`{
  "to_email": "...",
  "cc_email": "...", 
  "subject": "...",
  "content": "..."
}`}
              </pre>
            </div>
          )}
        </Flex>
      </NodeBody>
    </section>
  );
}
