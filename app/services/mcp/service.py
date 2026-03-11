"""
MCP服务类，提供MCP相关的CRUD操作
"""

import json
from datetime import datetime
from app.database.models import MCPCategory, MCPServer, MCPTool
from app.services.mcp.dto import MCPCategoryCreate, MCPCategoryUpdate, MCPServerCreate, MCPServerUpdate, MCPToolCreate, MCPToolUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError, DuplicateResourceError
from app.constants.mcp_constants import SOURCE_TYPE, TRANSPORT_TYPE, DEFAULT_LOCAL_MCP_CONFIG


class MCPCategoryService:
    """
    MCP分类服务类
    
    提供MCP分类的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def _get_or_create_default_category():
        """
        获取或创建默认分类
        
        Returns:
            MCPCategory: 默认分类对象
        """
        default_category = MCPCategory.select().where(MCPCategory.name == "默认分类").first()
        if not default_category:
            default_category = MCPCategory(
                name="默认分类",
                description="系统默认分类"
            )
            default_category.save(force_insert=True)
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: MCPCategoryCreate):
        """
        创建MCP分类
        
        Args:
            category: MCP分类创建DTO
            
        Returns:
            MCPCategory: 创建的MCP分类对象
            
        Raises:
            DuplicateResourceError: 同一父分类下名称已存在
        """
        parent_id = category.parent_id
        
        existing = MCPCategory.select().where(
            (MCPCategory.name == category.name) &
            (MCPCategory.parent_id == parent_id if parent_id else MCPCategory.parent_id.is_null()) &
            (MCPCategory.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"分类名称 '{category.name}' 已存在")
        
        db_category = MCPCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100):
        """
        获取MCP分类列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            
        Returns:
            List[MCPCategory]: MCP分类列表
        """
        return list(MCPCategory.select().where(MCPCategory.deleted == False).offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """
        获取MCP分类树形结构
        
        Returns:
            List[dict]: 分类树形结构
        """
        categories = list(MCPCategory.select().where(MCPCategory.deleted == False).order_by(MCPCategory.sort_order))
        
        def build_tree(parent_id=None):
            tree = []
            for cat in categories:
                if cat.parent_id == parent_id:
                    node = {
                        "id": str(cat.id),
                        "name": cat.name,
                        "description": cat.description,
                        "parent_id": str(cat.parent_id) if cat.parent_id else None,
                        "sort_order": cat.sort_order,
                        "children": build_tree(cat.id)
                    }
                    tree.append(node)
            return tree
        
        return build_tree()
    
    @staticmethod
    def get_category(category_id: str):
        """
        获取单个MCP分类
        
        Args:
            category_id: MCP分类ID
            
        Returns:
            MCPCategory: MCP分类对象，不存在则返回None
        """
        try:
            category = MCPCategory.get_by_id(category_id)
            if category.deleted:
                return None
            return category
        except MCPCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: MCPCategoryUpdate):
        """
        更新MCP分类
        
        Args:
            category_id: MCP分类ID
            category: MCP分类更新DTO
            
        Returns:
            MCPCategory: 更新后的MCP分类对象
            
        Raises:
            ResourceNotFoundError: MCP分类不存在
            DuplicateResourceError: 同一父分类下名称已存在
        """
        try:
            db_category = MCPCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"MCP分类 {category_id} 不存在")
        except MCPCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP分类 {category_id} 不存在")
        
        update_data = category.model_dump(exclude_unset=True)
        
        if 'name' in update_data:
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = MCPCategory.select().where(
                (MCPCategory.name == update_data['name']) &
                (MCPCategory.parent_id == parent_id if parent_id else MCPCategory.parent_id.is_null()) &
                (MCPCategory.id != category_id) &
                (MCPCategory.deleted == False)
            ).first()
            
            if existing:
                raise DuplicateResourceError(f"分类名称 '{update_data['name']}' 已存在")
        
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """
        删除MCP分类（逻辑删除）
        
        Args:
            category_id: MCP分类ID
            
        Returns:
            MCPCategory: 被删除的MCP分类对象
            
        Raises:
            ResourceNotFoundError: MCP分类不存在
        """
        try:
            db_category = MCPCategory.get_by_id(category_id)
            if db_category.deleted:
                raise ResourceNotFoundError(message=f"MCP分类 {category_id} 不存在")
        except MCPCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP分类 {category_id} 不存在")
        
        db_category.deleted = True
        db_category.deleted_at = datetime.now()
        db_category.save()
        return db_category


class MCPServerService:
    """
    MCP服务类
    
    提供MCP服务的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    def get_source_types():
        """
        获取MCP服务来源类型
        
        Returns:
            dict: 来源类型字典
        """
        return SOURCE_TYPE
    
    @staticmethod
    def get_transport_types():
        """
        获取MCP服务传输类型
        
        Returns:
            dict: 传输类型字典
        """
        return TRANSPORT_TYPE
    
    @staticmethod
    def get_local_mcp_config():
        """
        获取本地MCP服务配置
        
        Returns:
            dict: 本地MCP配置，包含host、port和transport_type
        """
        return DEFAULT_LOCAL_MCP_CONFIG
    
    @staticmethod
    @handle_transaction
    def create_server(server: MCPServerCreate):
        """
        创建MCP服务
        
        Args:
            server: MCP服务创建DTO
            
        Returns:
            MCPServer: 创建的MCP服务对象
            
        Raises:
            DuplicateResourceError: 编码已存在
        """
        server_data = server.model_dump()
        
        if not server_data.get('category_id'):
            default_category = MCPCategoryService._get_or_create_default_category()
            server_data['category_id'] = default_category.id
        
        existing = MCPServer.select().where(
            (MCPServer.code == server_data['code']) &
            (MCPServer.deleted == False)
        ).first()
        
        if existing:
            raise DuplicateResourceError(f"MCP服务编码 '{server_data['code']}' 已存在")
        
        if server_data.get('source_type') == 'local':
            server_data['transport_type'] = 'streamable_http'
            host = DEFAULT_LOCAL_MCP_CONFIG['host']
            port = DEFAULT_LOCAL_MCP_CONFIG['port']
            server_data['url'] = f"http://{host}:{port}/mcp"
        
        db_server = MCPServer(**server_data)
        db_server.save(force_insert=True)
        return db_server
    
    @staticmethod
    def get_servers(skip: int = 0, limit: int = 100, category_id: str = None, name: str = None, source_type: str = None, code: str = None):
        """
        获取MCP服务列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            category_id: 分类ID（可选）
            name: 服务名称（模糊查询）
            source_type: 来源类型
            code: 服务编码（模糊查询）
            
        Returns:
            List[MCPServer]: MCP服务列表
        """
        query = MCPServer.select().where(MCPServer.deleted == False)
        
        if category_id:
            query = query.where(MCPServer.category_id == category_id)
        
        if name:
            query = query.where(MCPServer.name.contains(name))
        
        if source_type:
            query = query.where(MCPServer.source_type == source_type)
        
        if code:
            query = query.where(MCPServer.code.contains(code))
        
        return list(query.order_by(MCPServer.created_at.desc()).offset(skip).limit(limit))
    
    @staticmethod
    def count_servers(category_id: str = None, name: str = None, source_type: str = None, code: str = None) -> int:
        """
        统计MCP服务总数
        
        Args:
            category_id: 分类ID（可选）
            name: 服务名称（模糊查询）
            source_type: 来源类型
            code: 服务编码（模糊查询）
            
        Returns:
            int: MCP服务总数
        """
        query = MCPServer.select().where(MCPServer.deleted == False)
        
        if category_id:
            query = query.where(MCPServer.category_id == category_id)
        
        if name:
            query = query.where(MCPServer.name.contains(name))
        
        if source_type:
            query = query.where(MCPServer.source_type == source_type)
        
        if code:
            query = query.where(MCPServer.code.contains(code))
        
        return query.count()
    
    @staticmethod
    def get_server(server_id: str):
        """
        获取单个MCP服务
        
        Args:
            server_id: MCP服务ID
            
        Returns:
            MCPServer: MCP服务对象，不存在则返回None
        """
        try:
            server = MCPServer.get_by_id(server_id)
            if server.deleted:
                return None
            return server
        except MCPServer.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_server(server_id: str, server: MCPServerUpdate):
        """
        更新MCP服务
        
        Args:
            server_id: MCP服务ID
            server: MCP服务更新DTO
            
        Returns:
            MCPServer: 更新后的MCP服务对象
            
        Raises:
            ResourceNotFoundError: MCP服务不存在
            DuplicateResourceError: 编码已存在
        """
        try:
            db_server = MCPServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        except MCPServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        
        update_data = server.model_dump(exclude_unset=True)
        
        if 'code' in update_data:
            existing = MCPServer.select().where(
                (MCPServer.code == update_data['code']) &
                (MCPServer.id != server_id) &
                (MCPServer.deleted == False)
            ).first()
            
            if existing:
                raise DuplicateResourceError(f"MCP服务编码 '{update_data['code']}' 已存在")
        
        if update_data.get('source_type') == 'local':
            update_data['transport_type'] = 'streamable_http'
            host = DEFAULT_LOCAL_MCP_CONFIG['host']
            port = DEFAULT_LOCAL_MCP_CONFIG['port']
            update_data['url'] = f"http://{host}:{port}/mcp"
        
        for field, value in update_data.items():
            setattr(db_server, field, value)
        db_server.updated_at = datetime.now()
        db_server.save()
        return db_server
    
    @staticmethod
    @handle_transaction
    def delete_server(server_id: str):
        """
        删除MCP服务（逻辑删除）
        
        Args:
            server_id: MCP服务ID
            
        Returns:
            MCPServer: 被删除的MCP服务对象
            
        Raises:
            ResourceNotFoundError: MCP服务不存在
        """
        try:
            db_server = MCPServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        except MCPServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        
        db_server.deleted = True
        db_server.deleted_at = datetime.now()
        db_server.save()
        return db_server
    
    @staticmethod
    @handle_transaction
    def import_tools(server_id: str, tools: list):
        """
        导入MCP工具
        
        Args:
            server_id: MCP服务ID
            tools: 工具列表
            
        Returns:
            List[MCPTool]: 导入的工具列表
            
        Raises:
            ResourceNotFoundError: MCP服务不存在
        """
        try:
            db_server = MCPServer.get_by_id(server_id)
            if db_server.deleted:
                raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        except MCPServer.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP服务 {server_id} 不存在")
        
        imported_tools = []
        for tool_data in tools:
            existing_tool = MCPTool.select().where(
                (MCPTool.name == tool_data.get('name')) &
                (MCPTool.server_id == server_id) &
                (MCPTool.deleted == False)
            ).first()
            
            if existing_tool:
                for field, value in tool_data.items():
                    if field != 'name':
                        setattr(existing_tool, field, value)
                existing_tool.updated_at = datetime.now()
                existing_tool.save()
                imported_tools.append(existing_tool)
            else:
                tool_data['server_id'] = server_id
                new_tool = MCPTool(**tool_data)
                new_tool.save(force_insert=True)
                imported_tools.append(new_tool)
        
        return imported_tools


