from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.prompt.service import PromptService
from app.core.prompt.dto import PromptCreate, PromptUpdate, Prompt as PromptSchema

router = APIRouter()

@router.post("", response_model=PromptSchema)
def create_prompt(prompt: PromptCreate, db = Depends(get_db)):
    return PromptService.create_prompt(db, prompt)

@router.get("", response_model=List[PromptSchema])
def get_prompts(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return PromptService.get_prompts(db, skip, limit)

@router.get("/{prompt_id}", response_model=PromptSchema)
def get_prompt(prompt_id: int, db = Depends(get_db)):
    prompt = PromptService.get_prompt(db, prompt_id)
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return prompt

@router.put("/{prompt_id}", response_model=PromptSchema)
def update_prompt(prompt_id: int, prompt: PromptUpdate, db = Depends(get_db)):
    return PromptService.update_prompt(db, prompt_id, prompt)

@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: int, db = Depends(get_db)):
    return PromptService.delete_prompt(db, prompt_id)