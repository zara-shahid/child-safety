"""
EPCID Database Configuration

SQLAlchemy async database setup with connection pooling.
"""

import os
from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/epcid.db")

# Convert to async URL for SQLite
ASYNC_DATABASE_URL = DATABASE_URL
if DATABASE_URL.startswith("sqlite:"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("sqlite:", "sqlite+aiosqlite:")
elif DATABASE_URL.startswith("postgresql:"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql:", "postgresql+asyncpg:")


# Base class for all models
class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


# Synchronous engine (for migrations and testing)
engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
)

# Asynchronous engine (for application runtime)
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
)

# Session factories
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
    """Enable foreign key support for SQLite."""
    if DATABASE_URL.startswith("sqlite:"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db() -> Generator[Session, None, None]:
    """
    Synchronous database session dependency.

    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Async database session dependency.

    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_async_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.

    Usage:
        async with get_db_context() as db:
            result = await db.execute(select(Item))
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def init_db() -> None:
    """
    Initialize the database by creating all tables.

    Should be called once at application startup.
    """
    # Import models to register them with Base
    from . import models  # noqa

    # Create all tables
    Base.metadata.create_all(bind=engine)


async def init_async_db() -> None:
    """
    Async version of database initialization.
    """
    from . import models  # noqa

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def drop_db() -> None:
    """
    Drop all database tables.

    WARNING: This will delete all data!
    """
    Base.metadata.drop_all(bind=engine)


async def drop_async_db() -> None:
    """
    Async version of database drop.
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
