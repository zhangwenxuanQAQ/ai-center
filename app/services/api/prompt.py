from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import Prompt
from app.core.prompt.dto import PromptCreate, PromptUpdate, Prompt as PromptSchema

router = APIRouter()

@router.post("", response_model=PromptSchema)
def create_prompt(prompt: PromptCreate, db: Session = Depends(get_db)):
    db_prompt = Prompt(**prompt.model_dump())
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.get("", response_model=List[PromptSchema])
def get_prompts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    prompts = db.query(Prompt).offset(skip).limit(limit).all()
    return prompts

@router.get("/{prompt_id}", response_model=PromptSchema)
def get_prompt(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt

@router.put("/{prompt_id}", response_model=PromptSchema)
def update_prompt(prompt_id: int, prompt: PromptUpdate, db: Session = Depends(get_db)):
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if db_prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    update_data = prompt.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_prompt, field, value)
    
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if db_prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    db.delete(db_prompt)
    db.commit()
    return {"detail": "Prompt deleted"}