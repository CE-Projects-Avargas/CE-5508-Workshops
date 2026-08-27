# Taller: Docker + Login

CE5508 - Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes.

Sistema de gestión de proyectos de dispositivos médicos de misión crítica: frontend (React + Vite), backend (Node + Express + Sequelize) y base de datos (MariaDB), orquestados con Docker Compose.

## Qué ya funciona

- **Base de datos completa**: tablas `Usuarios` y `Proyectos` ya creadas (`database/init/01-schema.sql`), con datos de ejemplo (`02-seed.sql`).
- **Backend — `GET /proyectos` y `POST /proyectos`**: totalmente funcionales (`backend/routes/proyectos.js`).
- **Frontend — pantalla "Nuevo Proyecto"**: formulario funcional que crea proyectos y lista los existentes (`frontend/src/pages/NuevoProyecto.jsx`).

## El reto de hoy

`auth-service/` está vacía. Ahí construyen, desde cero, un contenedor nuevo y separado del backend actual que hable con la misma base de datos MariaDB y resuelva el login: registrar un usuario y autenticarlo.

Cómo lo resuelvan es su decisión.

## Cómo levantar el proyecto

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.

```bash
git clone git@github.com:CE-Projects-Avargas/CE-5508-Workshops.git
cd CE-5508-Workshops/01-docker-login
docker compose up --build
```

Esto levanta:

| Servicio | URL | Descripción |
|---|---|---|
| Frontend | http://localhost:5173 | React + Vite |
| Backend | http://localhost:4000 | API REST — `/proyectos` |
| MariaDB | localhost:3306 | usuario `root`, password `root123` |

Los volúmenes montan tu código local dentro del contenedor, así que los cambios que hagas en `backend/` o `frontend/` se reflejan al vuelo.

Para apagar todo:

```bash
docker compose down
```

Para apagar y borrar también los datos de la base de datos:

```bash
docker compose down -v
```

## Cómo probar lo que ya funciona

```bash
# Listar proyectos
curl http://localhost:4000/proyectos

# Crear un proyecto
curl -X POST http://localhost:4000/proyectos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Desfibrilador X1","encargado":"Tu Nombre"}'
```

O abre http://localhost:5173 y usa el formulario "Nuevo Proyecto".

Para explorar la base de datos directamente:

```bash
docker compose exec mariadb mariadb -u root -p
# password: root123
MariaDB [(none)]> USE dispositivos_medicos;
MariaDB [dispositivos_medicos]> SHOW TABLES;
MariaDB [dispositivos_medicos]> SELECT * FROM Proyectos;
MariaDB [dispositivos_medicos]> SELECT * FROM Usuarios;
```

## Estructura

```
01-docker-login/
├── docker-compose.yml
├── backend/            /proyectos — ya funciona completo
├── auth-service/        vacía — el reto de hoy
├── frontend/
│   └── src/
│       ├── pages/       NuevoProyecto.jsx (funciona)
│       └── api.js
└── database/
    └── init/             scripts SQL que MariaDB ejecuta al primer arranque
```

## Variables de entorno

Cada servicio trae un `.env.example`. Docker Compose ya define las variables necesarias para desarrollo local — no necesitas crear archivos `.env` a mano para levantar el stack.
