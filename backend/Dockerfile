FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
ARG INSTALL_DEV=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/dev.txt ./
RUN pip install --no-cache-dir -r base.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install --no-cache-dir -r dev.txt; fi

COPY . .

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
