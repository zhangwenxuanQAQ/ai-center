from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.knowledge.service import KnowledgeService
from app.core.knowledge.dto import KnowledgeCreate, KnowledgeUpdate, Knowledge as KnowledgeSchema

router = APIRouter()

@router.post("", response_model=KnowledgeSchema)
def create_knowledge(knowledge: KnowledgeCreate, db = Depends(get_db)):
    return KnowledgeService.create_knowledge(db, knowledge)

@router.get("", response_model=List[KnowledgeSchema])
def get_knowledges(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return KnowledgeService.get_knowledges(db, skip, limit)

@router.get("/{knowledge_id}", response_model=KnowledgeSchema)
def get_knowledge(knowledge_id: int, db = Depends(get_db)):
    knowledge = KnowledgeService.get_knowledge(db, knowledge_id)
    if knowledge is None:
        raise HTTPException(status_code=404, detail="Knowledge not found")
    return knowledge

@router.put("/{knowledge_id}", response_model=KnowledgeSchema)
def update_knowledge(knowledge_id: int, knowledge: KnowledgeUpdate, db = Depends(get_db)):
    return KnowledgeService.update_knowledge(db, knowledge_id, knowledge)

@router.delete("/{knowledge_id}")
def delete_knowledge(knowledge_id: int, db = Depends(get_db)):
    return KnowledgeService.delete_knowledge(db, knowledge_id)