***

name: agent-workflow-dev
description: 实现智能体工作流前后端开发
--------------------------

## 主要功能点

- 智能体分类
- 智能体组件管理
- 智能体版本管理
- 智能体模板
- 智能体工作流配置
- 智能体运行以及日志查看
- 前端使用画布进行组件拖拽连线来实现工作流配置

## 技术栈

- React
- python
- 前端工作流配置: @xyflow/react

## 满足如下要求

- 在项目功能菜单的"配置"下添加子菜单"智能体"，放到"知识库"下面，点击进入智能体主页。
- 智能体主页左侧为分类树，右侧为智能体列表并使用卡片展示，上方新增按钮和搜索框。（组件布局和样式可以参考知识库页面）
- 点击新增智能体后打开新增弹窗，包含配置项：名称，编码，描述，启用停用开关。点击智能体卡片进入智能体配置页。
- 使用@xyflow/react实现智能体配置页。 左侧栏:组件列表，中：工作流画布，右下角：小地图， 左下角：画布缩放，居中 , 锁定 ，右上角："运行"，"发布" ， "保存" ，"删除" , "上架模板"按钮
- 从左侧组件列表中可以拖拽组件到右侧画布，每个节点左右可以连接其他节点。 连接方式有两种：
  1. 鼠标按住连接点不放并拖拽连接到另一个节点的连接点上。
  2. 单击连接点弹出其他节点列表，选择节点后自动创建连线。
- 节点连线不能出现死循环和自连接，鼠标悬浮到连线上显示连线删除图标。
- 右键点击节点弹出操作选项：支持复制，删除
- 左键点击节点后，在右侧打开抽屉。抽屉内容为：使用tabs（2个tab页），tab1为"节点配置"，内容：节点名称，描述，节点配置项。tab2为"运行结果"，内容为：输入，输入，日志，其他信息
- 画布支持操作回退和重置。点击回退返回到上一步操作，重置则恢复到所有操作前状态
- 节点内容需要显示：节点头像，节点名称。（部分组件节点可能有其他的展示内容，具体后面再定义）
- 选中节点后节点需要高亮
- 点击右上角运行按钮后需要保存当前智能体配置（包括画布dsl）到后端。然后右边使用抽屉打开对话界面，包含中间对话内容区域，下方用户问题输入区域（参考提示词新增页面的提示词测试抽屉）
- 每个画布必须有且只有一个Begin节点和一个Answer节点。 Begin和Answer节点不能删除，复制。 Begin只能向外连接其他节点。
- 根据已有库表生成对应dto和数据模型 （在下方有说明已有库表名称）

## 智能体组件类说明：

- base.py为基本组件类，每个组件都有两个class： "组件名"+Param 和 "组件名"。
- 组件名Param：定义组件需要配置的参数字段
- 组件类： component\_name为组件ID，和类名一样。 \_run方法为每个组件运行的方法
- begin.py 为开始节点类
- answer.py为最终回答类（也就是结束节点）

## 画布dsl json说明：

components为所有节点组件信息。
globals为全局参数。
graph为画布上节点节点和连线信息
history为问答历史列表
messages为openai规范格式的消息列表
path为执行路径。数组中每个子数组表示对应轮次的执行节点

例子1：

