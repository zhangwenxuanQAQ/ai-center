# Author: zwx
# Date: 2025/4/15 16:05
# Description: input_optimize 输入优化模块（去除停用词，去除重复粗，去除特殊字符）
import json
import logging
import time
from abc import ABC

from pandas import DataFrame

from ..base import ComponentBase, ComponentParamBase, ComponentBaseFrontEndField
from agent.util.global_memory_util import init_single_memory_config, get_memory_result


class GlobalMemoryParamFrontEndField(ComponentBaseFrontEndField):
    """
    全局记忆组件参数前端控件
    """

    memory_configs = {
        "key": "memory_configs",
        "label": "记忆配置",
        "type": "custom",
        "description": "配置需要获取的全局记忆字段",
    }


class GlobalMemoryParam(ComponentParamBase):
    """
    参数
    """

    def __init__(self):
        super().__init__()
        """
        数组的每一项
            {       
                "source" : "记忆来源" # component/agent/system   组件字段,agent,系统
                "type" : input/reference #参数类型   引用/文本
                "component_id": "categorize:0" #组件id
                "name" : "参数字段名" #组件参数字段
                "label" : "参数中文名"
                "datatype" : "数据类型"
                "value" 参数值
            }
        """
        self.memory_configs = self.init_memory_configs()  # 记忆配置

    def check(self):
        """
        检验参数
        :return:
        """
        pass

    @classmethod
    def init_memory_configs(cls):
        """
        默认配置
        :return:
        """
        # {value: "string", label: "string"},
        # {value: "int", label: "int"},
        # {value: "float", label: "float"},
        # {value: "object", label: "object"},
        # {value: "array", label: "array"},
        # {value: "boolean", label: "boolean"},
        configs = []
        agent_configs = []
        agent_configs.append(
            init_single_memory_config(source="agent", name="messages", label="问答消息记录", datatype="array"))
        agent_configs.append(
            init_single_memory_config(source="agent", name="components", label="组件信息", datatype="object"))
        agent_configs.append(
            init_single_memory_config(source="agent", name="component_ids", label="组件ID列表", datatype="array"))
        agent_configs.append(
            init_single_memory_config(source="agent", name="component_names", label="组件名称列表", datatype="array"))
        agent_configs.append(init_single_memory_config(source="agent", name="path", label="节点执行路径", datatype="array"))
        agent_configs.append(init_single_memory_config(source="agent", name="graph", label="画布数据", datatype="object"))

        configs.extend(agent_configs)
        return configs


class GlobalMemory(ComponentBase, ABC):
    component_name = "GlobalMemory"
    component_title = "全局记忆"

    def __init__(self, canvas, id, param: ComponentParamBase):
        super().__init__(canvas, id, param)
        # TODO 初始化用户画像参数

    def _run(self, history, **kwargs):
        start = time.time()
        logging.info(f"开始运行{self.component_name}")
        self.append_log("返回记忆存储")
        logging.info(f"{self.component_name}完成，耗时{round(time.time() - start, 2)}s")

        result = get_memory_result(self._param.memory_configs, self._canvas)
        return GlobalMemory.be_output(json.dumps(result, ensure_ascii=False))

    def debug(self, **kwargs):
        return self._run([], **kwargs)
