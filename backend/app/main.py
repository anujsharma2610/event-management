"""FastAPI application entrypoint and application factory."""

import os
from collections.abc import Callable
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.store import EventStore


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
        description="Event Management REST API using FastAPI and in-memory storage.",
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

    @app.get("/health", tags=["Health"])
    def health_check() -> JSONResponse:
        """Health check endpoint."""
        return JSONResponse(status_code=200, content={"status": "ok"})

    return app


app = create_app()
