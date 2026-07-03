import { NodeProps } from '@xyflow/react';
import classNames from 'classnames';
import { getTheme } from '../utils/theme';
import styles from './node.module.less';

interface INoteNode {
  name?: string;
  label?: string;
  form?: {
    text?: string;
  };
}

export function NoteNode({ data, selected }: NodeProps<INoteNode>) {
  const theme = getTheme();
  return (
    <section
      className={classNames(
        styles.noteNode,
        theme === 'dark' ? styles.dark : '',
        {
          [styles.selectedNode]: selected,
        },
      )}
    >
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {data.form?.text || data.name || 'Note'}
      </div>
    </section>
  );
}
