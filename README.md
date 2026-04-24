# servd.pro Docker Compose

This setup now runs:

- `traefik.servd.pro` -> Traefik dashboard
- `get.servd.pro` -> minimal Linktree-style Node.js app
- `postgres` -> Postgres database for users, sessions, profiles, and links

The app includes:

- user sign up and log in
- editable profile with display name, bio, and profile image uploads
- ordered list of links
- public profile page at `/u/:username`

## Files

- `docker-compose.yml` defines Traefik, the Node app, and Postgres.
- [`app/server.js`](/root/servd-platform/app/server.js) contains the minimal Express app.
- [`app/Dockerfile`](/root/servd-platform/app/Dockerfile) builds the runtime image.
- [`.env.example`](/root/servd-platform/.env.example) shows the supported runtime settings.
- `letsencrypt/acme.json` stores Let's Encrypt certificates for Traefik.

## Environment

Compose defaults are intentionally minimal. Override them in a `.env` file if needed:

```dotenv
POSTGRES_DB=servd
POSTGRES_USER=servd
POSTGRES_PASSWORD=servdpassword
SESSION_SECRET=replace-this-with-a-long-random-secret
MAX_PROFILE_IMAGE_BYTES=5242880
```

`SESSION_SECRET` should be changed before exposing the app publicly.
`MAX_PROFILE_IMAGE_BYTES` controls the upload limit before resizing.

## Prerequisites

- Docker Engine installed
- Docker Compose plugin installed
- DNS `A` or `AAAA` records for `traefik.servd.pro` and `get.servd.pro` pointing to this server
- Ports `80` and `443` open on the server

## Exact setup commands

From the repository root:

```bash
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json
docker compose up -d --build
```

## Exact commands to verify

Check container status:

```bash
docker compose ps
```

Watch app logs:

```bash
docker compose logs -f app
```

Watch Postgres logs:

```bash
docker compose logs -f postgres
```

Test HTTP to HTTPS redirect:

```bash
curl -I http://get.servd.pro
```

Test the app over HTTPS:

```bash
curl -I https://get.servd.pro
curl https://get.servd.pro
```

Test the Traefik dashboard route:

```bash
curl -I https://traefik.servd.pro
```

## Useful commands

Stop the stack:

```bash
docker compose down
```

Stop the stack and remove the database volume:

```bash
docker compose down -v
```

Rebuild after app changes:

```bash
docker compose up -d --build
```

## Notes

- The Node app creates its `users` and `links` tables automatically at startup.
- Profile image uploads are resized to `512x512` with Sharp and stored in Postgres.
- Session data is stored in Postgres via `connect-pg-simple`.
- The Traefik dashboard is only routed on `traefik.servd.pro`; it is not exposed on port `8080`.
- Let's Encrypt issuance will fail until DNS is pointed at this server and port `443` is reachable.
- Traefik needs `letsencrypt/acme.json` to be writable and set to `600`.
