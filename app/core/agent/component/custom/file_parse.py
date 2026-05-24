# Author: zwx
# Date: 2025/11/04 09:10
# Description: 文件解析，使用LLM进行图片，文本，音频识别
import json
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import partial

from pandas import DataFrame

from agent.component import GenerateParam, Generate
from api.db import FileType
from api.db.services.file_service import FileService
from api.utils.file_utils import filename_type


class FileParseParam(GenerateParam):

    def __init__(self):
        super().__init__()
        self.temperature = 0.5
        self.prompt = "请用中文描述一下图中的内容，比如时间，地点，人物，事情，人物心情等，如果有数据请提取出数据"
        self.deep_thinking = True
        self.file_params = []  # 文件参数 {name:参数名 , from: input或reference ,component_id:依赖组件id ,value:参数值}
        self.vision_llm_id = ""  # 图像识别模型
        self.audio_llm_id = ""  # 语音识别模型

    def check(self):
        self.check_empty(self.file_params, "文件来源为空")


class FileParse(Generate):
    component_name = "FileParse"

    def get_dependent_components(self):
        cpnts = set([para["component_id"] for para in self._param.file_params \
                     if para.get("component_id") \
                     and para["component_id"].lower().find("answer") < 0 \
                     and para["component_id"].lower().find("begin@") < 0 and para["component_id"].lower().find(
                "sys.") < 0])
        return list(cpnts)

    def _run(self, history, **kwargs):

        query = self.get_input(default=self._canvas.globals["sys.query"])  # 输入
        query = '\n'.join(query["content"]) if "content" in query else ""
        query = query.strip()

        user_prompt = [query]  # 用户提示词

        system_prompt = self.process_prompt(**kwargs)

        files = self.get_file_params_values()  # 从文件配置获取文件列表
        messages = [{"role": "system", "content": system_prompt}]
        for up in user_prompt:
            messages.append({"role": "user", "content": up})

        # messages.append({"role": "user", "content": files})

        downstreams = self._canvas.get_component(self._id)["downstream"]
        if self._param.stream and kwargs.get("stream") and len(downstreams) == 1 and \
                self._canvas.get_component(downstreams[0])[
                    "obj"].component_name.lower() == "answer":
            return partial(self.stream_parse, system_prompt, user_prompt, files, messages)  # 流式输出

        # 如果下游有结果输出节点
        component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]
        if kwargs.get("stream") and len(component_answer_downstream) > 0:
            return partial(self.stream_parse, system_prompt, user_prompt, files, messages)  # 流式输出

        def return_content(file):
            return file["content"]

        conf = self._param.gen_conf()
        exe = ThreadPoolExecutor(max_workers=5)
        threads = []
        task_size = len(files)
        output_queue = queue.Queue()  # 线程输出结果队列
        done_events = [threading.Event() for _ in range(task_size)]  # 线程信号

        for i in range(len(files)):
            file = files[i]
            threads.append(
                exe.submit(self.task_thread, i, file, system_prompt, user_prompt, output_queue, done_events[i]))
            # if "content" in file:
            #     threads.append(exe.submit(return_content, file))
            # else:
            #     file_type = filename_type(file["name"])
            #     llm_name = self._param.vision_llm_id  # 默认视觉模型
            #     if file_type == FileType.AURAL:
            #         llm_name = self._param.audio_llm_id
            #
            #     threads.append(
            #         exe.submit(FileService.parse, file["name"], FileService.get_blob(file["created_by"], file["id"]),
            #                    True,
            #                    file["created_by"], prompt=system_prompt, user_prompt=user_prompt, llm_name=llm_name,
            #                    only_use_llm=True if llm_name else False,
            #                    conf=conf))
        # for future in as_completed(threads):
        #     res, i = future.result()  # 获取已完成任务的结果
        #     files[i]["content"] = threads[i].result()
        completed_count = 0
        # 实时处理输出
        while completed_count < task_size:
            try:
                item, generator_id = output_queue.get(timeout=0.1)
                if item == "COMPLETED":
                    completed_count += 1
                    print(f"file parse thread {generator_id} completed, {task_size-completed_count} left")
                else:
                    files[generator_id]["content"] = item
                    # yield item, thread_agent
            except queue.Empty:
                # 检查是否有生成器完成但队列为空的情况
                if any(event.is_set() for event in done_events):
                    continue
        # for i in range(len(files)):
        #     files[i]["content"] = threads[i].result()

        self.append_log(f"文件识别返回：{files}")
        self._canvas.set_component_infor(self._id, {"prompt": system_prompt, "messages": messages,
                                                    "conf": self._param.gen_conf()})

        return FileParse.be_output(json.dumps(files, ensure_ascii=False))

    def task_thread(self, generator_id, file, system_prompt, user_prompt, output_queue, done_event):
        """流式传输生成器输出"""
        conf = self._param.gen_conf()
        res = ""
        try:
            if "content" in file:
                # return res, generator_id
                output_queue.put((file["content"], generator_id))
            else:
                file_type = filename_type(file["name"])
                llm_name = None
                if file_type == FileType.VISUAL:
                    llm_name = self._param.vision_llm_id
                if file_type == FileType.AURAL:
                    llm_name = self._param.audio_llm_id

                res = FileService.parse(file["name"], FileService.get_blob(file["created_by"], file["id"]),
                                        True,
                                        file["created_by"], prompt=system_prompt, user_prompt=user_prompt,
                                        llm_name=llm_name,
                                        only_use_llm=True if llm_name else False,
                                        conf=conf)
                output_queue.put((res, generator_id))
        finally:
            # return res, generator_id
            output_queue.put(("COMPLETED", generator_id))
            done_event.set()

    def stream_parse(self, system_prompt, user_prompt, files, messages):
        self.set_start_time(time.time())
        res = None
        exe = ThreadPoolExecutor(max_workers=5)
        threads = []

        def yield_content(file):
            yield file["content"]

        conf = self._param.gen_conf()
        for file in files:
            if "content" in file:
                threads.append(exe.submit(yield_content, file))
            else:
                file_type = filename_type(file["name"])
                llm_name = None
                if file_type == FileType.VISUAL:
                    llm_name = self._param.vision_llm_id
                if file_type == FileType.AURAL:
                    llm_name = self._param.audio_llm_id

                threads.append(
                    exe.submit(FileService.parse_streamly, file["name"],
                               FileService.get_blob(file["created_by"], file["id"]),
                               True,
                               file["created_by"], prompt=system_prompt, user_prompt=user_prompt, llm_name=llm_name,
                               only_use_llm=True if llm_name else False,
                               conf=conf))

        for i in range(len(files)):
            gen = threads[i].result()
            for ans in gen:
                yield {"content": ans, "reference": []}

            files[i]["content"] = ans

        self._canvas.set_component_infor(self._id, {"prompt": system_prompt, "messages": messages,
                                                    "conf": self._param.gen_conf()})
        self.set_end_time_and_append_log(time.time())  # 添加结束时间
        self.set_output(FileParse.be_output(json.dumps(files, ensure_ascii=False)))

    def get_file_params_values(self):
        result = []
        file_params = self._param.file_params
        if file_params:
            for params in file_params:
                if params["from"] == "input":
                    component_id = ""
                    value = params["value"]
                    result.extend(self.parse_file_config(value))
                else:
                    component_id = params["component_id"]
                    value = self.get_reference_input_value(component_id)
                    if isinstance(value, DataFrame):
                        value = "\n".join(value["content"]) if "content" in value else ""
                        result.extend(self.parse_file_config(value))
                    else:
                        continue

                self._param.inputs.append({
                    "component_id": component_id,
                    "content": value
                })
        return result

    def parse_file_config(self, value) -> list:
        file_format = {"create_by": "用户id", "name": "文件名称", "id": "文件id"}
        if value is None:
            return []
        try:
            value = json.loads(value)
            if isinstance(value, dict):
                return [value]
            elif isinstance(value, list):
                return value
            else:
                raise Exception(f"文件参数格式不正确,正确格式为{json.dumps(file_format, ensure_ascii=False)}")
                self.append_log(f"文件参数解析异常{str(e)}")
        except Exception as e:
            self.append_log(f"文件参数解析异常{str(e)}")
            raise e
