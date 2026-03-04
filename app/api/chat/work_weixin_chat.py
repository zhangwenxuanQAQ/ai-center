"""
企业微信聊天控制器，提供企业微信回调相关的API接口
"""

import json
import logging
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response

from app.services.chat.work_weixin_service import WorkWeixinChatService
from app.utils.response import ResponseUtil, ApiResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/callback/{chatbot_id}")
async def verify_url(
    request: Request,
    chatbot_id: int,
    msg_signature: str,
    timestamp: str,
    nonce: str,
    echostr: str
):
    """
    验证企业微信回调URL
    
    Args:
        chatbot_id: 机器人ID
        msg_signature: 签名串
        timestamp: 时间戳
        nonce: 随机串
        echostr: 加密的随机串
        
    Returns:
        Response: 解密后的echostr
    """
    logger.info(f"收到企业微信验证请求，chatbot_id={chatbot_id}")
    
    ret, result = WorkWeixinChatService.verify_url(
        chatbot_id,
        msg_signature,
        timestamp,
        nonce,
        echostr
    )
    
    if ret != 0:
        logger.error(f"验证失败，错误码: {ret}")
        return Response(content="verify fail", media_type="text/plain")
    
    return Response(content=result, media_type="text/plain")


@router.post("/callback/{chatbot_id}")
async def handle_message(
    request: Request,
    chatbot_id: int,
    msg_signature: str = None,
    timestamp: str = None,
    nonce: str = None
):
    """
    处理企业微信消息
    
    Args:
        chatbot_id: 机器人ID
        msg_signature: 签名串
        timestamp: 时间戳
        nonce: 随机串
        
    Returns:
        Response: 加密后的回复消息
    """
    if not all([msg_signature, timestamp, nonce]):
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    logger.info(f"收到企业微信消息，chatbot_id={chatbot_id}")
    
    post_data = await request.body()
    
    ret, msg = WorkWeixinChatService.decrypt_message(
        chatbot_id,
        post_data,
        msg_signature,
        timestamp,
        nonce
    )
    
    if ret != 0:
        raise HTTPException(status_code=400, detail="解密失败")
    
    data = json.loads(msg)
    logger.debug(f'解密后的数据: {data}')
    
    if 'msgtype' not in data:
        logger.info(f"不认识的事件: {data}")
        return Response(content="success", media_type="text/plain")
    
    msgtype = data['msgtype']
    
    if msgtype == 'text':
        content = data['text']['content']
        
        stream_id, answer, finish = WorkWeixinChatService.process_text_message(
            chatbot_id, content
        )
        
        stream = WorkWeixinChatService.make_text_stream(stream_id, answer, finish)
        resp = WorkWeixinChatService.encrypt_message(
            chatbot_id, stream, nonce, timestamp
        )
        return Response(content=resp, media_type="text/plain")
        
    elif msgtype == 'stream':
        stream_id = data['stream']['id']
        
        answer, finish = WorkWeixinChatService.get_stream_answer(
            chatbot_id, stream_id
        )
        
        stream = WorkWeixinChatService.make_text_stream(stream_id, answer, finish)
        resp = WorkWeixinChatService.encrypt_message(
            chatbot_id, stream, nonce, timestamp
        )
        return Response(content=resp, media_type="text/plain")
        
    elif msgtype == 'image':
        config = WorkWeixinChatService._get_chatbot_config(chatbot_id)
        if not config:
            logger.error(f"机器人 {chatbot_id} 配置不存在")
            return Response(content="success", media_type="text/plain")
        
        aes_key = config.get('EncodingAESKey', '')
        success, result = WorkWeixinChatService.process_encrypted_image(
            data['image']['url'], aes_key
        )
        
        if not success:
            logger.error(f"图片处理失败: {result}")
            return Response(content="success", media_type="text/plain")
        
        decrypted_data = result
        stream_id = WorkWeixinChatService._generate_random_string(10)
        finish = True
        
        stream = WorkWeixinChatService.make_image_stream(
            stream_id, decrypted_data, finish
        )
        resp = WorkWeixinChatService.encrypt_message(
            chatbot_id, stream, nonce, timestamp
        )
        return Response(content=resp, media_type="text/plain")
        
    elif msgtype == 'mixed':
        logger.warning("需要支持mixed消息类型")
        return Response(content="success", media_type="text/plain")
        
    elif msgtype == 'event':
        logger.warning(f"需要支持event消息类型: {data}")
        return Response(content="success", media_type="text/plain")
        
    else:
        logger.warning(f"不支持的消息类型: {msgtype}")
        return Response(content="success", media_type="text/plain")
