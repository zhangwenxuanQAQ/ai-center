from app.database.models import MCPTool

# 查询工具信息
tool_id = '27302ee3dec24c389b61149328263cbb'
try:
    tool = MCPTool.get_by_id(tool_id)
    print('Tool ID:', tool.id)
    print('Tool Name:', tool.name)
    print('Tool Type:', tool.tool_type)
    print('Config:', tool.config)
    print('Server ID:', tool.server_id)
except Exception as e:
    print('Error:', e)
