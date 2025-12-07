FROM python:3.12-slim AS base

ARG BUILD_ID=dev
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BUILD_ID=${BUILD_ID}

WORKDIR /app
ARG INSTALL_DEV=false

# Build essentials for wheels; libpq-dev for psycopg
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/dev.txt ./requirements/
RUN pip install --no-cache-dir -r requirements/base.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r requirements/dev.txt; fi

FROM base AS dev
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM base AS prod
COPY . .
COPY entrypoint.sh /entrypoint.sh

# Drop build deps and create non-root user
RUN apt-get purge -y build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system app \
    && adduser --system --ingroup app app \
    && chown -R app:app /app /entrypoint.sh

USER app

CMD ["/entrypoint.sh"]
