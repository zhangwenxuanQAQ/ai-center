import React, { useState } from 'react';
import { Modal, Steps, Button, message, Form } from 'antd';
import { knowledgebaseService } from '../../services/knowledgebase';
import StepBasicInfo from './folder_modal/StepBasicInfo';
import StepKnowledgeModel from './folder_modal/StepKnowledgeModel';
import StepOtherConfig from './folder_modal/StepOtherConfig';
import { DynamicTableRow } from '../../components/DynamicTable';

interface KnowledgebaseDocumentFolderModalProps {
  visible: boolean;
  knowledgebaseId: string;
  categories: any[];
  onCancel: () => void;
  onSuccess: () => void;
}

const { Step } = Steps;

const KnowledgebaseDocumentFolderModal: React.FC<KnowledgebaseDocumentFolderModalProps> = ({
  visible,
  knowledgebaseId,
  categories,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [knowledgeTags, setKnowledgeTags] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customFields, setCustomFields] = useState<DynamicTableRow[]>([]);

  const steps = [
    { title: '基本信息' },
    { title: '知识模型' },
    { title: '其它配置' },
  ];

  const handleOk = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const createData = {
        ...values,
        tags: knowledgeTags,
        template_type: selectedTemplate,
        custom_fields: selectedTemplate === 'custom' ? customFields : undefined,
      };
      
      await knowledgebaseService.createDocumentCategory(knowledgebaseId, createData);
      message.success('目录创建成功');
      resetForm();
      onSuccess();
      onCancel();
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setKnowledgeTags([]);
    setSelectedTemplate('');
    setCustomFields([]);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  React.useEffect(() => {
    if (visible) {
      const maxSortOrder = categories.length > 0
        ? Math.max(...categories.map(c => c.sort_order || 0))
        : 0;
      form.setFieldsValue({ sort_order: maxSortOrder + 1 });
    }
  }, [visible, categories, form]);

  React.useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <StepBasicInfo form={form} categories={categories} />;
      case 1:
        return (
          <StepKnowledgeModel
            knowledgeTags={knowledgeTags}
            setKnowledgeTags={setKnowledgeTags}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            customFields={customFields}
            setCustomFields={setCustomFields}
          />
        );
      case 2:
        return <StepOtherConfig />;
      default:
        return null;
    }
  };

  return (
    <Modal
      title="新增目录"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={1000}
      className={`knowledgebase-modal ${document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}`}
    >
      <Steps current={currentStep} style={{ marginBottom: '24px' }}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} />
        ))}
      </Steps>

      <div style={{ minHeight: '300px' }}>
        {renderStepContent()}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <Button onClick={handleCancel} disabled={loading}>
          取消
        </Button>
        {currentStep > 0 && (
          <Button onClick={handlePrev} disabled={loading}>
            上一步
          </Button>
        )}
        <Button
          type="primary"
          onClick={handleOk}
          loading={loading}
        >
          {currentStep === steps.length - 1 ? '保存' : '下一步'}
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgebaseDocumentFolderModal;
