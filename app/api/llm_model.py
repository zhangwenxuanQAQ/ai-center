from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.llm_model.service import LLMModelService
from app.core.llm_model.dto import LLMModelCreate, LLMModelUpdate, LLMModel as LLMModelSchema

router = APIRouter()

@router.post("", response_model=LLMModelSchema)
def create_llm_model(llm_model: LLMModelCreate, db = Depends(get_db)):
    return LLMModelService.create_llm_model(db, llm_model)

@router.get("", response_model=List[LLMModelSchema])
def get_llm_models(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return LLMModelService.get_llm_models(db, skip, limit)

@router.get("/{llm_model_id}", response_model=LLMModelSchema)
def get_llm_model(llm_model_id: int, db = Depends(get_db)):
    llm_model = LLMModelService.get_llm_model(db, llm_model_id)
    if llm_model is None:
        raise HTTPException(status_code=404, detail="LLM Model not found")
    return llm_model

@router.put("/{llm_model_id}", response_model=LLMModelSchema)
def update_llm_model(llm_model_id: int, llm_model: LLMModelUpdate, db = Depends(get_db)):
    return LLMModelService.update_llm_model(db, llm_model_id, llm_model)

@router.delete("/{llm_model_id}")
def delete_llm_model(llm_model_id: int, db = Depends(get_db)):
    return LLMModelService.delete_llm_model(db, llm_model_id)