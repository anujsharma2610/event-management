"""FastAPI application entrypoint, middleware, exception handlers, and routing."""

import logging
import os
from collections.abc import Callable
from datetime import UTC, datetime
from json.decoder import JSONDecodeError

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.events import router as events_router
from app.errors import AppError
from app.seed import seed_demo_data
from app.service import EventService
from app.store import EventStore

logger = logging.getLogger(__name__)


def create_app(
    store: EventStore | None = None,
    clock: Callable[[], datetime] | None = None,
) -> FastAPI:
    """Create and configure a FastAPI application instance."""
    app_store = store if store is not None else EventStore()
    app_clock = clock if clock is not None else (lambda: datetime.now(UTC))

    app = FastAPI(
        title="Event Management API",
        version="0.1.0",
        description="Thread-safe, in-memory Event Management REST API using FastAPI and Pydantic v2.",
    )

    # Attach store and clock to app state for dependency injection
    app.state.store = app_store
    app.state.clock = app_clock

    # CORS configuration
    origins_env = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    allowed_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 1. Custom Domain Application Errors
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    # 2. JSON Parsing Errors (400 INVALID_JSON)
    @app.exception_handler(JSONDecodeError)
    async def json_decode_error_handler(request: Request, exc: JSONDecodeError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_JSON",
                    "message": f"Malformed JSON body: {exc.msg}.",
                    "details": [],
                }
            },
        )

    # 3. Pydantic / Request Validation Errors (422 VALIDATION_ERROR or 400 INVALID_JSON)
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        # Check if the error is actually a malformed JSON input
        if any(err.get("type") in ("json_invalid", "json_type") for err in errors):
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_JSON",
                        "message": "Malformed JSON body.",
                        "details": [],
                    }
                },
            )

        details = []
        for err in errors:
            loc = err.get("loc", ())
            field_parts = [str(x) for x in loc if x not in ("body",)]
            field_name = ".".join(field_parts) if field_parts else "body"
            msg = err.get("msg", "Validation failed.")
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, ") :]
            details.append({"field": field_name, "message": msg})

        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed.",
                    "details": details,
                }
            },
        )

    # 4. Standard Starlette HTTP Exceptions (e.g. 404, 405)
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": str(exc.detail),
                    "details": [],
                }
            },
        )

    # 5. Unexpected Internal Server Errors (500 INTERNAL_ERROR)
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected internal server error occurred.",
                    "details": [],
                }
            },
        )

    # Mount REST routes
    app.include_router(events_router)

    @app.get("/health", tags=["Health"])
    def health_check() -> JSONResponse:
        """Health check endpoint."""
        return JSONResponse(status_code=200, content={"status": "ok"})

    # Optional demo seed on startup if requested via environment
    if os.getenv("SEED_DEMO_DATA", "").lower() in ("1", "true", "yes"):
        seed_service = EventService(store=app_store, clock=app_clock)
        seed_demo_data(seed_service)

    return app


app = create_app()
