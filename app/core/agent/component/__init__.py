#
#  Copyright 2025 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import importlib
import logging
import os
import inspect
import json
from pathlib import Path

from .generate import Generate, GenerateParam

_component_registry = {}


def _scan_components():
    """
    扫描组件目录，构建组件注册表
    
    只扫描当前项目的 agent/component 目录及其子目录
    
    Returns:
        dict: 组件名称到组件类的映射字典
    """
    registry = {}
    component_dir = Path(__file__).parent
    
    for root, dirs, files in os.walk(component_dir):
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                file_path = Path(root) / file
                
                rel_path = file_path.relative_to(component_dir)
                module_name = f"app.core.agent.component.{str(rel_path.with_suffix('')).replace(os.sep, '.')}"
                
                try:
                    module = importlib.import_module(module_name)
                    
                    for name, obj in inspect.getmembers(module, inspect.isclass):
                        if obj.__module__ == module_name:
                            component_name = getattr(obj, 'component_name', None)
                            if component_name:
                                registry[component_name] = {
                                    'class': obj,
                                    'file_path': file_path,
                                    'module_name': module_name
                                }
                except ModuleNotFoundError as e:
                    logging.warning(f"跳过模块 {module_name}: 缺少依赖模块 - {e}")
                    continue
                except Exception as e:
                    logging.warning(f"导入模块 {module_name} 失败: {str(e)}")
                    continue
    
    return registry


def _get_component_registry():
    """
    获取组件注册表，如果尚未初始化则先扫描
    
    Returns:
        dict: 组件名称到组件类的映射字典
    """
    global _component_registry
    
    if not _component_registry:
        _component_registry = _scan_components()
    
    return _component_registry


def component_class(class_name):
    """
    根据组件名称获取组件类
    
    从组件注册表中查找对应的组件类，避免重复扫描
    
    Args:
        class_name: 组件类名称
        
    Returns:
        组件类对象，如果未找到则返回None
    """
    registry = _get_component_registry()
    
    if class_name in registry:
        return registry[class_name]['class']
    
    logging.warning(f"未找到组件类: {class_name}")
    return None


def register_components():
    """
    注册组件到智能体组件表
    
    扫描core/agent/component目录及子目录下所有智能体组件类，
    根据component_name属性值和组件库中的组件对比，进行新增或更新操作
    
    Returns:
        dict: 注册结果统计信息，包含新增数量、更新数量、失败数量
    """
    from app.database.database import db
    
    component_dir = Path(__file__).parent
    registry = _get_component_registry()
    
    added_count = 0
    updated_count = 0
    failed_count = 0
    
    for component_name, info in registry.items():
        component_cls = info['class']
        file_path = info['file_path']
        
        try:
            component_title = getattr(component_cls, 'component_title', component_name)
            
            param_class_name = f"{component_name}Param"
            default_params = {}
            
            try:
                module = importlib.import_module(info['module_name'])
                if hasattr(module, param_class_name):
                    obj = getattr(module, param_class_name)
                    if inspect.isclass(obj):
                        try:
                            param_instance = obj()
                            if hasattr(param_instance, 'as_dict') and callable(getattr(param_instance, 'as_dict')):
                                default_params = param_instance.as_dict()
                        except Exception as e:
                            logging.debug(f"实例化 {param_class_name} 失败: {str(e)}")
            except Exception as e:
                logging.debug(f"获取参数类 {param_class_name} 失败: {str(e)}")
            
            rel_path = file_path.relative_to(component_dir)
            if str(rel_path).startswith('builtin'):
                category = "基础组件"
            elif str(rel_path).startswith('custom'):
                category = "自定义组件"
            else:
                category = "default"
            
            cursor = db.execute_sql(
                "SELECT id, component_title FROM agent_component WHERE component_name = %s AND deleted = 0",
                (component_name,)
            )
            existing = cursor.fetchone()
            
            if existing:
                update_fields = []
                params = []
                
                if not existing[1] and component_title:
                    update_fields.append("component_title = %s")
                    params.append(component_title)
                
                update_fields.append("default_params = %s")
                params.append(json.dumps(default_params, ensure_ascii=False))
                
                if update_fields:
                    params.append(existing[0])
                    sql = f"UPDATE agent_component SET {', '.join(update_fields)} WHERE id = %s"
                    db.execute_sql(sql, tuple(params))
                    updated_count += 1
                    logging.info(f"更新组件: {component_name}")
            else:
                cursor = db.execute_sql(
                    "SELECT MAX(sort_order) FROM agent_component WHERE category = %s AND deleted = 0",
                    (category,)
                )
                max_sort = cursor.fetchone()[0]
                sort_order = (max_sort + 1) if max_sort else 1
                
                db.execute_sql(
                    "INSERT INTO agent_component (component_name, component_title, default_params, status, category, sort_order) VALUES (%s, %s, %s, %s, %s, %s)",
                    (component_name, component_title, json.dumps(default_params, ensure_ascii=False), 1, category, sort_order)
                )
                added_count += 1
                logging.info(f"新增组件: {component_name}, 分类: {category}, 排序: {sort_order}")
                
        except Exception as e:
            failed_count += 1
            logging.error(f"处理组件 {component_name} 失败: {str(e)}", exc_info=True)
            continue
    
    result = {
        "added": added_count,
        "updated": updated_count,
        "failed": failed_count,
        "total": len(registry)
    }
    
    logging.info(f"组件注册完成: 新增 {added_count} 个，更新 {updated_count} 个，失败 {failed_count} 个，总共 {len(registry)} 个")
    
    return result


__all__ = [
    "component_class",
    "register_components",
    "Generate",
    "GenerateParam",
]