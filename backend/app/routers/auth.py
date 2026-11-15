import secrets
from datetime import timedelta
from functools import lru_cache

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from ..config import get_settings
from ..dependencies import DB, SESSION_COOKIE, CurrentUser, hash_token
from ..models import Account, Session, User, new_id, now
from ..schemas import serialize

router = APIRouter(prefix="/auth", tags=["auth"])


@lru_cache
def google_client():
    settings = get_settings()
    oauth = OAuth()
    return oauth.register(
        "google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "timeout": 20},
    )


@router.get("/google")
async def login(request: Request):
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(503, "Google login is not configured")
    return await google_client().authorize_redirect(
        request, settings.frontend_origin + "/api/auth/callback/google"
    )


async def resolve_google_user(db, info: dict) -> User:
    if not info.get("sub") or not info.get("email") or info.get("email_verified") is not True:
        raise HTTPException(400, "Google did not return a verified email")
    # Provider subject is the identity; never silently link by email.
    user = await db.scalar(
        select(User)
        .join(Account)
        .where(Account.provider == "google", Account.provider_account_id == info["sub"])
    )
    if user is None:
        user = User(
            id=new_id(), email=info["email"], name=info.get("name"), image=info.get("picture")
        )
        db.add(user)
        await db.flush()
        db.add(Account(user_id=user.id, provider="google", provider_account_id=info["sub"]))
    else:
        user.name, user.image = info.get("name"), info.get("picture")
    await db.commit()
    return user


@router.get("/callback/google")
async def callback(request: Request, db: DB):
    settings = get_settings()
    try:
        token = await google_client().authorize_access_token(request)
        info = token.get("userinfo")
        if not info:
            raise HTTPException(400, "Missing Google identity")
        try:
            user = await resolve_google_user(db, info)
        except IntegrityError:
            await db.rollback()
            user = await db.scalar(
                select(User)
                .join(Account)
                .where(Account.provider == "google", Account.provider_account_id == info["sub"])
            )
            if user is None:
                raise HTTPException(409, "Email is already associated with another identity")
    except OAuthError:
        request.session.clear()
        return RedirectResponse(settings.frontend_origin + "/sign-in?error=oauth", status_code=303)
    except HTTPException:
        request.session.clear()
        raise
    request.session.clear()
    old_token = request.cookies.get(SESSION_COOKIE)
    if old_token:
        await db.execute(delete(Session).where(Session.token_hash == hash_token(old_token)))
    raw_token = secrets.token_urlsafe(32)
    max_age = settings.session_days * 86400
    db.add(
        Session(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=now() + timedelta(seconds=max_age),
        )
    )
    await db.commit()
    response = RedirectResponse(settings.frontend_origin + "/dashboard", status_code=303)
    response.set_cookie(
        SESSION_COOKIE,
        raw_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/session")
async def session(user: CurrentUser):
    return {"user": serialize(user, only=["id", "name", "email", "image"])}


@router.post("/logout", status_code=204)
async def logout(request: Request, db: DB):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db.execute(delete(Session).where(Session.token_hash == hash_token(token)))
        await db.commit()
    request.session.clear()
    response = Response(status_code=204)
    response.delete_cookie(
        SESSION_COOKIE, path="/", httponly=True, secure=get_settings().cookie_secure, samesite="lax"
    )
    return response
