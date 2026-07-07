"""
LLM模型控制器，提供LLM模型相关的API接口
"""

from fastapi import APIRouter, Query, Body
from app.services.llm_model.service import LLMModelService, LLMCategoryService
from app.services.llm_model.dto import (
    LLMModelCreate, LLMModelUpdate, LLMModel as LLMModelSchema,
    LLMCategoryCreate, LLMCategoryUpdate, LLMCategory as LLMCategorySchema,
    LLMModelTest
)
from app.utils.response import ResponseUtil, ApiResponse
from app.constants.llm_constants import MODEL_TYPE, MODEL_CONFIG_PARAMS

router = APIRouter()


@router.get("/tags", response_model=ApiResponse)
def get_model_tags(model_type: str = Query(None, description="模型类型")):
    """
    获取模型标签
    
    Args:
        model_type: 模型类型（可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含标签列表
    """
    tags = LLMModelService.get_model_tags(model_type)
    return ResponseUtil.success(data=tags, message="获取模型标签成功")


@router.get("/model_types", response_model=ApiResponse)
def get_model_types():
    """
    获取LLM模型类型
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    return ResponseUtil.success(data=MODEL_TYPE, message="获取模型类型成功")


@router.get("/config_params", response_model=ApiResponse)
def get_config_params():
    """
    获取LLM模型配置参数
    
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    return ResponseUtil.success(data=MODEL_CONFIG_PARAMS, message="获取模型配置参数成功")


@router.post("/category", response_model=ApiResponse)
def create_llm_category(category: LLMCategoryCreate):
    """
    创建LLM分类
    
    Args:
        category: LLM分类创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = LLMCategoryService.create_category(category)
    return ResponseUtil.created(data=db_category.__data__, message="LLM分类创建成功")


@router.get("/category", response_model=ApiResponse)
def get_llm_categories(skip: int = 0, limit: int = 100):
    """
    获取LLM分类列表
    
    Args:
        skip: 跳过的记录数
        limit: 返回的最大记录数
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    categories = LLMCategoryService.get_categories(skip, limit)
    categories_data = [category.__data__ for category in categories]
    return ResponseUtil.success(data=categories_data, message="获取LLM分类列表成功")


@router.get("/category/tree", response_model=ApiResponse)
def get_llm_category_tree():
    """
    获取LLM分类树形结构
    
    Returns:
        ApiResponse: 统一格式的响应对象，包含分类树形结构
    """
    tree = LLMCategoryService.get_category_tree()
    return ResponseUtil.success(data=tree, message="获取LLM分类树成功")


@router.get("/category/{category_id}", response_model=ApiResponse)
def get_llm_category(category_id: str):
    """
    获取单个LLM分类
    
    Args:
        category_id: LLM分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    category = LLMCategoryService.get_category(category_id)
    if category is None:
        return ResponseUtil.not_found(message=f"LLM分类 {category_id} 不存在")
    return ResponseUtil.success(data=category.__data__, message="获取LLM分类成功")


@router.post("/category/{category_id}", response_model=ApiResponse)
def update_llm_category(category_id: str, category: LLMCategoryUpdate):
    """
    更新LLM分类
    
    Args:
        category_id: LLM分类ID
        category: LLM分类更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_category = LLMCategoryService.update_category(category_id, category)
    return ResponseUtil.success(data=db_category.__data__, message="LLM分类更新成功")


@router.post("/category/{category_id}/delete", response_model=ApiResponse)
def delete_llm_category(category_id: str):
    """
    删除LLM分类
    
    Args:
        category_id: LLM分类ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    try:
        db_category = LLMCategoryService.delete_category(category_id)
        return ResponseUtil.success(data=db_category.__data__, message="LLM分类删除成功")
    except ValueError as e:
        return ResponseUtil.error(message=str(e))


@router.post("", response_model=ApiResponse)
def create_llm_model(llm_model: LLMModelCreate):
    """
    创建LLM模型
    
    Args:
        llm_model: LLM模型创建DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.create_llm_model(llm_model)
    return ResponseUtil.created(data=db_llm_model.__data__, message="LLM模型创建成功")


