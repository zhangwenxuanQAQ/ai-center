import sys

with open('app/core/chat/chat_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到需要替换的代码块
old_code = '''                # 4. 按顺序执行子任务
                task_results = []
                
                for i, task in enumerate(task_plan):
                    # 生成task_execution阶段的step_id
                    task_execution_step_id = f"step_{uuid.uuid4().hex[:8]}"
                    
                    # 3. 子任务执行开始 - yield start消息
                    yield ChatStreamResponse.start_response(
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        step='task_execution',
                        step_id=task_execution_step_id
                    ).to_dict()
                    
                    # 更新任务状态为running
                    task.status = 'running'
                    yield ChatStreamResponse.task_plan_response(
                        task_plan=task_plan,
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        step_id=task_execution_step_id
                    ).to_dict()
                    
                    # 3.1. 子任务流程 - 使用原有的while循环逻辑'''

new_code = '''                # 4. 按顺序执行子任务
                task_results = []
                
                for i, task in enumerate(task_plan):
                    # 生成task_execution阶段的step_id
                    task_execution_step_id = f"step_{uuid.uuid4().hex[:8]}"
                    
                    # 子任务执行开始 - yield start消息
                    yield ChatStreamResponse.start_response(
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        step='task_execution',
                        step_id=task_execution_step_id
                    ).to_dict()
                    
                    # 更新任务状态为running
                    task.status = 'running'
                    yield ChatStreamResponse.task_plan_response(
                        task_plan=task_plan,
                        chat_id=chat_id,
                        user_message_id=user_message_id,
                        assistant_message_id=assistant_message_id,
                        step_id=task_execution_step_id
                    ).to_dict()
                    
                    # 构建任务上下文（包含用户问题和前置任务结果）
                    task_context = user_text
                    if i > 0 and task_results:
                        context_text = "\\n\\n前置任务结果："
                        for j, result in enumerate(task_results[:i]):
                            context_text += f"\\n- 任务{result.get('id', j+1)} ({result.get('name', '')}): {result.get('result', '')[:200]}"
                        task_context = f"{user_text}{context_text}"
                    
                    # 执行单个子任务 - 使用_execute_single_task方法'''

content = content.replace(old_code, new_code)

with open('app/core/chat/chat_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Code replacement successful')