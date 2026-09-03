# Taller 1 — Docker + Login

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes —
Tecnológico de Costa Rica.

Sistema de gestión de proyectos de dispositivos médicos de misión crítica.
Son cuatro contenedores levantados con Docker Compose: una interfaz web, dos
APIs separadas y una base de datos.

## Los cuatro servicios

| Servicio | Puerto | Stack | De qué se encarga |
|---|---|---|---|
| `frontend` | 5173 | React + Vite | Pantallas de sesión y de proyectos |
| `auth-service` | 5001 | Python + Flask | Registro, login y emisión de tokens |
| `backend` | 4000 | Node + Express + Sequelize | API de proyectos, protegida por token |
| `mariadb` | 3306 | MariaDB 11 | Base de datos, compartida por las dos APIs |

```
                    ┌───────────────────────────────┐
                    │  frontend  :5173              │
                    └─────┬───────────────────┬─────┘
       registro / login   │                   │   proyectos
                          ▼                   ▼   (+ token)
          ┌───────────────────────┐  ┌───────────────────────┐
          │ auth-service  :5001   │  │ backend  :4000        │
          │ emite el token        │  │ verifica el token     │
          └───────────┬───────────┘  └───────────┬───────────┘
                      │    JWT_SECRET compartido │
                      └────────────┬─────────────┘
                                   ▼
                       ┌───────────────────────┐
                       │ mariadb  :3306        │
                       │ Usuarios · Proyectos  │
                       └───────────────────────┘
```

La autenticación vive en su propio contenedor, separada de la API de proyectos.
El `auth-service` firma los tokens y el `backend` los verifica por su cuenta,
usando el mismo `JWT_SECRET`: no se consultan entre sí en cada petición, así que
arrancan en cualquier orden y ninguno depende de que el otro esté vivo.

## Cómo moverse por el repositorio

```
01-docker-login/
├── docker-compose.yml      define los 4 servicios, sus puertos y variables
│
├── auth-service/           API de autenticación (Python)
│   ├── app.py              los endpoints: registro, login y validación del token
│   ├── db.py               conexión a MariaDB
│   ├── requirements.txt    dependencias de Python
│   └── Dockerfile
│
├── backend/                API de proyectos (Node)
│   ├── index.js            arranque del servidor y montaje de las rutas
│   ├── db.js               conexión a MariaDB vía Sequelize
│   ├── middleware/auth.js  exige un token válido antes de dejar pasar
│   ├── models/Proyecto.js  la tabla Proyectos vista como modelo
│   ├── routes/proyectos.js listar y crear proyectos
│   └── Dockerfile
│
├── frontend/               interfaz web (React)
│   ├── src/
│   │   ├── App.jsx         decide si mostrar la pantalla de sesión o la de proyectos
│   │   ├── auth.js         habla con el auth-service y guarda la sesión
│   │   ├── api.js          habla con el backend y adjunta el token
│   │   └── pages/
│   │       ├── Login.jsx          iniciar sesión y crear cuenta
│   │       └── NuevoProyecto.jsx  formulario y listado de proyectos
│   └── Dockerfile
│
├── database/init/          SQL que MariaDB corre en su primer arranque
│   ├── 01-schema.sql       crea las tablas Usuarios y Proyectos
│   └── 02-seed.sql         inserta proyectos de ejemplo
│
└── docs/                   material del curso
```

### Dónde mirar según lo que busques

| Si buscas… | Está en |
|---|---|
| Cómo se crea y se firma un token | [`auth-service/app.py`](auth-service/app.py) |
| Cómo se protege una ruta | [`backend/middleware/auth.js`](backend/middleware/auth.js) |
| Qué guarda el navegador al iniciar sesión | [`frontend/src/auth.js`](frontend/src/auth.js) |
| Cómo viaja el token en cada petición | [`frontend/src/api.js`](frontend/src/api.js) |
| Qué columnas tiene cada tabla | [`database/init/01-schema.sql`](database/init/01-schema.sql) |
| Cómo se conectan los contenedores | [`docker-compose.yml`](docker-compose.yml) |

## Cómo funciona la sesión

1. Desde la pantalla de inicio se crea una cuenta o se inicia sesión contra el
   `auth-service`. Las contraseñas se guardan hasheadas, nunca en texto plano.
