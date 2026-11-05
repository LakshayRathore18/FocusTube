import json
import logging
from contextlib import asynccontextmanager
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException
from starlette.middleware.sessions import SessionMiddleware

from .config import get_settings
from .dependencies import DB
from .routers import ai, auth, courses, notes, rag, stats, videos
from .services.rag_provider import RagError

logger = logging.getLogger("focustube")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    from .database import session_factory

    if session_factory.cache_info().currsize:
        await session_factory().kw["bind"].dispose()
        session_factory.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="FocusTube API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.auth_secret,
        session_cookie="focustube_oauth",
        max_age=600,
        same_site="lax",
        https_only=settings.cookie_secure,
    )

    @app.middleware("http")
    async def browser_security(request: Request, call_next):
        request_id = str(uuid4())
        request.state.request_id = request_id
        start = monotonic()
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and (
            request.headers.get("origin") != settings.frontend_origin
        ):
            response = JSONResponse({"error": "Invalid request origin"}, status_code=403)
        else:
            try:
                response = await call_next(request)
            except Exception as exc:
                # Exception text/tracebacks can include SQL values, tokens or provider URLs.
                logger.error(
                    json.dumps(
                        {
                            "event": "api_error",
                            "request_id": request_id,
                            "exception_type": type(exc).__name__,
                        }
                    )
                )
                response = JSONResponse({"error": "Internal server error"}, status_code=500)
        response.headers["X-Request-ID"] = request_id
        response.headers["Cache-Control"] = "no-store"
        logger.info(
            json.dumps(
                {
                    "event": "request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": getattr(request.scope.get("route"), "path", "unmatched"),
                    "status": response.status_code,
                    "duration_ms": round((monotonic() - start) * 1000),
                }
            )
        )
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(
            {"error": str(exc.detail)}, status_code=exc.status_code, headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse({"error": "; ".join(e["msg"] for e in exc.errors())}, status_code=400)

    @app.exception_handler(RagError)
    async def rag_error(request: Request, exc: RagError):
        return JSONResponse(
            {"error": exc.code, "code": exc.code},
            status_code=exc.status,
            headers={"Retry-After": "60"} if exc.status == 429 else None,
        )

    @app.get("/api/health", tags=["health"])
    async def health():
        return {"status": "ok"}

    @app.get("/api/health/ready", tags=["health"])
    async def ready(db: DB):
        try:
            await db.execute(text("SELECT 1"))
            return {"status": "ready"}
        except Exception:
            return JSONResponse({"error": "Database unavailable"}, status_code=503)

    for router in (
        auth.router,
        courses.router,
        videos.router,
        notes.router,
        stats.router,
        ai.router,
        rag.router,
    ):
        app.include_router(router, prefix="/api")
    return app


app = create_app()
