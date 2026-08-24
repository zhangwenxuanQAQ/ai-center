/**
 * 404 页面组件
 * 当用户访问未启用模块的页面或不存在的路由时显示
 */

import { Result, Button, Layout } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Layout style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      height: '100%',
      background: 'transparent'
    }}>
      <Result
        status="404"
        title="404"
        subTitle="抱歉，您访问的页面不存在或当前版本未启用此功能。"
        extra={[
          <Button type="primary" key="home" onClick={() => navigate('/')}>
            返回首页
          </Button>,
          <Button key="back" onClick={() => navigate(-1)}>
            返回上一页
          </Button>,
        ]}
      />
    </Layout>
  );
};

export default NotFound;