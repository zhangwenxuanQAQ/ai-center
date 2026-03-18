from app.database.models import MCPTool
import json

# 查询工具信息
tool_id = '27302ee3dec24c389b61149328263cbb'
try:
    tool = MCPTool.get_by_id(tool_id)
    print('Tool ID:', tool.id)
    print('Tool Name:', tool.name)
    print('Tool Type:', tool.tool_type)
    print('Config:', tool.config)
    print('Extra Config:', tool.extra_config)
    
    # 解析配置
    if tool.config:
        config_data = json.loads(tool.config)
        print('\nParsed Config:')
        for key, value in config_data.items():
            print(f'  {key}: {value}')
        
        # 检查是否包含url字段
        if 'url' in config_data:
            print('\n✓ Config contains url field:', config_data['url'])
        else:
            print('\n✗ Config missing url field')
            
        # 检查是否包含method字段
        if 'method' in config_data:
            print('✓ Config contains method field:', config_data['method'])
        else:
            print('✓ Config missing method field, defaulting to POST')
            
        # 检查是否包含headers字段
        if 'headers' in config_data:
            print('✓ Config contains headers field')
        else:
            print('✓ Config missing headers field, defaulting to empty dict')
    else:
        print('\n✗ Tool has no config')
        
except Exception as e:
    print('Error:', e)
