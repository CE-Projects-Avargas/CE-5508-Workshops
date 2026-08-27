# Taller 1 — Docker + Login

Construir un contenedor aparte (Python) que resuelva **registro** y **login**
contra la MariaDB que ya existe, y conectarlo al frontend.
Login válido → pantalla de proyectos. Sin login, no se pasa.

Stack: FastAPI + SQLAlchemy + passlib[bcrypt] + PyJWT.

## Estructura

```
01-docker-login/
├── docker-compose.yml          P1  + servicio nuevo
├── auth-service/               ← el reto
│   ├── Dockerfile              P1  andamiaje
│   ├── requirements.txt        P1  andamiaje
│   ├── .dockerignore           P1  andamiaje
│   ├── .env.example            P1  andamiaje
│   ├── main.py                 P1  andamiaje — app, CORS, routers
│   ├── db.py                   P1  andamiaje — engine SQLAlchemy
│   ├── models.py               P1  andamiaje — mapeo tabla Usuarios
│   ├── schemas.py              P2  Pydantic del contrato
│   ├── security.py             P2/P3  ★ hash + JWT
│   └── routes/auth.py          P2/P3  ★ /register /login /me
├── database/init/
│   ├── 01-schema.sql           P1  solo cabecera TODO (ya está listo)
│   └── 02-seed.sql             P1  solo cabecera TODO
├── backend/                    no se toca
└── frontend/src/
    ├── App.jsx                 P4  navegación + guarda
    ├── api.js                  P4  auth + header Authorization
    └── pages/
        ├── Login.jsx           P4  nuevo (fue borrado del repo)
        ├── Registro.jsx        P4  nuevo
        └── NuevoProyecto.jsx   ya funciona
```

★ = se escribe a mano, es lo que hay que poder defender.

## Contrato (acordar primero, así los 4 van en paralelo)

```
POST /register  { email, nombre, password }  → 201 | 409 existe | 400 falta campo
POST /login     { email, password }          → 200 { token } | 401
GET  /me        Authorization: Bearer <t>    → 200 { usuario } | 401
```

## Tareas

**P1 · Infra + BD** — arranca primero, desbloquea a los demás
- Servicio en `docker-compose.yml`: build, puerto, `depends_on: mariadb healthy`, env vars, bind-mount
- `Dockerfile` (python:3.12-slim), `requirements.txt`, `.env.example`
- `db.py` + `models.py` contra la tabla `Usuarios` existente
- Cabeceras TODO en los dos `.sql`

**P2 · Registro**
- `schemas.py` con el contrato
- `POST /register`: validar → hash bcrypt → insert
- Email duplicado = `409`, no un 500 de MariaDB
- Probar con `curl`, incluyendo errores

**P3 · Login + tokens**
- `POST /login`: buscar usuario → verificar hash → firmar JWT
- Dependency de verificación reutilizable + `GET /me`
- El chequeo que devuelve `401` sin token ← lo que hace real el "no se pasa"

**P4 · Frontend**
- `Login.jsx` y `Registro.jsx` desde cero
- Navegación entre las 3 pantallas (estado en `App.jsx` alcanza)
- Guardar token, mandarlo como `Bearer`, logout, mostrar errores
- Trabaja con respuestas inventadas hasta que P2/P3 aterricen

**Los 4, al final (30 min)** — declaración de herramientas: qué se usó y para qué,
IA incluida. Cada quien explica su parte. Es criterio de evaluación.

## Ojo con esto

- Inicias con username `email` (UNIQUE) + `nombre` + `password`.
  `nombre` es `NOT NULL`: el registro tiene que pedirlo o el INSERT revienta.
- Hash en Python, no en SQL. MariaDB solo da SHA2/MD5 sin salt.
- `JWT_SECRET` va por env var, la misma en todo servicio que firme o valide.
- **Pendiente:** quién devuelve el `401` de `/proyectos`, si no escribimos Node.
  Opción: el servicio Python valida y reenvía a `backend:4000`, y le quitamos
  el `ports:` al backend para que solo se llegue por ahí.

## Listo cuando

1. `docker compose up --build` desde clon limpio, sin pasos manuales
2. Registro funciona; el mismo email otra vez da error
3. Password malo no entra; el bueno sí
4. `curl localhost:4000/proyectos` sin token no devuelve datos
5. Recargar no bota la sesión; logout devuelve a login
