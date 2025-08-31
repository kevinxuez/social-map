import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set database URL from environment variable
DB_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg://postgres:postgres@localhost:5432/socialmap')
config.set_main_option('sqlalchemy.url', DB_URL)

# Import models for autogeneration
from app.models.base import Base  # noqa: E402
from app.models import models     # noqa: F401,E402
target_metadata = Base.metadata

EXCLUDE_TABLE_PREFIXES = (
    'spatial_ref_sys', 'tiger', 'topology', 'zip_', 'addr', 'faces', 'place', 'county', 'cousub', 'pagc_',
)

def include_object(object, name, type_, reflected, compare_to):  # noqa: D401
    if type_ == 'table':
        lower = name.lower()
        for prefix in EXCLUDE_TABLE_PREFIXES:
            if lower.startswith(prefix):
                return False
    return True

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
