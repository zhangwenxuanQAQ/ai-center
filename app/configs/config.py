import yaml
import os

class Config:
    """
    配置管理类
    支持从YAML文件读取配置，并允许环境变量覆盖配置项
    环境变量命名规则：将YAML配置路径转换为大写，用下划线连接
    例如：mysql.host -> MYSQL_HOST
          es.username -> ES_USERNAME
    """
    
    def __init__(self):
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        self.server = self._get_section('server', {
            'host': 'SERVER_HOST',
            'http_port': 'SERVER_PORT'
        })
        
        self.mysql = self._get_section('mysql', {
            'name': 'MYSQL_DATABASE',
            'user': 'MYSQL_USER',
            'password': 'MYSQL_PASSWORD',
            'host': 'MYSQL_HOST',
            'port': 'MYSQL_PORT',
            'max_connections': 'MYSQL_MAX_CONNECTIONS'
        })
        
        self.mcp = self._get_section('mcp', {
            'host': 'MCP_HOST',
            'port': 'MCP_PORT',
            'enabled': 'MCP_ENABLED'
        })
        
        self.es = self._get_section('es', {
            'host': 'ES_HOST',
            'port': 'ES_PORT',
            'username': 'ES_USER',
            'password': 'ES_PASSWORD',
            'scheme': 'ES_SCHEME'
        })
        
        self.redis = self._get_section('redis', {
            'db': 'REDIS_DB',
            'username': 'REDIS_USERNAME',
            'password': 'REDIS_PASSWORD',
            'host': 'REDIS_HOST',
            'port': 'REDIS_PORT'
        })
        
        self.rustfs = self._get_section('rustfs', {
            'username': 'RUSTFS_USER',
            'password': 'RUSTFS_PASSWORD',
            'host': 'RUSTFS_HOST',
            'port': 'RUSTFS_PORT'
        })
        
        self.logging = self._get_section('logging', {
            'level': 'LOG_LEVEL',
            'format': 'LOG_FORMAT'
        })
    
    def _get_section(self, section_name, env_mapping):
        """
        获取配置段，支持环境变量覆盖
        
        Args:
            section_name: YAML配置段名称
            env_mapping: 配置项到环境变量的映射字典
        
        Returns:
            配置字典，环境变量值会覆盖YAML中的值
        """
        section = self.config.get(section_name, {})
        
        for config_key, env_var in env_mapping.items():
            env_value = os.getenv(env_var)
            if env_value is not None:
                # 尝试转换类型
                original_value = section.get(config_key)
                if isinstance(original_value, int):
                    try:
                        section[config_key] = int(env_value)
                    except ValueError:
                        section[config_key] = env_value
                elif isinstance(original_value, bool):
                    section[config_key] = env_value.lower() in ('true', '1', 'yes', 'on')
                else:
                    section[config_key] = env_value
        
        return section
    
    def get(self, key, default=None):
        """
        获取配置项
        
        Args:
            key: 配置项键，支持点号分隔的路径，如 'mysql.host'
            default: 默认值
        
        Returns:
            配置项值
        """
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        
        return value

config = Config()
