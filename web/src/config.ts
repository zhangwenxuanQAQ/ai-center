export const config = {
  // 后端服务地址（开发环境使用相对路径，生产环境可配置）
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
};

export const isDev = import.meta.env.DEV;
