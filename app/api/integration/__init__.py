"""
所有提供给对外第三方的接口
需要请求头包含Authorization: Bearer ${API_KEY}
其中${API_KEY}为申请的API密钥
"""


from .api import router as integration_api_router
from .management import router as integration_management_router
