from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import Knowledge
from app.core.knowledge.dto import KnowledgeCreate, KnowledgeUpdate, Knowledge as KnowledgeSchema

router = APIRouter()

@router.post("", response_model=KnowledgeSchema)
def create_knowledge(knowledge: KnowledgeCreate, db: Session = Depends(get_db)):
    db_knowledge = Knowledge(**knowledge.model_dump())
    db.add(db_knowledge)
    db.commit()
    db.refresh(db_knowledge)
    return db_knowledge

@router.get("", response_model=List[KnowledgeSchema])
def get_knowledges(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    knowledges = db.query(Knowledge).offset(skip).limit(limit).all()
    return knowledges

@router.get("/{knowledge_id}", response_model=KnowledgeSchema)
def get_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if knowledge is None:
        raise HTTPException(status_code=404, detail="Knowledge not found")
    return knowledge

@router.put("/{knowledge_id}", response_model=KnowledgeSchema)
def update_knowledge(knowledge_id: int, knowledge: KnowledgeUpdate, db: Session = Depends(get_db)):
    db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if db_knowledge is None:
        raise HTTPException(status_code=404, detail="Knowledge not found")
    
    update_data = knowledge.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_knowledge, field, value)
    
    db.commit()
    db.refresh(db_knowledge)
    return db_knowledge

@router.delete("/{knowledge_id}")
def delete_knowledge(knowledge_id: int, db: Session = Depends(get_db)):
    db_knowledge = db.query(Knowledge).filter(Knowledge.id == knowledge_id).first()
    if db_knowledge is None:
        raise HTTPException(status_code=404, detail="Knowledge not found")
    
    db.delete(db_knowledge)
    db.commit()
    return {"detail": "Knowledge deleted"}