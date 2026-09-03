# Taller: Docker + Login

CE5508 - Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes.

Sistema de gestión de proyectos de dispositivos médicos de misión crítica: frontend (React + Vite), backend (Node + Express + Sequelize) y base de datos (MariaDB), orquestados con Docker Compose.

## Qué ya funciona

- **Base de datos completa**: tablas `Usuarios` y `Proyectos` ya creadas (`database/init/01-schema.sql`), con datos de ejemplo (`02-seed.sql`).
- **Backend — `GET /proyectos` y `POST /proyectos`**: funcionales y protegidos con un middleware que exige JWT (`backend/routes/proyectos.js`, `backend/middleware/auth.js`).
- **Frontend — pantalla "Nuevo Proyecto"**: formulario funcional que crea proyectos y lista los existentes (`frontend/src/pages/NuevoProyecto.jsx`).

## El reto de hoy — resuelto

`auth-service/` es un contenedor nuevo y separado del backend actual, hecho en **Python + Flask**, que habla con la misma base de datos MariaDB y resuelve el login: `POST /register`, `POST /login` (devuelve un **JWT**) y `GET /me` (valida el token) contra la tabla `Usuarios`, con contraseñas hasheadas. Detalles en [`auth-service/README.md`](auth-service/README.md).

El frontend arranca en la pantalla de **Iniciar sesión / Crear cuenta** (`frontend/src/pages/Login.jsx`), que consume el `auth-service` vía `VITE_AUTH_URL`. Tras autenticarse se guarda `{ token, usuario }` en `localStorage`; al recargar, `App.jsx` valida el JWT contra `/me` antes de mostrar la pantalla de proyectos y, si expiró, vuelve al login. Las llamadas a `/proyectos` mandan el token en `Authorization: Bearer`.

El backend Node comparte el `JWT_SECRET` con el auth-service y monta `middleware/auth.js` sobre `/proyectos`: sin un JWT válido responde `401`. Si el frontend recibe un `401` de `/proyectos`, cierra la sesión y vuelve al login.

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
| Auth service | http://localhost:5001 | API REST — `/register`, `/login`, `/me` (Flask + JWT) |
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

`/proyectos` exige un JWT. Primero regístrate y obtén el token del `auth-service`:

```bash
curl -X POST http://localhost:5001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@example.com","password":"clave12345","nombre":"Tu Nombre"}'

TOKEN=$(curl -s -X POST http://localhost:5001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@example.com","password":"clave12345"}' | jq -r .token)
```

Y ahora usa ese token contra el backend:

```bash
# Listar proyectos
curl http://localhost:4000/proyectos -H "Authorization: Bearer $TOKEN"

# Crear un proyecto
curl -X POST http://localhost:4000/proyectos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Desfibrilador X1","encargado":"Tu Nombre"}'

# Sin token -> 401
curl -i http://localhost:4000/proyectos
```

O abre http://localhost:5173, inicia sesión y usa el formulario "Nuevo Proyecto".

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
├── backend/            /proyectos — Node + Express + Sequelize (protegido con JWT)
│   └── middleware/     auth.js — verifica el JWT del auth-service
├── auth-service/       /register, /login, /me — Python + Flask + JWT
├── frontend/
│   └── src/
│       ├── pages/       Login.jsx (auth-service) + NuevoProyecto.jsx (backend)
│       ├── auth.js      cliente del auth-service + sesión en localStorage
│       └── api.js
└── database/
    └── init/             scripts SQL que MariaDB ejecuta al primer arranque
```

## Variables de entorno

Cada servicio trae un `.env.example`. Docker Compose ya define las variables necesarias para desarrollo local — no necesitas crear archivos `.env` a mano para levantar el stack.