```json
{
      "answer": [],
      "components": {
        "AkShare:CalmHotelsKnow": {
          "downstream": [
            "Generate:SolidAreasRing"
          ],
          "obj": {
            "component_name": "AkShare",
            "inputs": [],
            "output": null,
            "params": {
              "debug_inputs": [],
              "inputs": [],
              "message_history_window_size": 22,
              "output": null,
              "output_var_name": "output",
              "query": [],
              "top_n": 10
            }
          },
          "upstream": [
            "KeywordExtract:BreezyGoatsRead"
          ]
        },
        "Answer:NeatLandsWave": {
          "downstream": [
            "WenCai:TenParksOpen",
            "KeywordExtract:BreezyGoatsRead"
          ],
          "obj": {
            "component_name": "Answer",
            "inputs": [],
            "output": null,
            "params": {
              "debug_inputs": [],
              "inputs": [],
              "message_history_window_size": 22,
              "output": null,
              "output_var_name": "output",
              "post_answers": [],
              "query": []
            }
          },
          "upstream": [
            "begin",
            "Generate:SolidAreasRing"
          ]
        },
        "Generate:SolidAreasRing": {
          "downstream": [
            "Answer:NeatLandsWave"
          ],
          "obj": {
            "component_name": "Generate",
            "inputs": [],
            "output": null,
            "params": {
              "cite": true,
              "debug_inputs": [],
              "frequency_penalty": 0.7,
              "inputs": [],
              "llm_id": "deepseek-chat@DeepSeek",
              "max_tokens": 0,
              "message_history_window_size": 1,
              "output": null,
              "output_var_name": "output",
              "parameters": [],
              "presence_penalty": 0.4,
              "prompt": "Role: You are a professional financial counseling assistant.\n\nTask: Answer user's question based on content provided by Wencai and AkShare.\n\nNotice:\n- Output no more than 5 news items from AkShare if there's content provided by Wencai.\n- Items from AkShare MUST have a corresponding URL link.\n\n############\nContent provided by Wencai: \n{WenCai:TenParksOpen}\n\n################\nContent provided by AkShare: \n\n{AkShare:CalmHotelsKnow}\n\n\n",
              "query": [],
              "temperature": 0.1,
              "top_p": 0.3
            }
          },
          "upstream": [
            "WenCai:TenParksOpen",
            "AkShare:CalmHotelsKnow"
          ]
        },
        "KeywordExtract:BreezyGoatsRead": {
          "downstream": [
            "AkShare:CalmHotelsKnow"
          ],
          "obj": {
            "component_name": "KeywordExtract",
            "inputs": [],
            "output": null,
            "params": {
              "cite": true,
              "debug_inputs": [],
              "frequencyPenaltyEnabled": true,
              "frequency_penalty": 0.7,
              "inputs": [],
              "llm_id": "deepseek-chat@DeepSeek",
              "maxTokensEnabled": true,
              "max_tokens": 256,
              "message_history_window_size": 22,
              "output": null,
              "output_var_name": "output",
              "parameter": "Precise",
              "parameters": [],
              "presencePenaltyEnabled": true,
              "presence_penalty": 0.4,
              "prompt": "",
              "query": [],
              "temperature": 0.1,
              "temperatureEnabled": true,
              "topPEnabled": true,
              "top_n": 2,
              "top_p": 0.3
            }
          },
          "upstream": [
            "Answer:NeatLandsWave"
          ]
        },
        "WenCai:TenParksOpen": {
          "downstream": [
            "Generate:SolidAreasRing"
          ],
          "obj": {
            "component_name": "WenCai",
            "inputs": [],
            "output": null,
            "params": {
              "debug_inputs": [],
              "inputs": [],
              "message_history_window_size": 22,
              "output": null,
              "output_var_name": "output",
              "query": [],
              "query_type": "stock",
              "top_n": 5
            }
          },
          "upstream": [
            "Answer:NeatLandsWave"
          ]
        },
        "begin": {
          "downstream": [
            "Answer:NeatLandsWave"
          ],
          "obj": {
            "component_name": "Begin",
            "inputs": [],
            "output": null,
            "params": {
              "debug_inputs": [],
              "inputs": [],
              "message_history_window_size": 22,
              "output": null,
              "output_var_name": "output",
              "prologue": "Hi there!",
              "query": []
            }
          },
          "upstream": []
        }
      },
      "embed_id": "",
      "graph": {
        "edges": [
          {
            "id": "reactflow__edge-begin-Answer:NeatLandsWavec",
            "markerEnd": "logo",
            "source": "begin",
            "sourceHandle": null,
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "Answer:NeatLandsWave",
            "targetHandle": "c",
            "type": "buttonEdge"
          },
          {
            "id": "reactflow__edge-Answer:NeatLandsWaveb-WenCai:TenParksOpenc",
            "markerEnd": "logo",
            "source": "Answer:NeatLandsWave",
            "sourceHandle": "b",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "WenCai:TenParksOpen",
            "targetHandle": "c",
            "type": "buttonEdge"
          },
          {
            "id": "reactflow__edge-KeywordExtract:BreezyGoatsReadb-AkShare:CalmHotelsKnowc",
            "markerEnd": "logo",
            "source": "KeywordExtract:BreezyGoatsRead",
            "sourceHandle": "b",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "AkShare:CalmHotelsKnow",
            "targetHandle": "c",
            "type": "buttonEdge"
          },
          {
            "id": "reactflow__edge-Answer:NeatLandsWaveb-KeywordExtract:BreezyGoatsReadc",
            "markerEnd": "logo",
            "source": "Answer:NeatLandsWave",
            "sourceHandle": "b",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "KeywordExtract:BreezyGoatsRead",
            "targetHandle": "c",
            "type": "buttonEdge"
          },
          {
            "id": "xy-edge__WenCai:TenParksOpenb-Generate:SolidAreasRingb",
            "markerEnd": "logo",
            "source": "WenCai:TenParksOpen",
            "sourceHandle": "b",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "Generate:SolidAreasRing",
            "targetHandle": "b",
            "type": "buttonEdge",
            "zIndex": 1001
          },
          {
            "id": "xy-edge__AkShare:CalmHotelsKnowb-Generate:SolidAreasRingb",
            "markerEnd": "logo",
            "source": "AkShare:CalmHotelsKnow",
            "sourceHandle": "b",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "Generate:SolidAreasRing",
            "targetHandle": "b",
            "type": "buttonEdge",
            "zIndex": 1001
          },
          {
            "id": "xy-edge__Generate:SolidAreasRingc-Answer:NeatLandsWavec",
            "markerEnd": "logo",
            "source": "Generate:SolidAreasRing",
            "sourceHandle": "c",
            "style": {
              "stroke": "rgb(202 197 245)",
              "strokeWidth": 2
            },
            "target": "Answer:NeatLandsWave",
            "targetHandle": "c",
            "type": "buttonEdge",
            "zIndex": 1001
          }
        ],
        "nodes": [
          {
            "data": {
              "form": {
                "prologue": "Hi there!"
              },
              "label": "Begin",
              "name": "Opening"
            },
            "dragging": false,
            "height": 44,
            "id": "begin",
            "measured": {
              "height": 44,
              "width": 100
            },
            "position": {
              "x": -609.7949690891593,
              "y": -29.12385224725604
            },
            "positionAbsolute": {
              "x": -521.8118264317484,
              "y": -27.999467037576665
            },
            "selected": false,
            "sourcePosition": "left",
            "targetPosition": "right",
            "type": "beginNode"
          },
          {
            "data": {
              "form": {
                "query_type": "stock",
                "top_n": 5
              },
              "label": "WenCai",
              "name": "Wencai"
            },
            "dragging": false,
            "height": 44,
            "id": "WenCai:TenParksOpen",
            "measured": {
              "height": 44,
              "width": 200
            },
            "position": {
              "x": -13.030801663267397,
              "y": -30.557141660610256
            },
            "positionAbsolute": {
              "x": -13.030801663267397,
              "y": -30.557141660610256
            },
            "selected": false,
            "sourcePosition": "right",
            "targetPosition": "left",
            "type": "ragNode",
            "width": 200
          },
          {
            "data": {
              "form": {
                "top_n": 10
              },
              "label": "AkShare",
              "name": "AKShare"
            },
            "dragging": false,
            "height": 44,
            "id": "AkShare:CalmHotelsKnow",
            "measured": {
              "height": 44,
              "width": 200
            },
            "position": {
              "x": 250.32227681412806,
              "y": 74.24036022703525
            },
            "positionAbsolute": {
              "x": 267.17349571786156,
              "y": 100.01281266803943
            },
            "selected": false,
            "sourcePosition": "right",
            "targetPosition": "left",
            "type": "ragNode",
            "width": 200
          },
          {
            "data": {
              "form": {},
              "label": "Answer",
              "name": "Interact"
            },
            "dragging": false,
            "height": 44,
            "id": "Answer:NeatLandsWave",
            "measured": {
              "height": 44,
              "width": 200
            },
            "position": {
              "x": -304.0612563145512,
              "y": -29.054278091837944
            },
            "positionAbsolute": {
              "x": -304.0612563145512,
              "y": -29.054278091837944
            },
            "selected": false,
            "sourcePosition": "right",
            "targetPosition": "left",
            "type": "logicNode",
            "width": 200
          },
          {
            "data": {
              "form": {
                "frequencyPenaltyEnabled": true,
                "frequency_penalty": 0.7,
                "llm_id": "deepseek-chat@DeepSeek",
                "maxTokensEnabled": true,
                "max_tokens": 256,
                "parameter": "Precise",
                "presencePenaltyEnabled": true,
                "presence_penalty": 0.4,
                "temperature": 0.1,
                "temperatureEnabled": true,
                "topPEnabled": true,
                "top_n": 2,
                "top_p": 0.3
              },
              "label": "KeywordExtract",
              "name": "Keywords"
            },
            "dragging": false,
            "height": 86,
            "id": "KeywordExtract:BreezyGoatsRead",
            "measured": {
              "height": 86,
              "width": 200
            },
            "position": {
              "x": -12.734133905960277,
              "y": 53.63594331206494
            },
            "positionAbsolute": {
              "x": -17.690374759999543,
              "y": 80.39964392387697
            },
            "selected": false,
            "sourcePosition": "right",
            "targetPosition": "left",
            "type": "keywordNode",
            "width": 200
          },
          {
            "data": {
              "form": {
                "text": "Receives the user's financial inquiries and displays the large model's response to financial questions."
              },
              "label": "Note",
              "name": "N: Interact"
            },
            "dragHandle": ".note-drag-handle",
            "dragging": false,
            "height": 187,
            "id": "Note:FuzzyPoetsLearn",
            "measured": {
              "height": 187,
              "width": 214
            },
            "position": {
              "x": -296.5982116419186,
              "y": 38.77567426067935
            },
            "positionAbsolute": {
              "x": -296.5982116419186,
              "y": 38.77567426067935
            },
            "resizing": false,
            "selected": false,
            "sourcePosition": "right",
            "style": {
              "height": 162,
              "width": 214
            },
            "targetPosition": "left",
            "type": "noteNode",
            "width": 214
          },
          {
            "data": {
              "form": {
                "text": "Extracts keywords based on the user's financial questions for better retrieval."
              },
              "label": "Note",
              "name": "N: Keywords"
            },
            "dragHandle": ".note-drag-handle",
            "dragging": false,
            "height": 155,
            "id": "Note:FlatBagsRun",
            "measured": {
              "height": 155,
              "width": 213
            },
            "position": {
              "x": -14.82895160277127,
              "y": 186.52508153680787
            },
            "positionAbsolute": {
              "x": -14.82895160277127,
              "y": 186.52508153680787
            },
            "resizing": false,
            "selected": false,
            "sourcePosition": "right",
            "style": {
              "height": 155,
              "width": 213
            },
            "targetPosition": "left",
            "type": "noteNode",
            "width": 213
          },
          {
            "data": {
              "form": {
                "text": "Searches on akshare for the latest news about economics based on the keywords and returns the results."
              },
              "label": "Note",
              "name": "N: AKShare"
            },
            "dragHandle": ".note-drag-handle",
            "dragging": false,
            "height": 128,
            "id": "Note:WarmClothsSort",
            "measured": {
              "height": 128,
              "width": 283
            },
            "position": {
              "x": 259.53966185269985,
              "y": 209.6999260009385
            },
            "positionAbsolute": {
              "x": 573.7653319987893,
              "y": 102.64512355369035
            },
            "resizing": false,
            "selected": false,
            "sourcePosition": "right",
            "style": {
              "height": 128,
              "width": 283
            },
            "targetPosition": "left",
            "type": "noteNode",
            "width": 283
          },
          {
            "data": {
              "form": {
                "text": "Searches by Wencai to select stocks that satisfy user mentioned conditions."
              },
              "label": "Note",
              "name": "N: Wencai"
            },
            "dragHandle": ".note-drag-handle",
            "dragging": false,
            "height": 143,
            "id": "Note:TiredReadersWash",
            "measured": {
              "height": 143,
              "width": 285
            },
            "position": {
              "x": 251.25432007905098,
              "y": -97.53719402078019
            },
            "positionAbsolute": {
              "x": 571.4274792499875,
              "y": -37.07105560150117
            },
            "resizing": false,
            "selected": false,
            "sourcePosition": "right",
            "style": {
              "height": 128,
              "width": 285
            },
            "targetPosition": "left",
            "type": "noteNode",
            "width": 285
          },
          {
            "data": {
              "form": {
                "text": "The large model answers the user's medical health questions based on the searched and retrieved content."
              },
              "label": "Note",
              "name": "N: LLM"
            },
            "dragHandle": ".note-drag-handle",
            "dragging": false,
            "height": 179,
            "id": "Note:TameBoatsType",
            "measured": {
              "height": 179,
              "width": 260
            },
            "position": {
              "x": -167.45710806024056,
              "y": -372.5606558391346
            },
            "positionAbsolute": {
              "x": -7.849538042569293,
              "y": -427.90526378748035
            },
            "resizing": false,
            "selected": false,
            "sourcePosition": "right",
            "style": {
              "height": 163,
              "width": 212
            },
            "targetPosition": "left",
            "type": "noteNode",
            "width": 260
          },
          {
            "data": {
              "form": {
                "cite": true,
                "frequencyPenaltyEnabled": true,
                "frequency_penalty": 0.7,
                "llm_id": "deepseek-chat@DeepSeek",
                "maxTokensEnabled": false,
                "max_tokens": 256,
                "message_history_window_size": 1,
                "parameter": "Precise",
                "parameters": [],
                "presencePenaltyEnabled": true,
                "presence_penalty": 0.4,
                "prompt": "Role: You are a professional financial counseling assistant.\n\nTask: Answer user's question based on content provided by Wencai and AkShare.\n\nNotice:\n- Output no more than 5 news items from AkShare if there's content provided by Wencai.\n- Items from AkShare MUST have a corresponding URL link.\n\n############\nContent provided by Wencai: \n{WenCai:TenParksOpen}\n\n################\nContent provided by AkShare: \n\n{AkShare:CalmHotelsKnow}\n\n\n",
                "temperature": 0.1,
                "temperatureEnabled": true,
                "topPEnabled": true,
                "top_p": 0.3
              },
              "label": "Generate",
              "name": "LLM"
            },
            "dragging": false,
            "id": "Generate:SolidAreasRing",
            "measured": {
              "height": 106,
              "width": 200
            },
            "position": {
              "x": -161.00840949957603,
              "y": -180.04918322565015
            },
            "selected": false,
            "sourcePosition": "right",
            "targetPosition": "left",
            "type": "generateNode"
          }
        ]
      },
      "history": [],
      "messages": [],
      "path": [],
      "reference": []
    }
```

