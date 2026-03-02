import yaml
import os

class Config:
    def __init__(self):
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'configs', 'server_config.yaml')
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        self.server = self.config.get('server', {})
        self.mysql = self.config.get('mysql', {})

config = Config()