2. Si las credenciales son correctas, el `auth-service` devuelve un token y los
   datos del usuario. El navegador los guarda en `localStorage`, así que la
   sesión sobrevive a recargar la página.
3. Cada llamada a `/proyectos` sale con el token en la cabecera
   `Authorization: Bearer`. El `backend` lo verifica antes de responder: sin un
   token válido devuelve `401` y no llega a consultar la base.
4. Al recargar, el frontend vuelve a preguntarle al `auth-service` si el token
   sigue vigente. Si expiró, limpia la sesión y regresa a la pantalla de inicio.

La protección está en el `backend`, no en la interfaz: `/proyectos` responde
`401` a cualquier petición sin token, venga del navegador o de `curl`.

## Endpoints

### auth-service — `http://localhost:5001`

| Método | Ruta | Entrada | Respuesta |
|---|---|---|---|
| `POST` | `/register` | `{ email, password, nombre }` | `201` creado · `409` email ya registrado · `400` falta un campo |
| `POST` | `/login` | `{ email, password }` | `200` con el token y el usuario · `401` credenciales inválidas |
| `GET` | `/me` | cabecera `Authorization: Bearer <token>` | `200` con el usuario · `401` token inválido o expirado |

Los tokens expiran a los `JWT_EXPIRA_MIN` minutos (60 por defecto).

### backend — `http://localhost:4000`

| Método | Ruta | Entrada | Respuesta |
|---|---|---|---|
| `GET` | `/proyectos` | cabecera `Authorization: Bearer <token>` | `200` con la lista · `401` sin token válido |
| `POST` | `/proyectos` | `{ nombre, encargado }` + la cabecera | `201` con el proyecto creado · `401` sin token válido |

## Cómo levantar el stack

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/)
instalado y corriendo.

```bash
git clone git@github.com:CE-Projects-Avargas/CE-5508-Workshops.git
cd CE-5508-Workshops/01-docker-login
docker compose up --build
```

Cuando terminen de arrancar:

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| Auth service | http://localhost:5001 |
| MariaDB | `localhost:3306` — usuario `root`, password `root123` |

El código local se monta dentro de los contenedores, así que los cambios en
`backend/`, `frontend/` o `auth-service/` se reflejan sin reconstruir.

```bash
docker compose down       # apagar
docker compose down -v    # apagar y borrar además los datos de la base
```

## Cómo probarlo

Desde el navegador: abrir http://localhost:5173, crear una cuenta y usar el
formulario de proyectos.

Desde la terminal:

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

# Crear un proyecto
curl -X POST http://localhost:4000/proyectos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Desfibrilador X1","encargado":"Ana Rojas"}'

# Sin token responde 401
curl -i http://localhost:4000/proyectos
```

Para consultar la base directamente:

```bash
docker compose exec mariadb mariadb -u root -proot123 dispositivos_medicos
```

```sql
SHOW TABLES;
SELECT * FROM Proyectos;
SELECT id, email, nombre FROM Usuarios;
```

## Variables de entorno

Los valores están escritos directamente en `docker-compose.yml`, así que
`docker compose up --build` funciona en un clon limpio sin configurar nada.

`JWT_SECRET` es la variable que importa: el `auth-service` firma los tokens con
ella y el `backend` los verifica con ella, así que tiene que ser idéntica en los
dos servicios.

Como está a la vista en el repositorio, sirve para desarrollo pero no para un
despliegue real: quien la tenga puede fabricar tokens válidos para cualquier
usuario. [`.env.example`](.env.example) documenta las variables y cómo sacarlas
del repositorio cuando haga falta.

Cada servicio trae además su propio `.env.example`, que sirve para correrlo
fuera de Docker.

## Si el backend no arranca

Compose guarda las dependencias de Node en un volumen que sobrevive a los
rebuilds. Si el stack se levantó antes de que se agregara alguna dependencia,
el contenedor puede arrancar sin ella y fallar con `Cannot find module`. Se
resuelve recreando los volúmenes:

```bash
docker compose down -v
docker compose up --build
```

`down -v` también borra los datos de la base, así que hay que volver a crear la
cuenta.
