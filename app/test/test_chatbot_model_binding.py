"""
测试机器人模型绑定功能
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database.models import ChatbotModel, Chatbot, LLMModel
from app.services.chatbot.service import ChatbotService
from app.database.database import db

def test_chatbot_model_table():
    """测试chatbot_model表是否存在"""
    print("=" * 60)
    print("测试1: 检查chatbot_model表是否存在")
    print("=" * 60)
    
    if ChatbotModel.table_exists():
        print("✓ chatbot_model表已创建")
        return True
    else:
        print("✗ chatbot_model表不存在")
        return False

def test_get_chatbot_models():
    """测试获取机器人绑定的模型"""
    print("\n" + "=" * 60)
    print("测试2: 获取机器人绑定的模型")
    print("=" * 60)
    
    chatbots = Chatbot.select().where(Chatbot.deleted == False).limit(1)
    chatbot = list(chatbots)
    
    if not chatbot:
        print("⚠ 没有找到机器人，跳过测试")
        return True
    
    chatbot_id = str(chatbot[0].id)
    print(f"使用机器人ID: {chatbot_id}")
    
    models = ChatbotService.get_chatbot_models(chatbot_id)
    print(f"✓ 获取到 {len(models)} 个绑定的模型")
    for model in models:
        print(f"  - {model['name']} ({model['model_type']})")
    
    return True

def test_bind_unbind_model():
    """测试绑定和解绑模型"""
    print("\n" + "=" * 60)
    print("测试3: 绑定和解绑模型")
    print("=" * 60)
    
    chatbots = Chatbot.select().where(Chatbot.deleted == False).limit(1)
    chatbot = list(chatbots)
    
    if not chatbot:
        print("⚠ 没有找到机器人，跳过测试")
        return True
    
    chatbot_id = str(chatbot[0].id)
    print(f"使用机器人ID: {chatbot_id}")
    
    llm_models = LLMModel.select().where((LLMModel.deleted == False) & (LLMModel.status == True)).limit(1)
    llm_model = list(llm_models)
    
    if not llm_model:
        print("⚠ 没有找到启用的模型，跳过测试")
        return True
    
    model_id = str(llm_model[0].id)
    model_type = llm_model[0].model_type
    print(f"使用模型ID: {model_id}, 类型: {model_type}")
    
    try:
        print("\n步骤1: 绑定模型")
        binding = ChatbotService.bind_model_to_chatbot(chatbot_id, model_id, model_type)
        print(f"✓ 模型绑定成功，绑定ID: {binding.id}")
        
        print("\n步骤2: 验证绑定")
        bound_model = ChatbotService.get_chatbot_model_by_type(chatbot_id, model_type)
        if bound_model and bound_model['id'] == model_id:
            print("✓ 绑定验证成功")
        else:
            print("✗ 绑定验证失败")
            return False
        
        print("\n步骤3: 解绑模型")
        ChatbotService.unbind_model_from_chatbot(chatbot_id, model_type)
        print("✓ 模型解绑成功")
        
        print("\n步骤4: 验证解绑")
        bound_model = ChatbotService.get_chatbot_model_by_type(chatbot_id, model_type)
        if bound_model is None:
            print("✓ 解绑验证成功")
        else:
            print("✗ 解绑验证失败")
            return False
        
        return True
    except Exception as e:
        print(f"✗ 测试失败: {str(e)}")
        return False

def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print("开始测试机器人模型绑定功能")
    print("=" * 60)
    
    results = []
    
    results.append(("表创建测试", test_chatbot_model_table()))
    results.append(("获取绑定模型测试", test_get_chatbot_models()))
    results.append(("绑定解绑测试", test_bind_unbind_model()))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{name}: {status}")
    
    all_passed = all(result for _, result in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("所有测试通过！")
    else:
        print("部分测试失败！")
    print("=" * 60)

if __name__ == "__main__":
    main()
