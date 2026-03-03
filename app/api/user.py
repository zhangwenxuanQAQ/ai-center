from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.database.database import get_db
from app.core.user.service import UserService
from app.core.user.dto import UserCreate, UserUpdate, User as UserSchema, UserLogin

router = APIRouter()

@router.post("", response_model=UserSchema)
def create_user(user: UserCreate, db = Depends(get_db)):
    return UserService.create_user(db, user)

@router.get("", response_model=List[UserSchema])
def get_users(skip: int = 0, limit: int = 100, db = Depends(get_db)):
    return UserService.get_users(db, skip, limit)

@router.get("/{user_id}", response_model=UserSchema)
def get_user(user_id: int, db = Depends(get_db)):
    user = UserService.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user: UserUpdate, db = Depends(get_db)):
    return UserService.update_user(db, user_id, user)

@router.delete("/{user_id}")
def delete_user(user_id: int, db = Depends(get_db)):
    return UserService.delete_user(db, user_id)

@router.post("/login")
def login(user: UserLogin, db = Depends(get_db)):
    # 这里可以添加登录逻辑
    return {"access_token": "token", "token_type": "bearer"}