@router.get("", response_model=ApiResponse)
def get_llm_models(
    page: int = Query(1, description="页码"),
    page_size: int = Query(12, description="每页数量"),
    category_id: str = Query(None, description="分类ID"),
    name: str = Query(None, description="模型名称（模糊查询）"),
    model_type: str = Query(None, description="模型类型"),
    status: str = Query(None, description="状态（true/false）"),
    tags: str = Query(None, description="标签过滤，多个标签用逗号分隔")
):
    """
    获取LLM模型列表（分页）
    
    Args:
        page: 页码，默认1
        page_size: 每页数量，默认12
        category_id: 分类ID（可选）
        name: 模型名称（模糊查询，可选）
        model_type: 模型类型（可选）
        status: 状态（true/false，可选）
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含data和total
    """
    skip = (page - 1) * page_size
    # 处理tags参数，转换为列表
    tag_list = tags.split(',') if tags else None
    llm_models = LLMModelService.get_llm_models(skip, page_size, category_id, name, model_type, status, tag_list)
    total = LLMModelService.count_llm_models(category_id, name, model_type, status, tag_list)
    from app.services.llm_model.dto import LLMModel as LLMModelDTO
    llm_models_data = [LLMModelDTO.model_validate(llm_model).model_dump() for llm_model in llm_models]
    return ResponseUtil.success(data={"data": llm_models_data, "total": total}, message="获取LLM模型列表成功")


@router.get("/model/{llm_model_id}", response_model=ApiResponse)
def get_llm_model(llm_model_id: str):
    """
    获取单个LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    llm_model = LLMModelService.get_llm_model(llm_model_id)
    if llm_model is None:
        return ResponseUtil.not_found(message=f"LLM模型 {llm_model_id} 不存在")
    from app.services.llm_model.dto import LLMModel as LLMModelDTO
    llm_model_data = LLMModelDTO.model_validate(llm_model).model_dump()
    return ResponseUtil.success(data=llm_model_data, message="获取LLM模型成功")


@router.post("/model/{llm_model_id}", response_model=ApiResponse)
def update_llm_model(llm_model_id: str, llm_model: LLMModelUpdate):
    """
    更新LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        llm_model: LLM模型更新DTO
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.update_llm_model(llm_model_id, llm_model)
    return ResponseUtil.success(data=db_llm_model.__data__, message="LLM模型更新成功")


@router.post("/model/{llm_model_id}/delete", response_model=ApiResponse)
def delete_llm_model(llm_model_id: str):
    """
    删除LLM模型
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象
    """
    db_llm_model = LLMModelService.delete_llm_model(llm_model_id)
    return ResponseUtil.success(data=db_llm_model.__data__, message="LLM模型删除成功")


