import React from 'react';
import { Checkbox, Select, Switch, Input, Tooltip, Button, InputNumber } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import SliderInput from '../../../components/SliderInput';
import TagsInput from '../../../components/TagsInput';

interface StepOtherConfigProps {
  vectorRetrieval: boolean;
  setVectorRetrieval: (value: boolean) => void;
  graphRetrieval: boolean;
  setGraphRetrieval: (value: boolean) => void;
  chunkMethod: string;
  setChunkMethod: (value: string) => void;
  textBlockSize: number;
  setTextBlockSize: (value: number) => void;
  segmentIdentifiers: string;
  setSegmentIdentifiers: (value: string) => void;
  pageRank: number;
  setPageRank: (value: number) => void;
  tagSets: string[];
  setTagSets: (value: string[]) => void;
  autoKeywords: number;
  setAutoKeywords: (value: number) => void;
  autoQuestions: number;
  setAutoQuestions: (value: number) => void;
  useRaptor: boolean;
  setUseRaptor: (value: boolean) => void;
  maxTokens: number;
  setMaxTokens: (value: number) => void;
  threshold: number;
  setThreshold: (value: number) => void;
  maxClusters: number;
  setMaxClusters: (value: number) => void;
  randomSeed: number | null;
  setRandomSeed: (value: number | null) => void;
  convertTableToHtml: boolean;
  setConvertTableToHtml: (value: boolean) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  entityTypes: string[];
  setEntityTypes: (value: string[]) => void;
  graphMethod: string;
  setGraphMethod: (value: string) => void;
  entityNormalization: boolean;
  setEntityNormalization: (value: boolean) => void;
  blockAggregation: boolean;
  setBlockAggregation: (value: boolean) => void;
}

