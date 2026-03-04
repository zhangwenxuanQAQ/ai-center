"""
企业微信聊天数据传输对象（DTO）
"""

from pydantic import BaseModel, Field
from typing import Optional


class WorkWeixinCallbackVerify(BaseModel):
    """
    企业微信回调URL验证DTO
    
    Attributes:
        msg_signature: 签名串
        timestamp: 时间戳
        nonce: 随机串
        echostr: 随机串
    """
    msg_signature: str = Field(..., description="签名串")
    timestamp: str = Field(..., description="时间戳")
    nonce: str = Field(..., description="随机串")
    echostr: str = Field(..., description="随机串")


class WorkWeixinMessageReceive(BaseModel):
    """
    企业微信消息接收DTO
    
    Attributes:
        msg_signature: 签名串
        timestamp: 时间戳
        nonce: 随机串
    """
    msg_signature: Optional[str] = Field(None, description="签名串")
    timestamp: Optional[str] = Field(None, description="时间戳")
    nonce: Optional[str] = Field(None, description="随机串")


class WorkWeixinSourceConfig(BaseModel):
    """
    企业微信来源配置DTO
    
    Attributes:
        token: Token
        encoding_aes_key: EncodingAESKey
        callback_url: 回调地址
    """
    token: str = Field(..., description="Token")
    encoding_aes_key: str = Field(..., description="EncodingAESKey")
    callback_url: Optional[str] = Field(None, description="回调地址")
