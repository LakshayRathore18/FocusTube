from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from authlib.integrations.base_client.errors import OAuthError
from sqlalchemy import select

from app.dependencies import hash_token
from app.models import Account, Session, User
from app.routers import auth

INFO = {"sub": "google-subject", "email": "new@example.com", "email_verified": True, "name": "New"}


def mock_google(monkeypatch, *, info=None, error=None):
    client = SimpleNamespace(
        authorize_access_token=AsyncMock(
            return_value={"userinfo": INFO if info is None else info},
            side_effect=error,
        )
    )
    monkeypatch.setattr(auth, "google_client", lambda: client)
    return client


async def test_callback_rotates_session_and_repeat_login_reuses_account(setup, monkeypatch):
    client, factory, _ = setup
    mock_google(monkeypatch)
    response = await client.get("/api/auth/callback/google")
    assert response.status_code == 303
    assert response.headers["location"] == "http://localhost:3000/dashboard"
    cookie = next(
        c for c in response.headers.get_list("set-cookie") if c.startswith("focustube_session=")
    )
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Max-Age=604800" in cookie
    first_token = client.cookies.get("focustube_session")
    assert first_token != "token-a"
    async with factory() as db:
        assert (
            await db.scalar(select(Session).where(Session.token_hash == hash_token("token-a")))
            is None
        )
        assert await db.scalar(select(Session).where(Session.token_hash == hash_token(first_token)))
        assert len(list(await db.scalars(select(Account)))) == 1
    assert (await client.get("/api/auth/session")).json()["user"]["email"] == INFO["email"]
    assert (await client.get("/api/auth/callback/google")).status_code == 303
    async with factory() as db:
        assert len(list(await db.scalars(select(User)))) == 3
        assert len(list(await db.scalars(select(Account)))) == 1
        assert (
            await db.scalar(select(Session).where(Session.token_hash == hash_token(first_token)))
            is None
        )


@pytest.mark.parametrize(
    "info",
    [
        {},
        {**INFO, "sub": ""},
        {**INFO, "email": ""},
        {**INFO, "email_verified": False},
        {**INFO, "email_verified": "true"},
    ],
)
async def test_callback_rejects_missing_or_unverified_identity(setup, monkeypatch, info):
    client, factory, _ = setup
    mock_google(monkeypatch, info=info)
    assert (await client.get("/api/auth/callback/google")).status_code == 400
    async with factory() as db:
        assert list(await db.scalars(select(Account))) == []
        assert len(list(await db.scalars(select(Session)))) == 2


async def test_callback_does_not_link_matching_email(setup, monkeypatch):
    client, factory, _ = setup
    mock_google(monkeypatch, info={**INFO, "email": "a@example.com"})
    assert (await client.get("/api/auth/callback/google")).status_code == 409
    async with factory() as db:
        assert list(await db.scalars(select(Account))) == []


@pytest.mark.parametrize("error", ["access_denied", "mismatching_state", "invalid_nonce"])
async def test_callback_oauth_errors_redirect_without_new_session(setup, monkeypatch, error):
    client, factory, _ = setup
    mock_google(monkeypatch, error=OAuthError(error=error))
    response = await client.get("/api/auth/callback/google")
    assert response.status_code == 303
    assert response.headers["location"].endswith("/sign-in?error=oauth")
    async with factory() as db:
        assert list(await db.scalars(select(Account))) == []
        assert len(list(await db.scalars(select(Session)))) == 2


async def test_real_oauth_client_rejects_callback_without_state(setup):
    client, _, _ = setup
    response = await client.get("/api/auth/callback/google?code=untrusted")
    assert response.status_code == 303
    assert response.headers["location"].endswith("/sign-in?error=oauth")
