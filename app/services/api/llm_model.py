from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import LLMModel
from app.core.llm_model.dto import LLMModelCreate, LLMModelUpdate, LLMModel as LLMModelSchema

router = APIRouter()

@router.post("", response_model=LLMModelSchema)
def create_llm_model(llm_model: LLMModelCreate, db: Session = Depends(get_db)):
    db_llm_model = LLMModel(**llm_model.model_dump())
    db.add(db_llm_model)
    db.commit()
    db.refresh(db_llm_model)
    return db_llm_model

@router.get("", response_model=List[LLMModelSchema])
def get_llm_models(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    llm_models = db.query(LLMModel).offset(skip).limit(limit).all()
    return llm_models

@router.get("/{llm_model_id}", response_model=LLMModelSchema)
def get_llm_model(llm_model_id: int, db: Session = Depends(get_db)):
    llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
    if llm_model is None:
        raise HTTPException(status_code=404, detail="LLM Model not found")
    return llm_model

@router.put("/{llm_model_id}", response_model=LLMModelSchema)
def update_llm_model(llm_model_id: int, llm_model: LLMModelUpdate, db: Session = Depends(get_db)):
    db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
    if db_llm_model is None:
        raise HTTPException(status_code=404, detail="LLM Model not found")
    
    update_data = llm_model.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_llm_model, field, value)
    
    db.commit()
    db.refresh(db_llm_model)
    return db_llm_model

@router.delete("/{llm_model_id}")
def delete_llm_model(llm_model_id: int, db: Session = Depends(get_db)):
    db_llm_model = db.query(LLMModel).filter(LLMModel.id == llm_model_id).first()
    if db_llm_model is None:
        raise HTTPException(status_code=404, detail="LLM Model not found")
    
    db.delete(db_llm_model)
    db.commit()
    return {"detail": "LLM Model deleted"}