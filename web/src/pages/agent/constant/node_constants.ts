
import { AlignCenterOutlined, ApiOutlined, CloudUploadOutlined, FontSizeOutlined, OrderedListOutlined, UnorderedListOutlined } from '@ant-design/icons';

export enum BeginQueryType {
  Line = 'line',
  Paragraph = 'paragraph',
  Options = 'options',
  File = 'file',
  Integer = 'integer',
  Boolean = 'boolean',
}

export const BeginQueryTypeIconMap = {
  [BeginQueryType.Line]: FontSizeOutlined,
  [BeginQueryType.Paragraph]: AlignCenterOutlined,
  [BeginQueryType.Options]: UnorderedListOutlined,
  [BeginQueryType.File]: CloudUploadOutlined,
  [BeginQueryType.Integer]: OrderedListOutlined,
  [BeginQueryType.Boolean]: ApiOutlined,
};

export interface BeginQuery {
  key: string;
  type: string;
  value: string;
  optional: boolean;
  name: string;
  options: (number | string | boolean)[];
}