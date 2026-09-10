# Taller 2 — Identidad y la puerta de entrada

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes —
Tecnológico de Costa Rica.

## Estado actual

Esta carpeta arranca como una copia exacta de
[`01-docker-login`](../../01-docker-login/): los mismos cuatro contenedores,
en los mismos puertos, con la misma base de datos compartida entre
`auth-service` y `backend`, y el mismo `JWT_SECRET` simétrico. Ninguno de los
requisitos del Taller 2 está implementado todavía — la guía completa está en
[`Guia_Estudiante_T2.pdf`](Guia_Estudiante_T2.pdf).

En resumen, esto es lo que hay que construir a partir de esta base:

| Requisito | Qué cambia respecto al Taller 1 |
|---|---|
| Puerta única | Un `gateway` (nginx u otro) en `:8080` enruta `/api/auth/*` a `auth-service` y el resto a `backend`; el frontend deja de hablarles directo |
| Bases separadas | `auth-db` y `backend-db` en contenedores distintos, sin que ningún servicio pueda leer la base del otro |
| Firma asimétrica + JWKS | `auth-service` firma con una clave RSA privada; `backend` valida con la pública vía `GET /api/auth/jwks`, sin `JWT_SECRET` compartido |
| Defensa en profundidad | `backend` sigue exigiendo y validando el token aunque se le llame directo, saltándose la puerta |

Mientras tanto, el sistema corre y se prueba exactamente como el Taller 1.

## Estructura

```
02-id-gateway/
├── docker-compose.yml  define los servicios, sus puertos y variables
├── auth-service/       API de autenticación (Python + Flask)
├── backend/            API de proyectos (Node + Express + Sequelize)
├── frontend/           interfaz web (React + Vite)
├── database/init/      SQL que MariaDB corre en su primer arranque
└── docs/               esta guía y el material del curso
```

## Cómo levantarlo

```bash
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Auth service | http://localhost:5001 |
| MariaDB | `localhost:3306` — usuario `root`, password `root123` |

## Cómo probarlo

```bash
# Crear una cuenta
curl -X POST http://localhost:5001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"clave12345","nombre":"Ana Rojas"}'

# Iniciar sesión y quedarse con el token
TOKEN=$(curl -s -X POST http://localhost:5001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"clave12345"}' | jq -r .token)

# Listar proyectos
curl http://localhost:4000/proyectos -H "Authorization: Bearer $TOKEN"

# Sin token responde 401
curl -i http://localhost:4000/proyectos
```

Para el detalle de cómo funciona hoy cada endpoint (los mismos del Taller 1,
sin los cambios de la tabla de arriba), ver
[`docs/docker-login.md`](../../01-docker-login/docs/docker-login.md).
