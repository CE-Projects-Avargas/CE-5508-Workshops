# Taller 2: Identidad y la puerta de entrada

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes,
Tecnológico de Costa Rica.

Una puerta única (gateway nginx) frente a `auth-service` y `backend`, cada uno
con su propia base, y verificación de tokens con firma asimétrica (RS256) y
JWKS. Implementado en la rama `TE/hn/auth-db`.

## Estructura

```
02-id-gateway/
├── docker-compose.yml  servicios, redes, volúmenes y variables
├── gateway/            nginx: enrutamiento, CORS y exigencia de cabecera
├── auth-service/       autenticación (Python + Flask + PyJWT), firma RS256, JWKS
├── backend/            API de proyectos (Node + Express + jose)
├── frontend/           interfaz web (React + Vite), habla solo con el gateway
├── auth-db/init/       SQL de auth-db: Usuarios, RefreshTokens, auth_user
├── backend-db/init/    SQL de backend-db: Proyectos, backend_user
├── scripts/            verificar.sh: prueba en vivo los 4 requisitos
└── docs/               guía (id-gateway.md) y material del curso
```

## Levantarlo

```bash
docker compose down -v      # la primera vez, para que corran los SQL de init
docker compose up --build -d
```

Todo entra por http://localhost:8080 (frontend en http://localhost:5173).

Para comprobar los 4 requisitos de un tiro (Git Bash o Linux):

```bash
bash scripts/verificar.sh
```
Usuarios de prueba: `ana@hospital.cr` y `carlos@hospital.cr`, contraseña `clave123`.

Arquitectura, decisiones y cómo se verificó cada requisito en
[`docs/id-gateway.md`](docs/id-gateway.md).