### 已有库表以及已有代码说明：

- 现在app/core/agent/component已经实现了智能体组件
- 数据库已经手动创建了表：
  1. agent\_component 组件表
  2. agent\_instance 智能体实例表，存智能体基本信息以及工作流画布dsl
  3. agent\_category 智能体分类
- app\core\agent\agent\_.py 定义了agent类，里面实现了智能体相关方法（比如初始化，运行等逻辑）

### 代码目录说明：

- app/core/agent: 智能体核心后端代码，包括智能体运行，智能体组件等
- app/core/agent/component: 智能体组件
- app/core/agent/utils: 资源文件
- app/core/agent/utils:工具类
- app/constants/agent\_constants.py: 智能体常量定义
- web/src/pages/agent：智能体相关页面文件
- web/src/assets/agent ： 智能体相关静态资源文件，子文件夹component\_icon存放组件节点头像

### 代码所属文件规定：

- agent.tsx：智能体主页
- agent\_setting.tsx: 智能体配置页
- agent\_components.tsx : 智能体列表，显示到智能体配置页左侧
- agent\_canvas.tsx: 工作流画布
- agent\_drawer: 智能体组件抽屉以及智能体运行抽屉
- 其他代码请根据实际情况写到合适的文件中
- 不要影响其他已有的功能代码

