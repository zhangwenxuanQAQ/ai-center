from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.chatbot.service import ChatbotService
from app.core.chatbot.dto import ChatbotCreate, ChatbotUpdate, Chatbot as ChatbotSchema

router = APIRouter()

@router.post("", response_model=ChatbotSchema)
def create_chatbot(chatbot: ChatbotCreate, db = Depends(get_db)):
    return ChatbotService.create_chatbot(db, chatbot)

@router.get("", response_model=List[ChatbotSchema])
def get_chatbots(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return ChatbotService.get_chatbots(db, skip, limit)

@router.get("/{chatbot_id}", response_model=ChatbotSchema)
def get_chatbot(chatbot_id: int, db = Depends(get_db)):
    chatbot = ChatbotService.get_chatbot(db, chatbot_id)
    if chatbot is None:
        raise HTTPException(status_code=404, detail="Chatbot not found")
    return chatbot

@router.put("/{chatbot_id}", response_model=ChatbotSchema)
def update_chatbot(chatbot_id: int, chatbot: ChatbotUpdate, db = Depends(get_db)):
    return ChatbotService.update_chatbot(db, chatbot_id, chatbot)

@router.delete("/{chatbot_id}")
def delete_chatbot(chatbot_id: int, db = Depends(get_db)):
    return ChatbotService.delete_chatbot(db, chatbot_id)