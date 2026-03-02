from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.database import get_db
from app.database.models import Chat
from app.core.chat.dto import ChatCreate, ChatUpdate, Chat as ChatSchema

router = APIRouter()

@router.post("", response_model=ChatSchema)
def create_chat(chat: ChatCreate, db: Session = Depends(get_db)):
    db_chat = Chat(**chat.model_dump())
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return db_chat

@router.get("", response_model=List[ChatSchema])
def get_chats(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    chats = db.query(Chat).offset(skip).limit(limit).all()
    return chats

@router.get("/{chat_id}", response_model=ChatSchema)
def get_chat(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@router.delete("/{chat_id}")
def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if db_chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    db.delete(db_chat)
    db.commit()
    return {"detail": "Chat deleted"}