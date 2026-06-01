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

from .. import GenerateParam, Generate, GenerateParamFrontEndField
from app.constants.knowledgebase_document_constants import FileType
from app.core.knowledgebase.utils.file_utils import filename_type
from app.core.knowledgebase.rag.app import CHUNK_STRATEGIES
from app.core.knowledgebase.rag.app.picture import chunk as picture_chunk, chunk_streamly as picture_chunk_streamly
from app.core.knowledgebase.rag.app.audio import chunk as audio_chunk, chunk_streamly as audio_chunk_streamly


class FileParseParamFrontEndField(GenerateParamFrontEndField):
    """
    文件识别组件参数前端控件
    """

    file_params = {
        "key": "file_params",
        "label": "文件参数",
        "type": "custom",
        "description": "配置文件来源和参数映射",
    }

    vision_llm_id = {
        "key": "vision_llm_id",
        "label": "视觉模型",
        "type": "select",
        "description": "用于图像/文档识别的视觉大模型",
    }

    audio_llm_id = {
        "key": "audio_llm_id",
        "label": "语音模型",
        "type": "select",
        "description": "用于音频识别的语音大模型",
    }


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
    component_title = "文件识别"

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
        
        prompt = f"{system_prompt}\n{'\n'.join(user_prompt)}" if system_prompt else '\n'.join(user_prompt)

        downstreams = self._canvas.get_component(self._id)["downstream"]
        if self._param.stream and kwargs.get("stream") and len(downstreams) == 1 and \
                self._canvas.get_component(downstreams[0])[
                    "obj"].component_name.lower() == "answer":
            return partial(self.stream_parse, prompt, files)  # 流式输出

        component_answer_downstream = [x for x in downstreams if "ComponentAnswer" in x]
        if kwargs.get("stream") and len(component_answer_downstream) > 0:
            return partial(self.stream_parse, prompt, files)  # 流式输出

        conf = self._param.gen_conf()
        exe = ThreadPoolExecutor(max_workers=5)
        threads = []
        task_size = len(files)
        output_queue = queue.Queue()
        done_events = [threading.Event() for _ in range(task_size)]

        for i in range(len(files)):
            file = files[i]
            threads.append(
                exe.submit(self.task_thread, i, file, prompt, conf, output_queue, done_events[i]))

        completed_count = 0
        while completed_count < task_size:
            try:
                item, generator_id = output_queue.get(timeout=0.1)
                if item == "COMPLETED":
                    completed_count += 1
                    print(f"file parse thread {generator_id} completed, {task_size-completed_count} left")
                else:
                    files[generator_id]["content"] = item
            except queue.Empty:
                if any(event.is_set() for event in done_events):
                    continue

        self.append_log(f"文件识别返回：{files}")
        self._canvas.set_component_infor(self._id, {"prompt": prompt,
                                                    "conf": self._param.gen_conf()})

        return FileParse.be_output(json.dumps(files, ensure_ascii=False))

    def task_thread(self, generator_id, file, prompt, conf, output_queue, done_event):
        res = ""
        try:
            if "content" in file:
                output_queue.put((file["content"], generator_id))
            else:
                file_type = filename_type(file["name"])
                binary = file.get("binary") or file.get("content_binary")
                
                res = self._parse_file(file["name"], binary, file_type, prompt, conf)
                output_queue.put((res, generator_id))
        finally:
            output_queue.put(("COMPLETED", generator_id))
            done_event.set()

    def _parse_file(self, filename, binary, file_type, prompt, conf):
        """根据文件类型调用不同的切片方法"""
        kwargs = {
            'temperature': conf.get('temperature', 0.5),
            'max_tokens': conf.get('max_tokens', 8192),
            'top_p': conf.get('top_p', 0.9),
        }
        
        if self._param.vision_llm_id:
            kwargs['llm_id'] = self._param.vision_llm_id
        
        if self._param.audio_llm_id and file_type == FileType.AURAL:
            kwargs['llm_id'] = self._param.audio_llm_id

        visual_types = (FileType.VISUAL, FileType.DOC, FileType.PDF)
        if self._param.vision_llm_id and file_type in visual_types:
            chunks = picture_chunk(filename, binary, lang="Chinese", **kwargs)
        elif file_type == FileType.AURAL:
            chunks = audio_chunk(filename, binary, lang="Chinese", **kwargs)
        else:
            chunk_method = self._get_chunk_method(file_type, filename)
            chunk_func = CHUNK_STRATEGIES.get(chunk_method)
            if chunk_func:
                chunks = chunk_func(filename, binary, lang="Chinese", **kwargs)
            else:
                return f"不支持的文件类型: {file_type}"

        text_parts = []
        if chunks:
            for chunk in chunks:
                if isinstance(chunk, dict):
                    content = chunk.get("content", "") or chunk.get("content_with_weight", "")
                    if content:
                        text_parts.append(content.strip())
                elif isinstance(chunk, str):
                    text_parts.append(chunk.strip())
        
        return "\n".join(text_parts) if text_parts else "文件解析结果为空"

    def _get_chunk_method(self, file_type, filename):
        """根据文件类型获取切片方法"""
        from app.constants.knowledgebase_document_constants import get_default_chunk_method
        return get_default_chunk_method(file_type, filename)

    def stream_parse(self, prompt, files):
        self.set_start_time(time.time())
        res = None
        exe = ThreadPoolExecutor(max_workers=5)
        threads = []

        conf = self._param.gen_conf()

        for file in files:
            if "content" in file:
                def yield_content(content):
                    yield content
                threads.append(exe.submit(yield_content, file["content"]))
            else:
                file_type = filename_type(file["name"])
                binary = file.get("binary") or file.get("content_binary")
                
                threads.append(exe.submit(self._stream_parse_file, file["name"], binary, file_type, prompt, conf))

        for i in range(len(files)):
            gen = threads[i].result()
            file_content = ""
            for ans in gen:
                if isinstance(ans, dict):
                    content = ans.get("content", "")
                    file_content += content
                    yield {"content": content, "reference": []}
                else:
                    file_content += str(ans)
                    yield {"content": str(ans), "reference": []}

            files[i]["content"] = file_content

        self._canvas.set_component_infor(self._id, {"prompt": prompt,
                                                    "conf": self._param.gen_conf()})
        self.set_end_time_and_append_log(time.time())
        self.set_output(FileParse.be_output(json.dumps(files, ensure_ascii=False)))

    def _stream_parse_file(self, filename, binary, file_type, prompt, conf):
        """流式解析文件"""
        kwargs = {
            'temperature': conf.get('temperature', 0.5),
            'max_tokens': conf.get('max_tokens', 8192),
            'top_p': conf.get('top_p', 0.9),
        }
        
        if self._param.vision_llm_id:
            kwargs['llm_id'] = self._param.vision_llm_id
        
        if self._param.audio_llm_id and file_type == FileType.AURAL:
            kwargs['llm_id'] = self._param.audio_llm_id

        visual_types = (FileType.VISUAL, FileType.DOC, FileType.PDF)
        if self._param.vision_llm_id and file_type in visual_types:
            chunks = picture_chunk_streamly(filename, binary, lang="Chinese", **kwargs)
        elif file_type == FileType.AURAL:
            chunks = audio_chunk_streamly(filename, binary, lang="Chinese", **kwargs)
        else:
            chunk_method = self._get_chunk_method(file_type, filename)
            chunk_func = CHUNK_STRATEGIES.get(chunk_method)
            if chunk_func:
                chunks = chunk_func(filename, binary, lang="Chinese", **kwargs)
                for chunk in chunks:
                    if isinstance(chunk, dict):
                        content = chunk.get("content", "") or chunk.get("content_with_weight", "")
                        if content:
                            yield content
            else:
                yield f"不支持的文件类型: {file_type}"
            return

        for chunk in chunks:
            if isinstance(chunk, dict):
                if chunk.get("type") == "content":
                    yield chunk.get("content", "")
            elif isinstance(chunk, str):
                yield chunk

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
                err_msg = f"文件参数格式不正确,正确格式为{json.dumps(file_format, ensure_ascii=False)}"
                self.append_log(err_msg)
                raise Exception(err_msg)
        except Exception as e:
            self.append_log(f"文件参数解析异常{str(e)}")
            raise e