FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

RUN pip install --upgrade pip
COPY pyproject.toml .
COPY bin ./bin
RUN pip install .

COPY src/ src/
RUN chmod +x /app/bin/serverless-task.sh

RUN useradd -m appuser
USER appuser

EXPOSE 8008
CMD ["gunicorn", "app.wsgi:application", "--bind", "0.0.0.0:8008", "--workers", "2", "--access-logfile", "-"]