class MCPToolService:
    """
    MCP工具服务类
    
    提供MCP工具的创建、查询、更新、删除等操作
    """
    
    @staticmethod
    @handle_transaction
    def create_tool(tool: MCPToolCreate):
        """
        创建MCP工具
        
        Args:
            tool: MCP工具创建DTO
            
        Returns:
            MCPTool: 创建的MCP工具对象
        """
        db_tool = MCPTool(**tool.model_dump())
        db_tool.save(force_insert=True)
        return db_tool
    
    @staticmethod
    def get_tools(skip: int = 0, limit: int = 100, server_id: str = None):
        """
        获取MCP工具列表
        
        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数
            server_id: MCP服务ID，可选
            
        Returns:
            List[MCPTool]: MCP工具列表
        """
        query = MCPTool.select().where(MCPTool.deleted == False)
        if server_id:
            query = query.where(MCPTool.server_id == server_id)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_tool(tool_id: str):
        """
        获取单个MCP工具
        
        Args:
            tool_id: MCP工具ID
            
        Returns:
            MCPTool: MCP工具对象，不存在则返回None
        """
        try:
            tool = MCPTool.get_by_id(tool_id)
            if tool.deleted:
                return None
            return tool
        except MCPTool.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_tool(tool_id: str, tool: MCPToolUpdate):
        """
        更新MCP工具
        
        Args:
            tool_id: MCP工具ID
            tool: MCP工具更新DTO
            
        Returns:
            MCPTool: 更新后的MCP工具对象
            
        Raises:
            ResourceNotFoundError: MCP工具不存在
        """
        try:
            db_tool = MCPTool.get_by_id(tool_id)
            if db_tool.deleted:
                raise ResourceNotFoundError(message=f"MCP工具 {tool_id} 不存在")
        except MCPTool.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP工具 {tool_id} 不存在")
        
        update_data = tool.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_tool, field, value)
        db_tool.updated_at = datetime.now()
        db_tool.save()
        return db_tool
    
    @staticmethod
    @handle_transaction
    def delete_tool(tool_id: str):
        """
        删除MCP工具（逻辑删除）
        
        Args:
            tool_id: MCP工具ID
            
        Returns:
            MCPTool: 被删除的MCP工具对象
            
        Raises:
            ResourceNotFoundError: MCP工具不存在
        """
        try:
            db_tool = MCPTool.get_by_id(tool_id)
            if db_tool.deleted:
                raise ResourceNotFoundError(message=f"MCP工具 {tool_id} 不存在")
        except MCPTool.DoesNotExist:
            raise ResourceNotFoundError(message=f"MCP工具 {tool_id} 不存在")
        
        db_tool.deleted = True
        db_tool.deleted_at = datetime.now()
        db_tool.save()
        return db_tool
