"""
模型测试工具

用于测试不同类型模型的连通性和功能是否可用
"""

import os
import json
from typing import Dict, Any, Optional
from app.core.llm_model.factory import LLMFactory


class ModelTestUtils:
    """
    模型测试工具类
    """
    
    @staticmethod
    def test_text_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试文本模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果，包含support_image字段表示是否支持图片
        """
        try:
            # 创建文本模型实例
            model = LLMFactory.create_model('text', model_config)
            
            # 先测试基本的文本生成能力
            test_prompt = "请简要介绍一下你自己"
            response = model.generate(test_prompt, max_tokens=10)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}",
                    'support_image': False
                }
            
            if not ('text' in response and response['text'].strip()):
                return {
                    'success': False,
                    'message': "测试失败: 模型返回了空结果",
                    'support_image': False
                }
            
            # 文本生成成功，现在测试图片支持能力
            image_path = os.path.join(os.getcwd(), 'web', 'src', 'assets', 'llm', 'test', 'support_image_test.jpg')
            support_image = False
            
            if os.path.exists(image_path):
                # 测试图片识别
                test_prompt = "请描述这张图片的内容"
                try:
                    # 将图片转换为base64
                    import base64
                    with open(image_path, 'rb') as f:
                        image_data = f.read()
                    image_base64 = base64.b64encode(image_data).decode('utf-8')
                    
                    # 调用模型识别图片
                    response = model.generate(test_prompt, image=image_base64, max_tokens=10)
                    
                    if 'text' in response and response['text'].strip() and 'error' not in response:
                        support_image = True
                except Exception:
                    # 图片识别失败，不支持图片
                    pass
            
            return {
                'success': True,
                'message': "测试成功！模型能够正常生成文本" + ("，并支持图片识别" if support_image else ""),
                'result': response['text'][:100] + '...' if len(response['text']) > 100 else response['text'],
                'support_image': support_image
            }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}",
                'support_image': False
            }
    
    @staticmethod
    def test_vision_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试视觉模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        try:
            # 创建视觉模型实例
            model = LLMFactory.create_model('vision', model_config)
            
            # 测试图像识别
            test_prompt = "请描述这张图片的内容"
            # 测试文件在前端的assets/llm/test目录下
            image_path = os.path.join(os.getcwd(), 'web', 'src', 'assets', 'llm', 'test', 'vision_test.jpg')
            
            if not os.path.exists(image_path):
                return {
                    'success': False,
                    'message': "测试失败: vision_test.jpg文件不存在"
                }
            
            # 这里需要根据实际的视觉模型接口调整参数
            # 假设模型支持image_url参数
            response = model.generate(test_prompt, image_url=f"file://{image_path}", max_tokens=10)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}"
                }
            
            if 'text' in response and response['text'].strip():
                return {
                    'success': True,
                    'message': "测试成功！模型能够正常识别图像",
                    'result': response['text'][:100] + '...' if len(response['text']) > 100 else response['text']
                }
            else:
                return {
                    'success': False,
                    'message': "测试失败: 模型返回了空结果"
                }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}"
            }
    
    @staticmethod
    def test_audio_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试音频模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        try:
            # 创建音频模型实例
            model = LLMFactory.create_model('audio', model_config)
            
            # 测试文件在前端的assets/llm/test目录下
            audio_path = os.path.join(os.getcwd(), 'web', 'src', 'assets', 'llm', 'test', 'audio_test.m4a')
            
            if not os.path.exists(audio_path):
                return {
                    'success': False,
                    'message': "测试失败: audio_test.m4a文件不存在"
                }
            
            # 使用VoiceModel的接口，直接传入文件路径
            response = model.generate(audio_path)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}"
                }
            
            if 'text' in response and response['text'].strip():
                return {
                    'success': True,
                    'message': "测试成功！模型能够正常处理音频",
                    'result': response['text'][:100] + '...' if len(response['text']) > 100 else response['text']
                }
            else:
                return {
                    'success': False,
                    'message': "测试失败: 模型返回了空结果"
                }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}"
            }
    
    @staticmethod
    def test_tts_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试TTS模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        try:
            # 创建TTS模型实例
            model = LLMFactory.create_model('tts', model_config)
            
            # 测试语音合成
            test_prompt = "这是一段测试文本，用于测试TTS模型的语音合成功能"
            response = model.generate(test_prompt, max_tokens=10)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}"
                }
            
            if 'audio_data' in response and response['audio_data']:
                return {
                    'success': True,
                    'message': "测试成功！模型能够正常合成语音",
                    'result': f"生成的音频数据长度: {len(response['audio_data'])} bytes"
                }
            else:
                return {
                    'success': False,
                    'message': "测试失败: 模型没有返回音频数据"
                }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}"
            }
    
    @staticmethod
    def test_embedding_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试Embedding模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        try:
            # 创建Embedding模型实例
            model = LLMFactory.create_model('embedding', model_config)
            
            # 测试文本嵌入
            test_prompt = "这是一段测试文本，用于测试Embedding模型"
            response = model.generate(test_prompt)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}"
                }
            
            if 'embedding' in response and isinstance(response['embedding'], list):
                return {
                    'success': True,
                    'message': "测试成功！模型能够正常生成嵌入向量",
                    'result': f"嵌入向量维度: {len(response['embedding'])}"
                }
            else:
                return {
                    'success': False,
                    'message': "测试失败: 模型没有返回有效的嵌入向量"
                }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}"
            }
    
    @staticmethod
    def test_rerank_model(model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        测试Rerank模型
        
        Args:
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        try:
            # 创建Rerank模型实例
            model = LLMFactory.create_model('rerank', model_config)
            
            # 测试重排序
            test_prompt = "人工智能"
            test_documents = [
                "人工智能是研究、开发用于模拟、延伸和扩展人的智能的理论、方法、技术及应用系统的一门新的技术科学。",
                "机器学习是人工智能的一个分支，它使计算机系统能够从数据中学习并改进其性能，而无需明确编程。",
                "深度学习是机器学习的一个分支，它使用多层神经网络来模拟人类大脑的学习过程。"
            ]
            
            # 这里需要根据实际的Rerank模型接口调整参数
            response = model.generate(test_prompt, documents=test_documents,top_n=2)
            
            if 'error' in response:
                return {
                    'success': False,
                    'message': f"测试失败: {response['error']}"
                }
            
            if 'ranked_documents' in response and isinstance(response['ranked_documents'], list):
                return {
                    'success': True,
                    'message': "测试成功！模型能够正常进行重排序",
                    'result': f"返回的文档数量: {len(response['ranked_documents'])}"
                }
            else:
                return {
                    'success': False,
                    'message': "测试失败: 模型没有返回有效的重排序结果"
                }
        except Exception as e:
            return {
                'success': False,
                'message': f"测试失败: {str(e)}"
            }
    
    @staticmethod
    def test_model(model_type: str, model_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据模型类型测试模型
        
        Args:
            model_type: 模型类型
            model_config: 模型配置
            
        Returns:
            测试结果
        """
        test_functions = {
            'text': ModelTestUtils.test_text_model,
            'vision': ModelTestUtils.test_vision_model,
            'audio': ModelTestUtils.test_audio_model,
            'voice': ModelTestUtils.test_audio_model,
            'tts': ModelTestUtils.test_tts_model,
            'embedding': ModelTestUtils.test_embedding_model,
            'rerank': ModelTestUtils.test_rerank_model
        }
        
        if model_type in test_functions:
            return test_functions[model_type](model_config)
        else:
            return {
                'success': False,
                'message': f"不支持的模型类型: {model_type}",
                'support_image': False
            }
