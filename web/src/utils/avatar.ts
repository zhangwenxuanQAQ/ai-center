import defaultAvatar from '../assets/llm/default.svg';
import qwenAvatar from '../assets/llm/qwen.svg';
import deepseekAvatar from '../assets/llm/deepseek.svg';
import kimiAvatar from '../assets/llm/kimi.svg';
import minimaxAvatar from '../assets/llm/minimax.svg';
import glmAvatar from '../assets/llm/glm.svg';

import mysqlIcon from '../assets/datasource/mysql.svg';
import postgresqlIcon from '../assets/datasource/postgresql.svg';
import oracleIcon from '../assets/datasource/oracle.svg';
import sqlServerIcon from '../assets/datasource/sql_server.svg';
import amazonS3Icon from '../assets/datasource/amazon_s3.svg';
import minioIcon from '../assets/datasource/minio.svg';
import rustfsIcon from '../assets/datasource/rustfs.svg';
import datasourceIcon from '../assets/datasource/datasource.svg';

const PROVIDER_AVATARS: Record<string, string> = {
  'qwen': qwenAvatar,
  'deepseek': deepseekAvatar,
  'kimi': kimiAvatar,
  'minimax': minimaxAvatar,
  'glm': glmAvatar,
};

const DATASOURCE_ICONS: Record<string, string> = {
  'mysql': mysqlIcon,
  'postgresql': postgresqlIcon,
  'oracle': oracleIcon,
  'sql_server': sqlServerIcon,
  'amazon_s3': amazonS3Icon,
  'minio': minioIcon,
  'rustfs': rustfsIcon,
};

export const getProviderAvatar = (provider: string): string => {
  if (!provider) {
    return defaultAvatar;
  }
  const lowercaseProvider = provider.toLowerCase();
  return PROVIDER_AVATARS[lowercaseProvider] || defaultAvatar;
};

export const getDefaultAvatar = (): string => {
  return defaultAvatar;
};

export const getDatasourceIcon = (type: string): string => {
  if (!type) {
    return datasourceIcon;
  }
  const lowercaseType = type.toLowerCase();
  return DATASOURCE_ICONS[lowercaseType] || datasourceIcon;
};

export const getDefaultDatasourceIcon = (): string => {
  return datasourceIcon;
};