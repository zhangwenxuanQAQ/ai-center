"""
SKILL分类服务类
"""

from datetime import datetime
from app.database.models import SkillCategory, Skill
from app.services.skill_category.dto import SkillCategoryCreate, SkillCategoryUpdate
from app.database.db_utils import handle_transaction
from app.core.exceptions import ResourceNotFoundError


class SkillCategoryService:
    """SKILL分类服务类"""
    
    @staticmethod
    def get_default_category():
        """获取默认分类，如果不存在则创建"""
        default_category = SkillCategory.select().where(SkillCategory.is_default == True).first()
        if not default_category:
            default_category = SkillCategory(
                name="默认分类",
                description="系统默认分类",
                is_default=True
            )
            default_category.save(force_insert=True)
        return default_category
    
    @staticmethod
    @handle_transaction
    def create_category(category: SkillCategoryCreate):
        """创建SKILL分类"""
        existing = SkillCategory.select().where(
            SkillCategory.name == category.name,
            SkillCategory.parent_id == category.parent_id,
            SkillCategory.deleted == False
        ).first()
        if existing:
            raise ValueError(f"同一父分类下已存在名为 '{category.name}' 的分类")
        
        db_category = SkillCategory(**category.model_dump())
        db_category.save(force_insert=True)
        return db_category
    
    @staticmethod
    def get_categories(skip: int = 0, limit: int = 100, parent_id: str = None):
        """获取SKILL分类列表"""
        query = SkillCategory.select().where(SkillCategory.deleted == False).order_by(SkillCategory.sort_order.asc())
        if parent_id is not None:
            query = query.where(SkillCategory.parent_id == parent_id)
        return list(query.offset(skip).limit(limit))
    
    @staticmethod
    def get_category_tree():
        """获取分类树结构"""
        all_categories = list(SkillCategory.select().where(
            SkillCategory.deleted == False
        ).order_by(SkillCategory.sort_order.asc()))
        
        def remove_hyphens(id_str):
            return str(id_str).replace('-', '')
        
        node_map = {}
        for category in all_categories:
            node_id = remove_hyphens(category.id)
            parent_id = remove_hyphens(category.parent_id) if category.parent_id else None
            node_map[node_id] = {
                'id': node_id,
                'name': category.name,
                'description': category.description,
                'is_default': category.is_default,
                'parent_id': parent_id,
                'sort_order': category.sort_order,
                'children': []
            }
        
        tree = []
        for category in all_categories:
            node_id = remove_hyphens(category.id)
            node = node_map[node_id]
            if not category.parent_id:
                tree.append(node)
            else:
                try:
                    parent_id = remove_hyphens(str(category.parent_id))
                    if parent_id in node_map:
                        node_map[parent_id]['children'].append(node)
                except Exception:
                    pass
        
        def sort_tree(nodes):
            nodes.sort(key=lambda x: x['sort_order'])
            for node in nodes:
                if node['children']:
                    sort_tree(node['children'])
        
        sort_tree(tree)
        return tree
    
    @staticmethod
    @handle_transaction
    def update_category_order(category_id: str, new_order: int):
        """更新分类排序"""
        try:
            db_category = SkillCategory.get_by_id(category_id)
        except SkillCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"SKILL分类 {category_id} 不存在")
        db_category.sort_order = new_order
        db_category.save()
        return db_category
    
    @staticmethod
    def get_category(category_id: str):
        """获取单个SKILL分类"""
        try:
            return SkillCategory.get_by_id(category_id)
        except SkillCategory.DoesNotExist:
            return None
    
    @staticmethod
    @handle_transaction
    def update_category(category_id: str, category: SkillCategoryUpdate):
        """更新SKILL分类"""
        try:
            db_category = SkillCategory.get_by_id(category_id)
        except SkillCategory.DoesNotExist:
            raise ResourceNotFoundError(message=f"SKILL分类 {category_id} 不存在")
        
        update_data = category.model_dump(exclude_unset=True)
        
        if 'name' in update_data or 'parent_id' in update_data:
            name = update_data.get('name', db_category.name)
            parent_id = update_data.get('parent_id', db_category.parent_id)
            existing = SkillCategory.select().where(
                SkillCategory.name == name,
                SkillCategory.parent_id == parent_id,
                SkillCategory.id != category_id
            ).first()
            if existing:
                raise ValueError(f"同一父分类下已存在名为 '{name}' 的分类")
        
        for field, value in update_data.items():
            setattr(db_category, field, value)
        db_category.updated_at = datetime.now()
        db_category.save()
        return db_category
    
    @staticmethod
    @handle_transaction
    def delete_category(category_id: str):
        """删除SKILL分类（软删除）"""
        try:
            db_category = SkillCategory.get_by_id(category_id)
        except:
            raise ResourceNotFoundError(
                resource_type="SKILL分类",
                resource_id=category_id,
                message=f"SKILL分类 {category_id} 不存在"
            )
        
        if db_category.is_default:
            raise ValueError("不能删除默认分类")
        
        skills_in_category = Skill.select().where(
            (Skill.category_id == category_id) & (Skill.deleted == False)
        ).count()
        if skills_in_category > 0:
            raise ValueError(f"该分类下存在 {skills_in_category} 个SKILL，无法删除")
        
        def check_subcategories(parent_id):
            subcategories = SkillCategory.select().where(
                (SkillCategory.parent_id == parent_id) & (SkillCategory.deleted == False)
            )
            for sub in subcategories:
                count = Skill.select().where(
                    (Skill.category_id == sub.id) & (Skill.deleted == False)
                ).count()
                if count > 0:
                    raise ValueError(f"子分类 '{sub.name}' 下存在 {count} 个SKILL，无法删除")
                check_subcategories(sub.id)
        
        check_subcategories(category_id)
        db_category.delete_instance()
        return db_category
