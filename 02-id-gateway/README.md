# Taller 2 — Identidad y la puerta de entrada

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes —
Tecnológico de Costa Rica.

Punto de partida: copia del Taller 1. El objetivo del taller es meter una
puerta única (gateway) frente a `auth-service` y `backend`, separar sus bases
de datos y pasar la verificación de tokens a firma asimétrica con JWKS — nada
de eso está construido todavía.

## Estructura

```
02-id-gateway/
├── docker-compose.yml  define los servicios, sus puertos y variables
├── auth-service/       API de autenticación (Python + Flask)
├── backend/            API de proyectos (Node + Express + Sequelize)
├── frontend/           interfaz web (React + Vite)
├── database/init/      SQL que MariaDB corre en su primer arranque
└── docs/               guía completa (id-gateway.md) y material del curso
```

## Levantarlo

```bash
docker compose up --build
```

Guía completa — estado actual, requisitos del taller, cómo probarlo — en
[`docs/id-gateway.md`](docs/id-gateway.md).
