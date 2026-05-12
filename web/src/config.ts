export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
};

export const MCP_BASE_URL = import.meta.env.VITE_MCP_BASE_URL || '/mcp';

export const isDev = import.meta.env.DEV;