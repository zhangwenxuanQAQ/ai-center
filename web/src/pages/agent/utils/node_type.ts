export interface NodeInfo {
  id: string;
  type: string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
}

const typeMap: Record<string, string> = {
  'Begin': 'beginNode',
  'Answer': 'answerNode',
  'Generate': 'generateNode',
  'KeywordExtract': 'keywordNode',
  'Note': 'noteNode',
  'Message': 'messageNode',
  'Retrieval': 'retrievalNode',
  'Categorize': 'categorizeNode',
  'Relevant': 'relevantNode',
  'Rewrite': 'rewriteNode',
  'Switch': 'switchNode',
  'Invoke': 'invokeNode',
  'Template': 'templateNode',
  'Iteration': 'iterationNode',
  'Email': 'emailNode',
  'IntentDetectionV2': 'intentDetectionV2Node',
  'GlobalMemory': 'globalMemoryNode',
};

const ragComponents = ['WenCai', 'AkShare', 'Baidu', 'DuckDuckGo', 'Tavily', 'QWeather', 'Crawler'];

export const getNodeType = (node: NodeInfo | string): string => {
  if (typeof node === 'string') {
    const label = node;
    if (typeMap[label]) {
      return typeMap[label];
    }
    if (ragComponents.includes(label)) {
      return 'ragNode';
    }
    return 'default';
  }
  
  if (node.type) {
    return node.type;
  }
  
  const label = node.data?.label || '';
  if (typeMap[label]) {
    return typeMap[label];
  }
  if (ragComponents.includes(label)) {
    return 'ragNode';
  }
  return 'default';
};

export const getComponentLabel = (componentName: string): string => {
  const labelMap: Record<string, string> = {
    'beginNode': 'Begin',
    'answerNode': 'Answer',
    'generateNode': 'Generate',
    'keywordNode': 'KeywordExtract',
    'noteNode': 'Note',
    'messageNode': 'Message',
    'retrievalNode': 'Retrieval',
    'categorizeNode': 'Categorize',
    'relevantNode': 'Relevant',
    'rewriteNode': 'Rewrite',
    'switchNode': 'Switch',
    'invokeNode': 'Invoke',
    'templateNode': 'Template',
    'iterationNode': 'Iteration',
    'emailNode': 'Email',
    'intentDetectionV2Node': 'IntentDetectionV2',
    'globalMemoryNode': 'GlobalMemory',
    'ragNode': 'Retrieval',
    'default': 'Unknown',
  };
  return labelMap[componentName] || componentName;
};