const StepOtherConfig: React.FC<StepOtherConfigProps> = ({
  vectorRetrieval,
  setVectorRetrieval,
  graphRetrieval,
  setGraphRetrieval,
  chunkMethod,
  setChunkMethod,
  textBlockSize,
  setTextBlockSize,
  segmentIdentifiers,
  setSegmentIdentifiers,
  pageRank,
  setPageRank,
  tagSets,
  setTagSets,
  autoKeywords,
  setAutoKeywords,
  autoQuestions,
  setAutoQuestions,
  useRaptor,
  setUseRaptor,
  maxTokens,
  setMaxTokens,
  threshold,
  setThreshold,
  maxClusters,
  setMaxClusters,
  randomSeed,
  setRandomSeed,
  convertTableToHtml,
  setConvertTableToHtml,
  prompt,
  setPrompt,
  entityTypes,
  setEntityTypes,
  graphMethod,
  setGraphMethod,
  entityNormalization,
  setEntityNormalization,
  blockAggregation,
  setBlockAggregation,
}) => {
  const chunkMethodOptions = [
    { value: 'general', label: 'General' },
    { value: 'qa', label: 'Q&A' },
    { value: 'resume', label: 'Resume' },
    { value: 'manual', label: 'Manual' },
    { value: 'table', label: 'Table' },
    { value: 'paper', label: 'Paper' },
    { value: 'book', label: 'Book' },
    { value: 'laws', label: 'Laws' },
    { value: 'presentation', label: 'Presentation' },
    { value: 'one', label: 'one' },
  ];

  const tagSetOptions = [
    { value: 'tag1', label: '标签集1' },
    { value: 'tag2', label: '标签集2' },
    { value: 'tag3', label: '标签集3' },
  ];

  const graphMethodOptions = [
    { value: 'lightrag', label: 'LightRAG' },
    { value: 'general', label: 'General' },
  ];

  const renderChunkMethodContent = () => {
    switch (chunkMethod) {
      case 'general':
        return (
          <div style={{ paddingLeft: 24 }}>
            <SliderInput
              label="建议文本块大小"
              tooltip="建议的生成文本块的 token 数阈值。如果切分得到的小文本段 token 数达不到这一阈值就会不断与之后的文本段合并，直至再合并下一个文本段会超过这一阈值为止，此时产生一个最终文本块。如果系统在切分文本段时始终没有遇到文本分段标识符，即便文本段 token 数已经超过这一阈值，系统也不会生成新文本块。"
              value={textBlockSize}
              onChange={setTextBlockSize}
              min={100}
              max={2048}
              step={10}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>文本分段标识符</span>
                <Tooltip
                  title="支持多字符作为分隔符，多字符用两个反引号 `` 分隔符包裹。若配置成：\n`##`; 系统将首先使用换行符、两个#号以及分号先对文本进行分割，随后再对分得的的小文本块按照「建议文本块大小」设定的大小进行拼装。在设置文本分段标识符前请确保理解上述文本分段切片机制。"
                  placement="top"
                >
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <Input
                value={segmentIdentifiers}
                onChange={(e) => setSegmentIdentifiers(e.target.value)}
                placeholder="请输入文本分段标识符"
              />
            </div>
            <SliderInput
              label="页面排名"
              tooltip="知识库检索时，你可以为特定知识库设置较高的 PageRank 分数，该知识库中匹配文本块的混合相似度得分会自动叠加 PageRank 分数，从而提升排序权重。"
              value={pageRank}
              onChange={setPageRank}
              min={0}
              max={100}
              step={1}
            />
            <SliderInput
              label="自动关键词提取"
              tooltip="自动为每个文本块中提取 N 个关键词，用以提升查询精度。请注意：该功能采用“系统模型设置”中设置的默认聊天模型提取关键词，因此也会产生更多 Token 消耗。另外，你也可以手动更新生成的关键词。"
              value={autoKeywords}
              onChange={setAutoKeywords}
              min={1}
              max={30}
              step={1}
            />
            <SliderInput
              label="自动问题提取"
              tooltip="利用“系统模型设置”中设置的 chat model 对知识库的每个文本块提取 N 个问题以提高其排名得分。请注意，开启后将消耗额外的 token。您可以在块列表中查看、编辑结果。如果自动问题提取发生错误，不会妨碍整个分块过程，只会将空结果添加到原始文本块。"
              value={autoQuestions}
              onChange={setAutoQuestions}
              min={1}
              max={10}
              step={1}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>表格转HTML</span>
                <Tooltip
                  title="与 General 切片方法配合使用。未开启状态下，表格文件（XLSX、XLS（Excel 97-2003））会按行解析为键值对。开启后，表格文件会被解析为 HTML 表格。若原始表格超过 12 行，系统会自动按每 12 行拆分为多个 HTML 表格。欲了解更多详情，请参阅 https://ragflow.io/docs/dev/enable_excel2html。"
                  placement="top"
                >
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Switch checked={convertTableToHtml} onChange={setConvertTableToHtml} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>标签集</span>
                <Tooltip
                  title="请选择一个或多个标签集或标签知识库，用于对知识库中的每个文本块进行标记。对这些文本块的查询也将自动关联相应标签。此功能基于文本相似度，能够为数据集的文本块批量添加更多领域知识，从而显著提高检索准确性。该功能还能提升大量文本块的操作效率。为了更好地理解标签集的作用，以下是标签集和关键词之间的主要区别：标签集是一个由用户定义和管理的封闭集，而自动生成的关键词属于开放集合。在给你的知识库文本块批量打标签之前，你需要先生成标签集作为样本。自动关键词提取功能中的关键词由 LLM 生成，此过程相对耗时，并且会产生一定的 Token。"
                  placement="top"
                >
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <Select
                mode="multiple"
                value={tagSets}
                onChange={(value) => setTagSets(value as string[])}
                style={{ width: '100%' }}
                placeholder="请选择标签集"
              >
                {tagSetOptions.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <SliderInput
              label="最大token数"
              tooltip="用于设定每个被总结的文本块的最大 token 数。"
              value={maxTokens}
              onChange={setMaxTokens}
              min={100}
              max={2048}
              step={10}
            />
            <SliderInput
              label="阈值"
              tooltip="在 RAPTOR 中，数据块会根据它们的语义相似性进行聚类。阈值设定了数据块被分到同一组所需的最小相似度。阈值越高，每个聚类中的数据块越少；阈值越低，则每个聚类中的数据块越多。"
              value={threshold}
              onChange={setThreshold}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderInput
              label="最大聚类数"
              tooltip="最多可创建的聚类数。"
              value={maxClusters}
              onChange={setMaxClusters}
              min={1}
              max={1024}
              step={1}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>随机种子</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                  value={randomSeed}
                  onChange={setRandomSeed}
                  style={{ width: 150 }}
                />
                <Button type="primary" onClick={() => setRandomSeed(Math.floor(Math.random() * 10000))}>
                  +
                </Button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>使用召回增强 RAPTOR 策略</span>
                <Tooltip title="为多跳问答任务启用 RAPTOR" placement="top">
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Switch checked={useRaptor} onChange={setUseRaptor} />
              </div>
            </div>
            {useRaptor && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>提示词</span>
                    <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                    <Tooltip
                      title="系统提示为大模型提供任务描述、规定回复方式，以及设置其他各种要求。系统提示通常与 key （变量）合用，通过变量设置大模型的输入数据。你可以通过斜杠或者 (x) 按钮显示可用的 key。"
                      placement="top"
                    >
                      <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                    </Tooltip>
                  </div>
                  <Input.TextArea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="请输入提示词"
                  />
                </div>
              </div>
            )}
          </div>
        );
      case 'qa':
      case 'resume':
        return (
          <div style={{ paddingLeft: 24 }}>
            <SliderInput
              label="页面排名"
              tooltip="知识库检索时，你可以为特定知识库设置较高的 PageRank 分数，该知识库中匹配文本块的混合相似度得分会自动叠加 PageRank 分数，从而提升排序权重。"
              value={pageRank}
              onChange={setPageRank}
              min={0}
              max={100}
              step={1}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>标签集</span>
                <Tooltip
                  title="请选择一个或多个标签集或标签知识库，用于对知识库中的每个文本块进行标记。对这些文本块的查询也将自动关联相应标签。此功能基于文本相似度，能够为数据集的文本块批量添加更多领域知识，从而显著提高检索准确性。该功能还能提升大量文本块的操作效率。为了更好地理解标签集的作用，以下是标签集和关键词之间的主要区别：标签集是一个由用户定义和管理的封闭集，而自动生成的关键词属于开放集合。在给你的知识库文本块批量打标签之前，你需要先生成标签集作为样本。自动关键词提取功能中的关键词由 LLM 生成，此过程相对耗时，并且会产生一定的 Token。"
                  placement="top"
                >
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <Select
                mode="multiple"
                value={tagSets}
                onChange={(value) => setTagSets(value as string[])}
                style={{ width: '100%' }}
                placeholder="请选择标签集"
              >
                {tagSetOptions.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>
        );
      case 'manual':
      case 'paper':
      case 'book':
      case 'laws':
        return (
          <div style={{ paddingLeft: 24 }}>
            <SliderInput
              label="页面排名"
              tooltip="知识库检索时，你可以为特定知识库设置较高的 PageRank 分数，该知识库中匹配文本块的混合相似度得分会自动叠加 PageRank 分数，从而提升排序权重。"
              value={pageRank}
              onChange={setPageRank}
              min={0}
              max={100}
              step={1}
            />
            <SliderInput
              label="自动关键词提取"
              tooltip="自动为每个文本块中提取 N 个关键词，用以提升查询精度。请注意：该功能采用“系统模型设置”中设置的默认聊天模型提取关键词，因此也会产生更多 Token 消耗。另外，你也可以手动更新生成的关键词。"
              value={autoKeywords}
              onChange={setAutoKeywords}
              min={1}
              max={30}
              step={1}
            />
            <SliderInput
              label="自动问题提取"
              tooltip="利用“系统模型设置”中设置的 chat model 对知识库的每个文本块提取 N 个问题以提高其排名得分。请注意，开启后将消耗额外的 token。您可以在块列表中查看、编辑结果。如果自动问题提取发生错误，不会妨碍整个分块过程，只会将空结果添加到原始文本块。"
              value={autoQuestions}
              onChange={setAutoQuestions}
              min={1}
              max={10}
              step={1}
            />
            <SliderInput
              label="最大token数"
              tooltip="用于设定每个被总结的文本块的最大 token 数。"
              value={maxTokens}
              onChange={setMaxTokens}
              min={100}
              max={2048}
              step={10}
            />
            <SliderInput
              label="阈值"
              tooltip="在 RAPTOR 中，数据块会根据它们的语义相似性进行聚类。阈值设定了数据块被分到同一组所需的最小相似度。阈值越高，每个聚类中的数据块越少；阈值越低，则每个聚类中的数据块越多。"
              value={threshold}
              onChange={setThreshold}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderInput
              label="最大聚类数"
              tooltip="最多可创建的聚类数。"
              value={maxClusters}
              onChange={setMaxClusters}
              min={1}
              max={1024}
              step={1}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>随机种子</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                  value={randomSeed}
                  onChange={setRandomSeed}
                  style={{ width: 150 }}
                />
                <Button type="primary" onClick={() => setRandomSeed(Math.floor(Math.random() * 10000))}>
                  +
                </Button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>使用召回增强 RAPTOR 策略</span>
                <Tooltip title="为多跳问答任务启用 RAPTOR" placement="top">
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Switch checked={useRaptor} onChange={setUseRaptor} />
              </div>
            </div>
            {useRaptor && (
              <div style={{ paddingLeft: 24, marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>提示词</span>
                    <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                    <Tooltip
                      title="系统提示为大模型提供任务描述、规定回复方式，以及设置其他各种要求。系统提示通常与 key （变量）合用，通过变量设置大模型的输入数据。你可以通过斜杠或者 (x) 按钮显示可用的 key。"
                      placement="top"
                    >
                      <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                    </Tooltip>
                  </div>
                  <Input.TextArea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="请输入提示词"
                  />
                </div>
              </div>
            )}
          </div>
        );
      case 'table':
        return (
          <div style={{ paddingLeft: 24 }}>
            <SliderInput
              label="页面排名"
              tooltip="知识库检索时，你可以为特定知识库设置较高的 PageRank 分数，该知识库中匹配文本块的混合相似度得分会自动叠加 PageRank 分数，从而提升排序权重。"
              value={pageRank}
              onChange={setPageRank}
              min={0}
              max={100}
              step={1}
            />
            <SliderInput
              label="最大token数"
              tooltip="用于设定每个被总结的文本块的最大 token 数。"
              value={maxTokens}
              onChange={setMaxTokens}
              min={100}
              max={2048}
              step={10}
            />
            <SliderInput
              label="阈值"
              tooltip="在 RAPTOR 中，数据块会根据它们的语义相似性进行聚类。阈值设定了数据块被分到同一组所需的最小相似度。阈值越高，每个聚类中的数据块越少；阈值越低，则每个聚类中的数据块越多。"
              value={threshold}
              onChange={setThreshold}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderInput
              label="最大聚类数"
              tooltip="最多可创建的聚类数。"
              value={maxClusters}
              onChange={setMaxClusters}
              min={1}
              max={1024}
              step={1}
            />
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>随机种子</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                  value={randomSeed}
                  onChange={setRandomSeed}
                  style={{ width: 150 }}
                />
                <Button type="primary" onClick={() => setRandomSeed(Math.floor(Math.random() * 10000))}>
                  +
                </Button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>使用召回增强 RAPTOR 策略</span>
                <Tooltip title="为多跳问答任务启用 RAPTOR" placement="top">
                  <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Switch checked={useRaptor} onChange={setUseRaptor} />
              </div>
            </div>
            {useRaptor && (
              <div style={{ paddingLeft: 24, marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>提示词</span>
                    <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                    <Tooltip
                      title="系统提示为大模型提供任务描述、规定回复方式，以及设置其他各种要求。系统提示通常与 key （变量）合用，通过变量设置大模型的输入数据。你可以通过斜杠或者 (x) 按钮显示可用的 key。"
                      placement="top"
                    >
                      <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                    </Tooltip>
                  </div>
                  <Input.TextArea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="请输入提示词"
                  />
                </div>
              </div>
            )}
          </div>
        );
      case 'presentation':
      case 'one':
      default:
        return null;
    }
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: 24, textAlign: 'left' }}>
        <h3 style={{ marginBottom: 16, fontWeight: 600 }}>切片方法配置</h3>

        <div style={{ marginBottom: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, justifyContent: 'flex-start' }}>
            <Checkbox
              checked={vectorRetrieval}
              onChange={(e) => {
                setVectorRetrieval(e.target.checked);
                if (!e.target.checked) {
                  setChunkMethod('');
                }
              }}
            >
              <span style={{ fontWeight: 500 }}>向量检索</span>
            </Checkbox>
          </div>

          {vectorRetrieval && (
            <div style={{ paddingLeft: 24, textAlign: 'left' }}>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
                  <span style={{ fontWeight: 500 }}>切片方法</span>
                  <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                </div>
                <Select
                  value={chunkMethod}
                  onChange={setChunkMethod}
                  style={{ width: '100%' }}
                  placeholder="请选择切片方法"
                >
                  {chunkMethodOptions.map((option) => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              {chunkMethod && renderChunkMethodContent()}
            </div>
          )}
        </div>

        <div style={{ padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, justifyContent: 'flex-start' }}>
            <Checkbox
              checked={graphRetrieval}
              onChange={(e) => {
                setGraphRetrieval(e.target.checked);
                if (!e.target.checked) {
                  setGraphMethod('');
                }
              }}
            >
              <span style={{ fontWeight: 500 }}>图谱检索</span>
            </Checkbox>
          </div>

          {graphRetrieval && (
            <div style={{ paddingLeft: 24, textAlign: 'left' }}>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
                  <span style={{ fontWeight: 500 }}>实体类型</span>
                  <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>
                </div>
                <TagsInput value={entityTypes} onChange={setEntityTypes} />
              </div>

              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
                  <span style={{ fontWeight: 500 }}>方法</span>
                  <Tooltip
                    title="Light：实体和关系提取提示来自 GitHub - HKUDS/LightRAG：“LightRAG：简单快速的检索增强生成”。General：实体和关系提取提示来自 GitHub - microsoft/graphrag：基于图的模块化检索增强生成 (RAG) 系统。"
                    placement="top"
                  >
                    <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                  </Tooltip>
                </div>
                <Select
                  value={graphMethod}
                  onChange={setGraphMethod}
                  style={{ width: '100%' }}
                  placeholder="请选择方法"
                >
                  {graphMethodOptions.map((option) => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
                  <span style={{ fontWeight: 500 }}>实体归一化</span>
                  <Tooltip
                    title="解析过程会将具有相同含义的实体合并在一起，从而使知识图谱更简洁、更准确。应合并以下实体：特朗普总统、唐纳德·特朗普、唐纳德·J·特朗普、唐纳德·约翰·特朗普。"
                    placement="top"
                  >
                    <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                  </Tooltip>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Switch checked={entityNormalization} onChange={setEntityNormalization} />
                </div>
              </div>

              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' }}>
                  <span style={{ fontWeight: 500 }}>区块聚合</span>
                  <Tooltip
                    title="区块被聚集成层次化的社区，实体和关系通过更高抽象层次将每个部分连接起来。然后，我们使用 LLM 生成每个社区的摘要，称为社区报告。更多信息：https://www.microsoft.com/en-us/research/blog/graphrag-improving-global-search-v"
                    placement="top"
                  >
                    <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help', color: '#999' }} />
                  </Tooltip>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Switch checked={blockAggregation} onChange={setBlockAggregation} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepOtherConfig;
