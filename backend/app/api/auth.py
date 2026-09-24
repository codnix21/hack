from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    create_access_token,
    get_current_user,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas import GuestContinueResponse, TokenResponse, UserLogin, UserOut, UserRegister
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["Аутентификация"])


@router.post("/register", response_model=TokenResponse, summary="Регистрация")
def register(data: UserRegister, db: Annotated[Session, Depends(get_db)]):
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name or data.email.split("@")[0],
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, "register", user_id=user.id, entity_type="user", entity_id=user.id)
    token = create_access_token(user.email, {"role": user.role})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


def _authenticate(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email.lower())
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный адрес электронной почты или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись отключена")
    return user


@router.post("/login", response_model=TokenResponse, summary="Вход (JSON)")
def login_json(data: UserLogin, db: Annotated[Session, Depends(get_db)]):
    user = _authenticate(db, data.email, data.password)
    token = create_access_token(user.email, {"role": user.role})
    log_action(db, "login", user_id=user.id, entity_type="user", entity_id=user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login/form", response_model=TokenResponse, summary="Вход (OAuth2 form)")
def login_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
):
    user = _authenticate(db, form_data.username, form_data.password)
    token = create_access_token(user.email, {"role": user.role})
    log_action(db, "login", user_id=user.id, entity_type="user", entity_id=user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, summary="Текущий пользователь")
def me(user: Annotated[User, Depends(get_current_user)]):
    return UserOut.model_validate(user)


@router.post("/guest-continue", response_model=GuestContinueResponse, summary="Продолжить как гость")
@router.post("/guest", response_model=GuestContinueResponse, summary="Продолжить как гость", include_in_schema=False)
def guest_continue(db: Annotated[Session, Depends(get_db)]):
    email = "guest@demo.local"
    user = get_user_by_email(db, email)
    if not user:
        user = User(
            email=email,
            password_hash=hash_password("Guest123!"),
            full_name="Гость",
            role="guest",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token(user.email, {"role": user.role})
    return GuestContinueResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        message="Продолжение как гость: доступны демо-проекты и каталог",
    )


@router.post("/logout", summary="Выход")
def logout():
    return {"message": "Вы вышли из системы"}
