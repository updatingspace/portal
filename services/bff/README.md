# BFF Service

Backend For Frontend service. Handles session management, request proxying, and tenant resolution.

## Configuration

See `.env.example`

## Run

### Local Dev
```bash
make dev
```

### Docker
```bash
docker build -t bff .
docker run -p 8080:8080 --env-file .env bff
```
