"""
数据源服务类，提供数据源相关的CRUD操作
"""

import json
from datetime import datetime
from app.database.models import Datasource, DatasourceCategory
from app.services.datasource.dto import DatasourceCreate, DatasourceUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.datasource_constants import (
    DATASOURCE_TYPE_LABELS, DATASOURCE_CONFIG_FIELDS, DATASOURCE_TYPE_CATEGORY
)
from app.utils.crypto_util import encrypt_password, decrypt_password
from app.core.datasource.factory import DatasourceFactory


class DatasourceService:
    """
    数据源服务类
    
    提供数据源的创建、查询、更新、删除等操作
    包括测试连接和数据查询功能
    """
    
    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类
        
        Returns:
            DatasourceCategory: 默认分类对象
        """
        default_category = DatasourceCategory.select().where(DatasourceCategory.is_default == True).first()
        if not default_category:
            default_category = DatasourceCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        return default_category
    
    @staticmethod
    def get_datasource_types():
        """
        获取支持的数据源类型
        
        Returns:
            dict: 数据源类型字典
        """
        return DATASOURCE_TYPE_LABELS
    
    @staticmethod
    def get_datasource_config_fields(datasource_type: str):
        """
        获取指定数据源类型的配置参数字段
        
        Args:
            datasource_type: 数据源类型
            
        Returns:
            list: 配置参数字段列表
        """
        return DATASOURCE_CONFIG_FIELDS.get(datasource_type, [])
    
    @staticmethod
    def get_datasource_types_with_config():
        """
        获取所有数据源类型及其配置参数
        
        Returns:
            list: 数据源配置列表
        """
        configs = []
        for datasource_type in DATASOURCE_TYPE_LABELS.keys():
            config_fields = DatasourceService.get_datasource_config_fields(datasource_type)
            config_item = {
                "datasource_type": datasource_type,
                "datasource_name": DATASOURCE_TYPE_LABELS[datasource_type],
                "config_fields": config_fields,
                "category": DATASOURCE_TYPE_CATEGORY.get(datasource_type)
            }
            configs.append(config_item)
        return configs
    
    @staticmethod
    def _encrypt_sensitive_config(config: dict, datasource_type: str) -> dict:
        """
        加密配置中的敏感字段（密码）
        
        Args:
            config: 数据源配置
            datasource_type: 数据源类型
            
        Returns:
            dict: 加密后的配置
        """
        if not config:
            return config
        
        config_fields = DATASOURCE_CONFIG_FIELDS.get(datasource_type, [])
        encrypted_config = config.copy()
        
        for field in config_fields:
            if field.get('sensitive') and field.get('name') in encrypted_config:
                field_name = field['name']
                field_value = encrypted_config[field_name]
                if field_value:
                    # 检查是否已经被加密（Fernet加密后的文本以gAAAA开头）
                    if isinstance(field_value, str) and field_value.startswith('gAAAA'):
                        # 已经被加密，不再重复加密
                        continue
                    encrypted_config[field_name] = encrypt_password(field_value)
        
        return encrypted_config
    
    @staticmethod
    def _decrypt_sensitive_config(config: dict, datasource_type: str) -> dict:
        """
        解密配置中的敏感字段（密码），用于内部使用，不返回给前端
        
        Args:
            config: 数据源配置
            datasource_type: 数据源类型
            
        Returns:
            dict: 解密后的配置
        """
        if not config:
            return config
        
        def decrypt_until_plain(encrypted_value: str, max_attempts: int = 10) -> str:
            """递归解密直到得到明文"""
            if not isinstance(encrypted_value, str) or not encrypted_value.startswith('gAAAA'):
                return encrypted_value
            
            current_value = encrypted_value
            attempts = 0
            
            while current_value.startswith('gAAAA') and attempts < max_attempts:
                try:
                    decrypted = decrypt_password(current_value)
                    if decrypted == current_value:
                        # 解密失败，返回当前值
                        break
                    current_value = decrypted
                    attempts += 1
                except Exception:
                    break
            
            return current_value
        
        config_fields = DATASOURCE_CONFIG_FIELDS.get(datasource_type, [])
        decrypted_config = config.copy()
        
        for field in config_fields:
            if field.get('sensitive') and field.get('name') in decrypted_config:
                field_name = field['name']
                field_value = decrypted_config[field_name]
                if field_value:
                    # 递归解密直到得到明文
                    decrypted_config[field_name] = decrypt_until_plain(field_value)
        
        return decrypted_config
    
    @staticmethod
    @handle_transaction
    def create_datasource(datasource: DatasourceCreate):
        """
        创建数据源
        
        Args:
            datasource: 数据源创建DTO
            
        Returns:
            Datasource: 创建的数据源对象
            
        Raises:
            DuplicateResourceError: 编码已存在
        """
        try:
            datasource_data = datasource.model_dump()
            
            if not datasource_data.get('category_id'):
                default_category = DatasourceService._get_or_create_default_category()
                datasource_data['category_id'] = default_category.id
            
            code = datasource_data.get('code')
            if code:
                existing_datasource = Datasource.select().where(
                    (Datasource.code == code) & (Datasource.deleted == False)
                ).first()
                if existing_datasource:
                    raise DuplicateResourceError("编码已存在")
            
            datasource_type = datasource_data.get('type')
            config = datasource_data.get('config')
            if config:
                datasource_data['config'] = json.dumps(
                    DatasourceService._encrypt_sensitive_config(config, datasource_type)
                )
            
            db_datasource = Datasource(**datasource_data)
            db_datasource.save(force_insert=True)
            return db_datasource
        except Exception as e:
            raise
    
    @staticmethod
    def get_datasources(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, code: str = None, datasource_type: str = None):
        """
        获取数据源列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 数据源名称（模糊查询）
            code: 数据源编码（模糊查询）
            datasource_type: 数据源类型
            
        Returns:
            tuple: (数据源列表, 总记录数)
        """
        try:
            query = Datasource.select().where(Datasource.deleted == False)
            
            if category_id:
                query = query.where(Datasource.category_id == category_id)
            
            if name:
                query = query.where(Datasource.name.contains(name))
            
            if code:
                query = query.where(Datasource.code.contains(code))
            
            if datasource_type:
                query = query.where(Datasource.type == datasource_type)
            
            total = query.count()
            query = query.order_by(Datasource.created_at.desc())
            datasources = list(query.offset(skip).limit(limit))
            result = []
            for ds in datasources:
                config_dict = {}
                if ds.config:
                    try:
                        config_dict = json.loads(ds.config)
                    except Exception:
                        pass
                ds_dict = {
                    "id": str(ds.id),
                    "name": ds.name,
                    "code": ds.code,
                    "type": ds.type,
                    "category_id": str(ds.category_id).replace('-', '') if ds.category_id else None,
                    "config": config_dict,
                    "status": ds.status,
                    "created_at": ds.created_at,
                    "updated_at": ds.updated_at,
                }
                result.append(ds_dict)
            return result, total
        except Exception as e:
            return [], 0
    
    @staticmethod
    def get_datasource(datasource_id: str):
        """
        获取单个数据源
        
        Args:
            datasource_id: 数据源ID
            
        Returns:
            dict: 数据源对象，不存在或已删除则返回None
        """
        try:
            datasource = Datasource.get_by_id(datasource_id)
            if datasource.deleted:
                return None
        except Datasource.DoesNotExist:
            return None
        
        config_dict = {}
        if datasource.config:
            try:
                config_dict = json.loads(datasource.config)
            except Exception:
                pass
        
        return {
            "id": str(datasource.id),
            "name": datasource.name,
            "code": datasource.code,
            "type": datasource.type,
            "category_id": str(datasource.category_id).replace('-', '') if datasource.category_id else None,
            "config": config_dict,
            "status": datasource.status,
            "created_at": datasource.created_at,
            "updated_at": datasource.updated_at,
        }
    
    @staticmethod
    @handle_transaction
    def update_datasource(datasource_id: str, datasource: DatasourceUpdate):
        """
        更新数据源
        
        Args:
            datasource_id: 数据源ID
            datasource: 数据源更新DTO
            
        Returns:
            Datasource: 更新后的数据源对象
            
        Raises:
            ResourceNotFoundError: 数据源不存在
            Exception: 编码已存在
        """
        try:
            try:
                db_datasource = Datasource.get_by_id(datasource_id)
            except Datasource.DoesNotExist:
                raise ResourceNotFoundError(
                    message=f"数据源 {datasource_id} 不存在"
                )
            
            update_data = datasource.model_dump(exclude_unset=True)
            
            if 'code' in update_data:
                code = update_data['code']
                existing_datasource = Datasource.select().where(
                    (Datasource.code == code) & (Datasource.id != datasource_id) & (Datasource.deleted == False)
                ).first()
                if existing_datasource:
                    raise DuplicateResourceError("编码已存在")
            
            if 'config' in update_data:
                config = update_data.get('config')
                datasource_type = update_data.get('type') or db_datasource.type
                if config:
                    update_data['config'] = json.dumps(
                        DatasourceService._encrypt_sensitive_config(config, datasource_type)
                    )
            
            if update_data:
                for field, value in update_data.items():
                    setattr(db_datasource, field, value)
                db_datasource.updated_at = datetime.now()
                db_datasource.save()
            
            return db_datasource
        except Exception as e:
            raise
    
    @staticmethod
    @handle_transaction
    def delete_datasource(datasource_id: str, deleted_user_id: str = None):
        """
        删除数据源（逻辑删除）
        
        Args:
            datasource_id: 数据源ID
            deleted_user_id: 删除用户ID
            
        Returns:
            Datasource: 被删除的数据源对象
            
        Raises:
            ResourceNotFoundError: 数据源不存在
        """
        try:
            try:
                db_datasource = Datasource.get_by_id(datasource_id)
            except Datasource.DoesNotExist:
                raise ResourceNotFoundError(
                    message=f"数据源 {datasource_id} 不存在"
                )
            
            deleted_datasource = db_datasource
            db_datasource.deleted = True
            db_datasource.deleted_at = datetime.now()
            if deleted_user_id:
                db_datasource.deleted_user_id = deleted_user_id
            db_datasource.save()
            
            return deleted_datasource
        except Exception as e:
            raise
    
    @staticmethod
    def test_connection_with_data(data: dict):
        """
        测试数据源连接（用于新建数据源时）
        
        Args:
            data: 数据源测试数据
            
        Returns:
            dict: 连接测试结果
        """
        datasource_type = data.get('type')
        if not datasource_type:
            return {"success": False, "message": "数据源类型不能为空"}
        
        config = data.get('config', {})
        
        # 解密配置中的敏感字段（密码）
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.test_connection()
        except Exception as e:
            return {"success": False, "message": f"测试连接失败: {str(e)}"}

    @staticmethod
    def test_connection(datasource_id: str):
        """
        测试数据源连接
        
        Args:
            datasource_id: 数据源ID
            
        Returns:
            dict: 连接测试结果
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.test_connection()
        except Exception as e:
            return {"success": False, "message": f"测试连接失败: {str(e)}"}
    
    @staticmethod
    def execute_query(datasource_id: str, query: str, params: dict = None):
        """
        执行数据源查询
        
        Args:
            datasource_id: 数据源ID
            query: 查询语句
            params: 查询参数
            
        Returns:
            dict: 查询结果
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.execute_query(query, params)
        except Exception as e:
            return {"success": False, "message": f"查询执行失败: {str(e)}"}
    
    @staticmethod
    def get_schema_info(datasource_id: str):
        """
        获取数据源Schema信息
        
        Args:
            datasource_id: 数据源ID
            
        Returns:
            dict: Schema信息
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.get_schema_info()
        except Exception as e:
            return {"success": False, "message": f"获取Schema信息失败: {str(e)}"}
    
    @staticmethod
    def list_files(datasource_id: str, bucket: str = None, prefix: str = None, max_keys: int = 100, search_keyword: str = None):
        """
        列出文件（仅适用于文件存储类型数据源）
        
        Args:
            datasource_id: 数据源ID
            bucket: Bucket名称（可选）
            prefix: 文件前缀/目录（可选）
            max_keys: 最大返回数量
            search_keyword: 搜索关键词（可选）
            
        Returns:
            dict: 文件列表
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.list_files(bucket=bucket, prefix=prefix, max_keys=max_keys, search_keyword=search_keyword)
        except Exception as e:
            return {"success": False, "message": f"获取文件列表失败: {str(e)}"}
    
    @staticmethod
    def download_file(datasource_id: str, bucket: str = None, object_name: str = ""):
        """
        下载文件（仅适用于文件存储类型数据源）
        
        Args:
            datasource_id: 数据源ID
            bucket: Bucket名称（可选）
            object_name: 对象名称/文件路径
            
        Returns:
            dict: 文件内容
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.download_file(bucket=bucket, object_name=object_name)
        except Exception as e:
            return {"success": False, "message": f"下载文件失败: {str(e)}"}
    
    @staticmethod
    def list_tables(datasource_id: str, database: str = None):
        """
        列出数据库表（仅适用于关系型数据库数据源）
        
        Args:
            datasource_id: 数据源ID
            database: 数据库名称（可选）
            
        Returns:
            dict: 表列表
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.list_tables(database=database)
        except Exception as e:
            return {"success": False, "message": f"获取表列表失败: {str(e)}"}
    
    @staticmethod
    def get_table_columns(datasource_id: str, table_name: str, database: str = None):
        """
        获取表的字段信息（仅适用于关系型数据库数据源）
        
        Args:
            datasource_id: 数据源ID
            table_name: 表名称
            database: 数据库名称（可选）
            
        Returns:
            dict: 字段信息
        """
        datasource = DatasourceService.get_datasource(datasource_id)
        if not datasource:
            return {"success": False, "message": "数据源不存在"}
        
        datasource_type = datasource.get('type')
        config = datasource.get('config', {})
        
        decrypted_config = DatasourceService._decrypt_sensitive_config(config, datasource_type)
        
        try:
            ds_instance = DatasourceFactory.create(datasource_type, decrypted_config)
            return ds_instance.get_table_columns(table_name=table_name, database=database)
        except Exception as e:
            return {"success": False, "message": f"获取表字段信息失败: {str(e)}"}
