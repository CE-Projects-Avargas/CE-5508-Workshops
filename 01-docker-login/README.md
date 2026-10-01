# Taller 1 — Docker + Login

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes —
Tecnológico de Costa Rica.

Sistema de gestión de proyectos de dispositivos médicos de misión crítica.
Cuatro contenedores con Docker Compose: interfaz web, dos APIs separadas
(autenticación y proyectos) que comparten una misma base de datos, y esa base
de datos.

## Estructura

```
01-docker-login/
├── docker-compose.yml  define los 4 servicios, sus puertos y variables
├── auth-service/       API de autenticación (Python + Flask)
├── backend/            API de proyectos (Node + Express + Sequelize)
├── frontend/           interfaz web (React + Vite)
├── database/init/      SQL que MariaDB corre en su primer arranque
└── docs/               guía completa (docker-login.md) y material del curso
```

## Levantarlo

```bash
docker compose up --build
```

Guía completa — arquitectura, endpoints, cómo probarlo, variables de entorno —
en [`docs/docker-login.md`](docs/docker-login.md).