@router.post("/test_config", response_model=ApiResponse)
def test_model_config(model_test: LLMModelTest):
    """
    测试模型配置（通过配置参数）
    
    Args:
        model_test: 模型测试DTO，包含模型配置参数
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        result = LLMModelService.test_model_config(model_test)
        if result['success']:
            return ResponseUtil.success(data=result, message="模型连接测试成功")
        else:
            return ResponseUtil.error(data=result, message=result['message'])
    except Exception as e:
        return ResponseUtil.error(message=str(e))


@router.post("/model/{llm_model_id}/test", response_model=ApiResponse)
def test_model_connection(llm_model_id: str):
    """
    测试模型连接（通过模型ID）
    
    Args:
        llm_model_id: LLM模型ID
        
    Returns:
        ApiResponse: 统一格式的响应对象，包含测试结果
    """
    try:
        result = LLMModelService.test_model_connection(llm_model_id)
        if result['success']:
            return ResponseUtil.success(data=result, message="模型连接测试成功")
        else:
            return ResponseUtil.error(data=result, message=result['message'])
    except Exception as e:
        return ResponseUtil.error(message=str(e))


@router.post("/model/{llm_model_id}/chat")
async def chat_with_model(llm_model_id: str, request: dict = Body(...)):
    """
    与模型进行对话（流式输出）

    Args:
        llm_model_id: 模型ID
        request: 请求体，包含messages、config和可选的query参数

    Returns:
        StreamingResponse: 流式响应
    """
    from fastapi.responses import StreamingResponse
    from fastapi import HTTPException
    import json
    import logging
    import tempfile
    import base64
    import os
    from app.core.llm_model.factory import LLMFactory
    from app.services.chat.dto import QueryItem
    from app.core.chat.chat_service import ChatCoreService
    from app.core.llm_model.audio_model import convert_to_wav, cleanup_temp_files

    logger = logging.getLogger(__name__)

    try:
        logger.info(f"Chat request for model {llm_model_id}")
        logger.info(f"Request body: {request}")

        db_llm_model = LLMModelService.get_llm_model(llm_model_id)
        if not db_llm_model:
            logger.error(f"Model {llm_model_id} not found")
            raise HTTPException(status_code=404, detail="模型不存在")

        messages = request.get('messages', [])
        query = request.get('query', [])
        config = request.get('config', {})

        logger.info(f"Messages: {messages}")
        logger.info(f"Query: {query}")
        logger.info(f"Config: {config}")

        if not messages:
            logger.error("Messages is empty")
            raise HTTPException(status_code=400, detail="消息不能为空")

        from app.core.prompt.utils.system_prompt_builder import build_system_prompt

        # 获取模型类型
        model_type = db_llm_model.model_type or 'text'

        # 处理系统消息和历史消息（包括文件格式）
        has_system_message = False
        processed_messages = []
        for msg in messages:
            if msg.get('role') == 'system':
                built_system_prompt = build_system_prompt(msg.get('content'))
                processed_messages.append({
                    'role': 'system',
                    'content': built_system_prompt
                })
                has_system_message = True
            else:
                # 处理历史消息中的文件格式
                content = msg.get('content')

                # 如果content是数组格式（包含文件），需要处理自定义文件格式
                if isinstance(content, list):
                    # 检查是否包含自定义文件格式（file_base64, document）
                    has_custom_files = any(
                        item.get('type') in ('file_base64', 'document')
                        for item in content if isinstance(item, dict)
                    )

                    # 检查是否包含音频文件（对音频模型保留原格式）
                    has_audio_files = False
                    if model_type == 'audio':
                        has_audio_files = any(
                            item.get('type') == 'file_base64' and
                            (item.get('mime_type') or '').startswith('audio/')
                            for item in content if isinstance(item, dict)
                        )

                    if has_audio_files:
                        # 音频模型：将音频文件转换为wav格式后设置到input_audio中
                        content_parts = []
                        temp_files = []
                        try:
                            for item in content:
                                if isinstance(item, dict):
                                    if item.get('type') == 'text':
                                        content_parts.append({
                                            'type': 'text',
                                            'text': item.get('text', '')
                                        })
                                    elif item.get('type') == 'input_audio':
                                        # input_audio格式，需要检查并转换为wav格式
                                        input_audio = item.get('input_audio', {})
                                        audio_data = input_audio.get('data', '')
                                        audio_format = input_audio.get('format', 'wav')

                                        # 如果已经是wav格式，直接使用
                                        if audio_format == 'wav' and not audio_data.startswith('data:'):
                                            content_parts.append(item)
                                        else:
                                            # 其他格式需要转换为wav
                                            wav_base64_data = None
                                            # 处理data URI格式
                                            if audio_data.startswith('data:'):
                                                try:
                                                    # 提取base64部分
                                                    base64_part = audio_data.split(',', 1)[1] if ',' in audio_data else audio_data[5:]
                                                    raw_data = base64.b64decode(base64_part)
                                                    temp_file = tempfile.NamedTemporaryFile(suffix='.tmp', delete=False)
                                                    temp_file.write(raw_data)
                                                    temp_file.close()
                                                    temp_files.append(temp_file.name)

                                                    converted_path, error_msg = convert_to_wav(temp_file.name)
                                                    if converted_path:
                                                        with open(converted_path, 'rb') as f:
                                                            wav_data = f.read()
                                                        wav_base64_data = base64.b64encode(wav_data).decode('utf-8')
                                                        if converted_path != temp_file.name:
                                                            temp_files.append(converted_path)
                                                    else:
                                                        logger.warning(f"转换input_audio失败: {error_msg}")
                                                except Exception as e:
                                                    logger.warning(f"转换input_audio失败: {e}")

                                            if wav_base64_data:
                                                content_parts.append({
                                                    'type': 'input_audio',
                                                    'input_audio': {
                                                        'data': wav_base64_data,
                                                        'format': 'wav'
                                                    }
                                                })
                                            else:
                                                content_parts.append(item)
                                    elif item.get('type') == 'file_base64':
                                        mime_type = item.get('mime_type', '')
                                        if mime_type.startswith('audio/'):
                                            audio_base64 = item.get('content', '')
                                            if audio_base64:
                                                # 将base64转换为临时文件再转换为wav
                                                temp_file = tempfile.NamedTemporaryFile(suffix='.tmp', delete=False)
                                                temp_file.write(base64.b64decode(audio_base64))
                                                temp_file.close()
                                                temp_files.append(temp_file.name)

                                                converted_path, error_msg = convert_to_wav(temp_file.name)
                                                if converted_path:
                                                    with open(converted_path, 'rb') as f:
                                                        wav_data = f.read()
                                                    wav_base64 = base64.b64encode(wav_data).decode('utf-8')
                                                    content_parts.append({
                                                        'type': 'input_audio',
                                                        'input_audio': {
                                                            'data': wav_base64,
                                                            'format': 'wav'
                                                        }
                                                    })
                                                    if converted_path != temp_file.name:
                                                        temp_files.append(converted_path)
                                                else:
                                                    logger.warning(f"转换音频文件失败 [{item.get('file_name', 'unknown')}]: {error_msg}")
                                                    content_parts.append({
                                                        'type': 'text',
                                                        'text': f'[音频文件转换失败: {item.get("file_name", "unknown")}]'
                                                    })
                                            else:
                                                content_parts.append({
                                                    'type': 'text',
                                                    'text': f'[音频文件: {item.get("file_name", "unknown")}]'
                                                })
                                        else:
                                            # 非音频文件，转换为文本描述
                                            content_parts.append({
                                                'type': 'text',
                                                'text': f'[文件: {item.get("file_name", "unknown")}]'
                                            })
                                    elif item.get('type') == 'document':
                                        # document类型转换为文本描述
                                        content_parts.append({
                                            'type': 'text',
                                            'text': f'[文档: {item.get("content", "unknown")}]'
                                        })
                        finally:
                            # 清理临时文件
                            cleanup_temp_files(*temp_files)

                        processed_messages.append({
                            'role': msg.get('role'),
                            'content': content_parts
                        })
                    elif has_custom_files:
                        # 非音频模型或有非音频文件：将自定义文件格式转换为文本内容
                        # 提取文本部分
                        text_parts = []
                        file_items = []

                        for item in content:
                            if isinstance(item, dict):
                                if item.get('type') == 'text':
                                    text_parts.append(item.get('text', ''))
                                elif item.get('type') in ('file_base64', 'document'):
                                    # 将文件转换为QueryItem格式
                                    from app.services.chat.dto import QueryItem
                                    if item.get('type') == 'file_base64':
                                        file_items.append(QueryItem(
                                            type='file_base64',
                                            content=item.get('content'),
                                            mime_type=item.get('mime_type'),
                                            file_name=item.get('file_name'),
                                            file_size=item.get('file_size')
                                        ))
                                    elif item.get('type') == 'document':
                                        file_items.append(QueryItem(
                                            type='document',
                                            content=item.get('content')
                                        ))

                        # 使用build_user_prompt_with_documents将文件转换为文本
                        if file_items:
                            from app.core.prompt.utils.user_prompt_builder import build_user_prompt_with_documents
                            original_text = ' '.join(text_parts)
                            document_text = build_user_prompt_with_documents(file_items, original_text, "naive")
                            processed_messages.append({
                                'role': msg.get('role'),
                                'content': document_text
                            })
                        else:
                            # 没有文件，只保留文本
                            processed_messages.append({
                                'role': msg.get('role'),
                                'content': ' '.join(text_parts)
                            })
                    else:
                        # 只包含标准格式（image_url, input_audio），直接使用
                        processed_messages.append(msg)
                else:
                    # content是字符串，直接使用
                    processed_messages.append(msg)

        if not has_system_message:
            built_system_prompt = build_system_prompt(None)
            processed_messages.insert(0, {
                'role': 'system',
                'content': built_system_prompt
            })

        # 如果有query参数，将其合并到最新的用户消息中
        if query:
            logger.info(f"Processing query parameter: {query}")
            # 将query转换为QueryItem对象
            query_items = [QueryItem(**item) if isinstance(item, dict) else item for item in query]
            model_type = db_llm_model.model_type or 'text'

            # 将query转换为用户消息格式
            query_message = ChatCoreService.convert_query_to_message(query_items, model_type, llm_model_id)
            logger.info(f"Converted query to message: {query_message}")

            # 找到最新的用户消息并合并
            last_user_message_index = -1
            for i in range(len(processed_messages) - 1, -1, -1):
                if processed_messages[i].get('role') == 'user':
                    last_user_message_index = i
                    break

            if last_user_message_index >= 0:
                # 合并最新用户消息的文本内容和query中的文件
                last_user_message = processed_messages[last_user_message_index]

                # 如果query_message是字符串，说明只有文本，合并文本内容
                if isinstance(query_message.get('content'), str):
                    # 将原用户消息的文本和query中的文本合并
                    original_text = last_user_message.get('content', '')
                    if isinstance(original_text, str):
                        # 如果原消息也是字符串，合并文本
                        query_text = query_message.get('content', '')
                        new_content = original_text + '\n' + query_text if original_text else query_text
                        processed_messages[last_user_message_index] = {
                            'role': 'user',
                            'content': new_content
                        }
                    else:
                        # 如果原消息是复杂格式（包含图片等），需要特殊处理
                        # 这里暂时直接替换为query_message
                        processed_messages[last_user_message_index] = query_message
                else:
                    # query_message是复杂格式（包含图片、文件等）
                    # 需要将原用户消息的文本添加到query_message中
                    original_text = last_user_message.get('content', '')
                    if isinstance(original_text, str) and original_text.strip():
                        # 将原文本添加到query_message的content数组中
                        if isinstance(query_message.get('content'), list):
                            # 在content数组开头添加原文本
                            query_message['content'].insert(0, {
                                'type': 'text',
                                'text': original_text
                            })
                            processed_messages[last_user_message_index] = query_message
                        else:
                            # 如果query_message.content不是数组，创建一个新的数组
                            processed_messages[last_user_message_index] = {
                                'role': 'user',
                                'content': [
                                    {'type': 'text', 'text': original_text},
                                    query_message['content']
                                ]
                            }
                    else:
                        # 如果原消息没有文本，直接替换为query_message
                        processed_messages[last_user_message_index] = query_message

                logger.info(f"Merged query with last user message: {processed_messages[last_user_message_index]}")
            else:
                # 如果没有找到用户消息，将query_message添加到消息列表中
                processed_messages.append(query_message)
                logger.info(f"Added query as new user message")

        messages = processed_messages
        logger.info(f"Final processed messages: {messages}")

        model_config = {
            'api_key': db_llm_model.api_key,
            'endpoint': db_llm_model.endpoint,
            'name': db_llm_model.name,
            'provider': db_llm_model.provider
        }

        logger.info(f"Model config: {model_config}")

        model_type = db_llm_model.model_type or 'text'
        logger.info(f"Model type: {model_type}")

        model_instance = LLMFactory.create_model(model_type, model_config)
        logger.info(f"Model instance created successfully")

        def generate():
            try:
                logger.info("Starting stream generation")
                for chunk in model_instance.stream_generate_with_messages(messages, **config):
                    if 'error' in chunk:
                        logger.error(f"Error in chunk: {chunk['error']}")
                        yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                        break
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
                logger.info("Stream generation completed")
            except Exception as e:
                logger.error(f"Error in generate: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat_with_model: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
