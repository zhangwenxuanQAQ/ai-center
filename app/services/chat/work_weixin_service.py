"""
企业微信聊天服务类，提供企业微信回调处理功能
"""

import os
import json
import logging
import random
import string
import time
import base64
import hashlib
import requests
from typing import Tuple, Optional
from Crypto.Cipher import AES

from app.core.chat.work_weixin.WXBizJsonMsgCrypt import WXBizJsonMsgCrypt
from app.database.models import Chatbot

logger = logging.getLogger(__name__)


class WorkWeixinChatService:
    """
    企业微信聊天服务类
    
    提供企业微信回调验证、消息加解密、消息处理等功能
    """
    
    @staticmethod
    def _generate_random_string(length: int) -> str:
        """
        生成随机字符串
        
        Args:
            length: 字符串长度
            
        Returns:
            str: 随机字符串
        """
        letters = string.ascii_letters + string.digits
        return ''.join(random.choice(letters) for _ in range(length))
    
    @staticmethod
    def _get_chatbot_config(chatbot_id: int) -> Optional[dict]:
        """
        获取机器人配置
        
        Args:
            chatbot_id: 机器人ID
            
        Returns:
            dict: 机器人配置，包含Token和EncodingAESKey
        """
        try:
            chatbot = Chatbot.get_by_id(chatbot_id)
            if chatbot and chatbot.source_config:
                config = json.loads(chatbot.source_config)
                return config
        except Chatbot.DoesNotExist:
            logger.error(f"机器人 {chatbot_id} 不存在")
        except json.JSONDecodeError:
            logger.error(f"机器人 {chatbot_id} 的source_config格式错误")
        return None
    
    @staticmethod
    def verify_url(
        chatbot_id: int,
        msg_signature: str,
        timestamp: str,
        nonce: str,
        echostr: str
    ) -> Tuple[int, str]:
        """
        验证回调URL
        
        Args:
            chatbot_id: 机器人ID
            msg_signature: 签名串
            timestamp: 时间戳
            nonce: 随机串
            echostr: 加密的随机串
            
        Returns:
            Tuple[int, str]: (错误码, 解密后的echostr)
        """
        config = WorkWeixinChatService._get_chatbot_config(chatbot_id)
        if not config:
            return -1, "机器人配置不存在"
        
        token = config.get('token', '')
        encoding_aes_key = config.get('encoding_aes_key', '')
        
        receiveid = ''
        wxcpt = WXBizJsonMsgCrypt(token, encoding_aes_key, receiveid)
        
        ret, decrypted_echostr = wxcpt.VerifyURL(
            msg_signature,
            timestamp,
            nonce,
            echostr
        )
        
        if ret != 0:
            logger.error(f"URL验证失败，错误码: {ret}")
            return ret, "verify fail"
        
        return 0, decrypted_echostr
    
    @staticmethod
    def decrypt_message(
        chatbot_id: int,
        post_data: bytes,
        msg_signature: str,
        timestamp: str,
        nonce: str
    ) -> Tuple[int, Optional[dict]]:
        """
        解密消息
        
        Args:
            chatbot_id: 机器人ID
            post_data: POST数据
            msg_signature: 签名串
            timestamp: 时间戳
            nonce: 随机串
            
        Returns:
            Tuple[int, Optional[dict]]: (错误码, 解密后的消息字典)
        """
        config = WorkWeixinChatService._get_chatbot_config(chatbot_id)
        if not config:
            return -1, None
        
        token = config.get('token', '')
        encoding_aes_key = config.get('encoding_aes_key', '')
        
        receiveid = ''
        wxcpt = WXBizJsonMsgCrypt(token, encoding_aes_key, receiveid)
        
        ret, msg = wxcpt.DecryptMsg(
            post_data,
            msg_signature,
            timestamp,
            nonce
        )
        
        if ret != 0:
            logger.error(f"消息解密失败，错误码: {ret}")
            return ret, None
        
        try:
            data = json.loads(msg)
            return 0, data
        except json.JSONDecodeError:
            logger.error("消息JSON解析失败")
            return -1, None
    
    @staticmethod
    def make_text_stream(stream_id: str, content: str, finish: bool) -> str:
        """
        构建文本流消息
        
        Args:
            stream_id: 流ID
            content: 内容
            finish: 是否结束
            
        Returns:
            str: JSON格式的流消息
        """
        plain = {
            "msgtype": "stream",
            "stream": {
                "id": stream_id,
                "finish": finish,
                "content": content
            }
        }
        return json.dumps(plain, ensure_ascii=False)
    
    @staticmethod
    def make_image_stream(stream_id: str, image_data: bytes, finish: bool) -> str:
        """
        构建图片流消息
        
        Args:
            stream_id: 流ID
            image_data: 图片数据
            finish: 是否结束
            
        Returns:
            str: JSON格式的流消息
        """
        image_md5 = hashlib.md5(image_data).hexdigest()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        plain = {
            "msgtype": "stream",
            "stream": {
                "id": stream_id,
                "finish": finish,
                "msg_item": [
                    {
                        "msgtype": "image",
                        "image": {
                            "base64": image_base64,
                            "md5": image_md5
                        }
                    }
                ]
            }
        }
        return json.dumps(plain)
    
    @staticmethod
    def process_text_message(
        chatbot_id: int,
        content: str
    ) -> Tuple[str, str, bool]:
        """
        处理文本消息
        
        Args:
            chatbot_id: 机器人ID
            content: 消息内容
            
        Returns:
            Tuple[str, str, bool]: (stream_id, 回复内容, 是否结束)
        """
        stream_id = WorkWeixinChatService._generate_random_string(10)
        
        answer = f"收到消息: {content}"
        finish = True
        
        return stream_id, answer, finish
    
    @staticmethod
    def get_stream_answer(
        chatbot_id: int,
        stream_id: str
    ) -> Tuple[str, bool]:
        """
        获取流式回答
        
        Args:
            chatbot_id: 机器人ID
            stream_id: 流ID
            
        Returns:
            Tuple[str, bool]: (回答内容, 是否结束)
        """
        answer = "处理完成"
        finish = True
        
        return answer, finish
    
    @staticmethod
    def encrypt_message(
        chatbot_id: int,
        stream: str,
        nonce: str,
        timestamp: str,
        receiveid: str = ''
    ) -> Optional[str]:
        """
        加密消息
        
        Args:
            chatbot_id: 机器人ID
            receiveid: 接收ID
            nonce: 随机串
            timestamp: 时间戳
            stream: 流消息JSON字符串
            
        Returns:
            Optional[str]: 加密后的消息，失败返回None
        """
        config = WorkWeixinChatService._get_chatbot_config(chatbot_id)
        if not config:
            return None
        
        token = config.get('token', '')
        encoding_aes_key = config.get('encoding_aes_key', '')
        
        logger.info(f"开始加密消息，receiveid={receiveid}, nonce={nonce}, timestamp={timestamp}")
        logger.debug(f"发送流消息: {stream}")
        
        wxcpt = WXBizJsonMsgCrypt(token, encoding_aes_key, receiveid)
        ret, resp = wxcpt.EncryptMsg(stream, nonce, timestamp)
        
        if ret != 0:
            logger.error(f"加密失败，错误码: {ret}")
            return None
        
        stream_data = json.loads(stream)
        stream_id = stream_data['stream']['id']
        finish = stream_data['stream']['finish']
        logger.info(f"回调处理完成, 返回加密的流消息, stream_id={stream_id}, finish={finish}")
        logger.debug(f"加密后的消息: {resp}")
        
        return resp
    
    @staticmethod
    def process_encrypted_image(image_url: str, aes_key_base64: str) -> Tuple[bool, bytes or str]:
        """
        下载并解密加密图片
        
        Args:
            image_url: 加密图片的URL
            aes_key_base64: Base64编码的AES密钥
            
        Returns:
            Tuple[bool, bytes or str]: (状态, 解密后的图片数据或错误信息)
        """
        try:
            logger.info(f"开始下载加密图片: {image_url}")
            response = requests.get(image_url, timeout=15)
            response.raise_for_status()
            encrypted_data = response.content
            logger.info(f"图片下载成功，大小: {len(encrypted_data)} 字节")
            
            if not aes_key_base64:
                raise ValueError("AES密钥不能为空")
            
            aes_key = base64.b64decode(aes_key_base64 + "=" * (-len(aes_key_base64) % 4))
            if len(aes_key) != 32:
                raise ValueError("无效的AES密钥长度: 应为32字节")
            
            iv = aes_key[:16]
            
            cipher = AES.new(aes_key, AES.MODE_CBC, iv)
            decrypted_data = cipher.decrypt(encrypted_data)
            
            pad_len = decrypted_data[-1]
            if pad_len > 32:
                raise ValueError("无效的填充长度 (大于32字节)")
            
            decrypted_data = decrypted_data[:-pad_len]
            logger.info(f"图片解密成功，解密后大小: {len(decrypted_data)} 字节")
            
            return True, decrypted_data
            
        except requests.exceptions.RequestException as e:
            error_msg = f"图片下载失败: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except ValueError as e:
            error_msg = f"参数错误: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"图片处理异常: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
