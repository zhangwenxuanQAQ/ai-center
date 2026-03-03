from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.chat.service import ChatService
from app.core.chat.dto import ChatCreate, ChatUpdate, Chat as ChatSchema

router = APIRouter()

@router.post("", response_model=ChatSchema)
def create_chat(chat: ChatCreate, db = Depends(get_db)):
    return ChatService.create_chat(db, chat)

@router.get("", response_model=List[ChatSchema])
def get_chats(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return ChatService.get_chats(db, skip, limit)

@router.get("/{chat_id}", response_model=ChatSchema)
def get_chat(chat_id: int, db = Depends(get_db)):
    chat = ChatService.get_chat(db, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@router.put("/{chat_id}", response_model=ChatSchema)
def update_chat(chat_id: int, chat: ChatUpdate, db = Depends(get_db)):
    return ChatService.update_chat(db, chat_id, chat)

@router.delete("/{chat_id}")
def delete_chat(chat_id: int, db = Depends(get_db)):
    return ChatService.delete_chat(db, chat_id)