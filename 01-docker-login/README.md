# Taller: Docker + Login

CE5508 - Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes.

Sistema de gestión de proyectos de dispositivos médicos de misión crítica: frontend (React + Vite), backend (Node + Express + Sequelize) y base de datos (MariaDB), los tres orquestados con Docker Compose.

## Qué ya funciona

- **Base de datos completa**: tablas `Usuarios` y `Proyectos` ya creadas (`database/init/01-schema.sql`), con datos de ejemplo (`02-seed.sql`).
- **Backend — `GET /proyectos` y `POST /proyectos`**: totalmente funcionales (`backend/routes/proyectos.js`). Úsalo como referencia del patrón que vas a repetir.
- **Frontend — pantalla "Nuevo Proyecto"**: formulario funcional que crea proyectos y lista los existentes (`frontend/src/pages/NuevoProyecto.jsx`). Es tu ejemplo de referencia de cómo el frontend consume el backend con `fetch`.

## Qué te toca completar hoy

1. **`backend/routes/auth.js`** — implementa `POST /auth/register` y `POST /auth/login` (hash de contraseña con bcrypt, comparación, generación de JWT). Sigue los TODOs numerados dentro del archivo.
2. **`backend/middleware/auth.js`** — implementa la verificación del JWT recibido en el header `Authorization: Bearer <token>`. Sigue los TODOs numerados. (No lo conectes todavía a `proyectos.js` — eso es de una sesión futura).
3. **`frontend/src/pages/Login.jsx`** — implementa el formulario de login: llamar a `/auth/login`, guardar el token, mostrar éxito/error. Sigue los TODOs numerados.
4. **`frontend/src/api.js`** — agrega la función que llama a `/auth/login` (y opcionalmente `/auth/register`), siguiendo el mismo patrón que `crearProyecto()`.

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
| Backend | http://localhost:4000 | API REST |
| MariaDB | localhost:3306 | usuario `root`, password `root123` |

Los volúmenes montan tu código local dentro del contenedor, así que los cambios que hagas en `backend/` o `frontend/` se reflejan al vuelo (nodemon y Vite ya traen recarga en caliente).

Para apagar todo:

```bash
docker compose down
```

Para apagar y borrar también los datos de la base de datos:

```bash
docker compose down -v
```

## Cómo probar lo que ya funciona

Con el stack corriendo:

```bash
# Listar proyectos
curl http://localhost:4000/proyectos

# Crear un proyecto
curl -X POST http://localhost:4000/proyectos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Desfibrilador X1","encargado":"Tu Nombre","tipoDispositivo":"Desfibrilador","criticidad":"critico","estado":"desarrollo"}'
```

O abre http://localhost:5173 y usa el formulario "Nuevo Proyecto".

## Cómo probar lo que vas a construir

```bash
# Registrar un usuario
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ce5508.com","password":"clave123","nombre":"Estudiante"}'

# Iniciar sesión
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ce5508.com","password":"clave123"}'
```

Si `/auth/login` responde con un `token`, tu implementación funciona.

## Estructura

```
01-docker-login/
├── docker-compose.yml
├── backend/
│   ├── models/         Usuario.js, Proyecto.js (Sequelize)
│   ├── routes/         auth.js (TODO), proyectos.js (referencia)
│   ├── middleware/      auth.js (TODO)
│   ├── db.js            conexión a MariaDB
│   └── index.js         arranque de Express
├── frontend/
│   └── src/
│       ├── pages/       NuevoProyecto.jsx (referencia), Login.jsx (TODO)
│       └── api.js        funciones fetch hacia el backend
└── database/
    └── init/             scripts SQL que MariaDB ejecuta al primer arranque
```

## Variables de entorno

Cada servicio trae un `.env.example`. Docker Compose ya define las variables necesarias para desarrollo local — no necesitas crear archivos `.env` a mano para levantar el stack. Los `.env.example` sirven de referencia si corres backend o frontend fuera de Docker.
