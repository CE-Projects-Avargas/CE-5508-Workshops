# CE5508 — Taller 2: Identidad y puerta de entrada

## 1. Integrantes

Maryuri Reyes - Mauro Navarro - Melina Porras

---

## 2. Arquitectura

El sistema utiliza un gateway como única entrada para el frontend:

```text
Frontend
   |
   v
Gateway :8080
   |
   +--> auth-service :4001 --> auth-db
   |
   +--> backend :4000 ------> operacion-db
   |
   +--> pump-service :4002 -> operacion-db
```

- `auth-service` emite los JWT.
- `backend` y `pump-service` validan los JWT mediante JWKS.
- El gateway enruta las solicitudes y centraliza CORS.
- `auth-db` y `operacion-db` están aisladas mediante redes y usuarios de base de datos.

### Autenticación

Los access tokens utilizan:

- RSA 2048
- RS256
- `kid`
- `sub`
- `iss`
- `aud`
- `exp`

Los refresh tokens se almacenan como hash y se rotan al utilizarse.

---

## 3. Ejecución

Desde `02-gateway`:

```bash
docker compose up --build
```

Gateway:

```text
http://localhost:8080
```

Para detener el sistema:

```bash
docker compose down
```

---

## 4. Endpoints principales

### Registro

```http
POST /api/auth/register
```

```json
{
  "email": "usuario@test.cr",
  "password": "clave123",
  "nombre": "Usuario"
}
```

### Login

```http
POST /api/auth/login
```

Devuelve:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900
}
```

### Refresh

```http
POST /api/auth/refresh
```

```json
{
  "refreshToken": "..."
}
```

### JWKS

```http
GET /api/auth/jwks
```

### Rutas protegidas

Requieren:

```http
Authorization: Bearer <accessToken>
```

---

## 5. Verificación

| Prueba | Resultado esperado |
|---|---|
| Registro correcto | `201` |
| Correo duplicado | `409` |
| Login correcto | `200` |
| Login incorrecto | `401` |
| Solicitud sin token | `401` |
| Token inválido | `401` |
| Token expirado | `401` |
| Token válido | Acceso permitido |
| Refresh válido | Nuevo par de tokens |
| Reutilización del refresh anterior | `401` |
| Acceso directo al backend sin token | `401` |
| Auth-service detenido | `502` desde gateway |
| Rotación de clave | El JWKS conserva las claves necesarias |
| Acceso entre bases no autorizadas | Denegado |

---

## 6. Seguridad

- La clave privada RSA pertenece únicamente a `auth-service`.
- Las claves RSA se almacenan en un volumen de Docker.
- Las claves privadas no se incluyen en Git ni en las imágenes.
- `backend` y `pump-service` validan los JWT mediante JWKS.
- El gateway exige la presencia de `Authorization`, pero no valida la firma del JWT.
- El endpoint de rotación de claves no está expuesto mediante el gateway.
- Cada servicio utiliza su propio usuario de base de datos.
