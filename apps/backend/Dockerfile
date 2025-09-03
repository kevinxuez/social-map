FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential libpq-dev curl \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-dev.txt ./
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then \
			pip install --no-cache-dir -r requirements-dev.txt ; \
		else \
			pip install --no-cache-dir -r requirements.txt ; \
		fi

COPY . .
RUN chmod +x /app/start.sh
# Ensure Alembic finds config
ENV ALEMBIC_CONFIG=alembic.ini

EXPOSE 8000