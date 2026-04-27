#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
音频模型测试脚本
用于测试ffmpeg可用性和音频模型连接
"""

import os
import sys
import logging

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from app.core.llm_model.audio_model import AudioModel, get_ffmpeg_path


def test_ffmpeg():
    """测试ffmpeg"""
    logger.info("=" * 60)
    logger.info("测试ffmpeg")
    logger.info("=" * 60)
    
    ffmpeg_path = get_ffmpeg_path()
    
    if ffmpeg_path:
        logger.info(f"✓ 找到ffmpeg: {ffmpeg_path}")
        
        # 测试执行
        try:
            import subprocess
            result = subprocess.run(
                [ffmpeg_path, '-version'] if ffmpeg_path != 'ffmpeg' else ['ffmpeg', '-version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                version_line = result.stdout.split('\n')[0]
                logger.info(f"✓ ffmpeg可用: {version_line}")
                return True
            else:
                logger.error(f"✗ ffmpeg执行失败: {result.stderr}")
                return False
        except Exception as e:
            logger.error(f"✗ ffmpeg测试失败: {str(e)}")
            return False
    else:
        logger.error("✗ 未找到ffmpeg")
        return False


def test_audio_conversion():
    """测试音频转换"""
    logger.info("\n" + "=" * 60)
    logger.info("测试音频转换")
    logger.info("=" * 60)
    
    # 测试音频文件路径
    audio_path = os.path.join(project_root, 'web', 'src', 'assets', 'llm', 'test', 'audio_test.m4a')
    
    if not os.path.exists(audio_path):
        logger.error(f"✗ 测试音频文件不存在: {audio_path}")
        return False
    
    logger.info(f"测试音频文件: {audio_path}")
    
    # 创建音频模型实例
    model_config = {
        'model_name': 'qwen3-asr-flash',
        'provider': 'Qwen',
        'endpoint': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'api_key': 'sk-255883a7b368485c80949839b6898466'
    }
    
    audio_model = AudioModel(model_config)
    
    # 测试音频转换
    try:
        wav_path, error_msg = audio_model._convert_to_wav(audio_path)
        
        if error_msg:
            logger.error(f"✗ 音频转换失败: {error_msg}")
            return False
        
        logger.info(f"✓ 音频转换成功")
        logger.info(f"转换后文件: {wav_path}")
        
        # 检查转换后的文件是否存在
        if os.path.exists(wav_path):
            file_size = os.path.getsize(wav_path)
            logger.info(f"文件大小: {file_size} 字节")
            
            # 清理临时文件
            try:
                os.unlink(wav_path)
                logger.info("✓ 临时文件已清理")
            except:
                pass
            
            return True
        else:
            logger.error("✗ 转换后的文件不存在")
            return False
    except Exception as e:
        logger.error(f"✗ 音频转换时出错: {str(e)}", exc_info=True)
        return False


def test_audio_model():
    """测试音频模型连接"""
    logger.info("\n" + "=" * 60)
    logger.info("测试音频模型连接")
    logger.info("=" * 60)
    
    # 测试音频文件路径
    audio_path = os.path.join(project_root, 'web', 'src', 'assets', 'llm', 'test', 'audio_test.m4a')
    
    if not os.path.exists(audio_path):
        logger.error(f"✗ 测试音频文件不存在: {audio_path}")
        return False
    
    # 创建音频模型实例
    model_config = {
        'model_name': 'qwen3-asr-flash',
        'provider': 'Qwen',
        'endpoint': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'api_key': 'sk-255883a7b368485c80949839b6898466'
    }
    
    logger.info(f"模型配置:")
    logger.info(f"  - 模型名称: {model_config['model_name']}")
    logger.info(f"  - 供应商: {model_config['provider']}")
    logger.info(f"  - 端点: {model_config['endpoint']}")
    
    try:
        audio_model = AudioModel(model_config)
        
        logger.info(f"\n开始测试音频转录...")
        result = audio_model.generate(audio_path)
        
        if 'error' in result:
            logger.error(f"✗ 音频模型测试失败: {result['error']}")
            return False
        
        logger.info(f"✓ 音频模型测试成功")
        logger.info(f"\n转录结果:")
        logger.info(f"  - 文本: {result.get('text', '')}")
        logger.info(f"  - 模型: {result.get('model', '')}")
        
        if 'usage' in result:
            logger.info(f"  - 使用量: {result['usage']}")
        
        return True
    except Exception as e:
        logger.error(f"✗ 音频模型测试时出错: {str(e)}", exc_info=True)
        return False


def main():
    """主函数"""
    logger.info("\n" + "=" * 60)
    logger.info("音频模型测试脚本")
    logger.info("=" * 60)
    
    # 测试ffmpeg
    ffmpeg_ok = test_ffmpeg()
    
    if ffmpeg_ok:
        # 测试音频转换
        conversion_ok = test_audio_conversion()
        
        if conversion_ok:
            # 测试音频模型
            test_audio_model()
    
    logger.info("\n" + "=" * 60)
    logger.info("测试完成")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()