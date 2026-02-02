# Portal Frontend

React + Vite frontend for UpdSpace Portal.

Key rules:

- Browser talks only to BFF via same-origin `/api/v1/*` (Vite dev proxy in local dev).
- Tenant is host-based (subdomain), used for branding and dev utilities.
- API errors must surface `request_id` for support.

## Configuration

See `.env.example`.

Important env vars:

- `VITE_DEV_PROXY_TARGET` — where Vite proxies `/api/v1` in local dev (typically `http://localhost:8080`).
- `VITE_LOGIN_PATH` — same-origin login initiation endpoint on BFF (default: `/api/v1/auth/login`).

## Node.js version

Vite 7 requires Node.js `>=20.19.0 <22.0.0` or `>=22.12.0`.

If you use `nvm`, run `nvm use` in this folder (see `.nvmrc`).

## Run

### Local
```bash
npm install
npm run dev
```

### Local tenant domains (recommended)

To mimic prod cookie behavior and host-based tenancy:

- Add to `/etc/hosts`:
	- `127.0.0.1 aef.updspace.local`
	- (optional) other tenants: `foo.updspace.local`
- Open: `http://aef.updspace.local:5173`

Vite dev server allows `.updspace.local` hosts in `vite.config.ts`.

### Docker
```bash
docker build -t portal-frontend .
docker run -p 5173:80 portal-frontend
```
