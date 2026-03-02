from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import Chatbot
from app.core.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema

router = APIRouter()

@router.post("", response_model=ChatbotSchema)
def create_chatbot(chatbot: ChatbotCreate, db: Session = Depends(get_db)):
    db_chatbot = Chatbot(**chatbot.model_dump())
    db.add(db_chatbot)
    db.commit()
    db.refresh(db_chatbot)
    return db_chatbot

@router.get("", response_model=List[ChatbotSchema])
def get_chatbots(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    chatbots = db.query(Chatbot).offset(skip).limit(limit).all()
    return chatbots

@router.get("/{chatbot_id}", response_model=ChatbotSchema)
def get_chatbot(chatbot_id: int, db: Session = Depends(get_db)):
    chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
    if chatbot is None:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    return chatbot

@router.put("/{chatbot_id}", response_model=ChatbotSchema)
def update_chatbot(chatbot_id: int, chatbot: ChatbotUpdate, db: Session = Depends(get_db)):
    db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
    if db_chatbot is None:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    
    update_data = chatbot.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_chatbot, field, value)
    
    db.commit()
    db.refresh(db_chatbot)
    return db_chatbot

@router.delete("/{chatbot_id}")
def delete_chatbot(chatbot_id: int, db: Session = Depends(get_db)):
    db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
    if db_chatbot is None:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    
    db.delete(db_chatbot)
    db.commit()
    return {"detail": "Chatbot deleted"}