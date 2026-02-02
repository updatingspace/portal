FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/src

RUN pip install --upgrade pip
COPY pyproject.toml .
RUN pip install .

COPY src/ src/

RUN useradd -m appuser
USER appuser

EXPOSE 8003
CMD ["gunicorn", "app.wsgi:application", "--bind", "0.0.0.0:8003", "--workers", "2", "--access-logfile", "-"]
