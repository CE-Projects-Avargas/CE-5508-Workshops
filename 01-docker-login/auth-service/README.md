# auth-service

Contenedor separado del backend de `/proyectos`. Hecho en **Python + Flask**,
habla con la misma **MariaDB** y resuelve el login usando la tabla `Usuarios`
que ya crea `database/init/01-schema.sql`.

## Stack

- Flask + flask-cors
- PyMySQL (conexion directa a MariaDB, sin ORM)
- Hash de contrasenas con `werkzeug.security` (PBKDF2) — nunca se guardan en claro
- JWT firmado con `PyJWT` (HS256) — `/login` emite el token, `/me` lo valida

## Endpoints

| Metodo | Ruta        | Entrada                               | Respuesta                          |
|--------|-------------|---------------------------------------|------------------------------------|
| GET    | `/`         | —                                     | estado del servicio                |
| POST   | `/register` | body `{ "email", "password", "nombre" }` | `201` usuario creado / `409` email repetido |
| POST   | `/login`    | body `{ "email", "password" }`        | `200 { token, usuario }` / `401` credenciales invalidas |
| GET    | `/me`       | header `Authorization: Bearer <token>` | `200 { usuario }` / `401` token invalido o expirado |

Corre en `http://localhost:5001`. El token expira a los `JWT_EXPIRA_MIN` minutos (60 por defecto).

El backend de `/proyectos` comparte el mismo `JWT_SECRET` y valida el token con su propio middleware (`backend/middleware/auth.js`), así que el JWT emitido aquí sirve para autenticar contra ambos servicios.

## Probar

```bash
# Registrar
curl -X POST http://localhost:5001/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"secreta123","nombre":"Ana Rojas"}'

# Login -> devuelve { token, usuario }
curl -X POST http://localhost:5001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"secreta123"}'

# Usar el token para pedir /me
TOKEN="<pega-el-token-del-login>"
curl http://localhost:5001/me -H "Authorization: Bearer $TOKEN"
```

Verificar en la base de datos:

```bash
docker compose exec mariadb mariadb -u root -proot123 dispositivos_medicos \
  -e "SELECT id, email, nombre FROM Usuarios;"
```

## Variables de entorno

Docker Compose las inyecta automaticamente. Para correr fuera de Docker,
copia `.env.example` a `.env`.

| Variable      | Default (fuera de Docker) |
|---------------|---------------------------|
| `DB_HOST`     | `localhost`               |
| `DB_PORT`     | `3306`                    |
| `DB_NAME`     | `dispositivos_medicos`    |
| `DB_USER`     | `root`                    |
| `DB_PASSWORD` | `root123`                 |
| `PORT`        | `5001`                    |
| `JWT_SECRET`  | `dev-secret-ce5508-cambialo` (cambiar fuera de desarrollo) |
| `JWT_EXPIRA_MIN` | `60`                   |

El volumen `./auth-service:/app` monta el codigo local dentro del contenedor
y Flask corre en modo `debug`, asi que los cambios se recargan al vuelo.
