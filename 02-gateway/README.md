# Taller 2 — Identidad y la puerta de entrada

CE5508 · Plataforma de monitoreo de dispositivos médicos.

```
navegador ──▶ gateway :8080 ─┬─▶ auth-service :4001 ──▶ auth-db        (red datos-auth)
                             ├─▶ backend      :4000 ──▶ operacion-db   (red datos-operacion)
                             └─▶ pump-service :4002 ──▶ operacion-db
```

Un contenedor por servicio (7 en total): `frontend`, `gateway` (nginx), `auth-service` (FastAPI), `backend` y `pump-service` (Express), `auth-db` y `operacion-db` (MariaDB).

## Cómo levantarlo

```bash
cd 02-gateway
docker compose down -v        # la primera vez tras actualizar: recrea las bases (tabla RefreshTokens) y las llaves
docker compose up --build
```

Frontend en http://localhost:5173. Usuarios de prueba: `ana@hospital.cr` / `carlos@hospital.cr`, contraseña `clave123`.

## Endpoints de auth (públicos)

| Ruta | Método | Contrato |
|---|---|---|
| `/api/auth/register` | POST | `{email, password, nombre}` → 201, o 409 si el correo existe |
| `/api/auth/login` | POST | `{email, password}` → `{accessToken, refreshToken, expiresIn, user}`, o 401 |
| `/api/auth/refresh` | POST | `{refreshToken}` → par nuevo; el anterior deja de servir (401 si se reusa) |
| `/api/auth/jwks` | GET | JSON Web Key Set vigente |

Todo lo demás exige `Authorization: Bearer <accessToken>`.

## Decisiones

- **Firma asimétrica (RS256).** Auth firma con una llave privada RSA 2048 que se genera al arrancar y vive solo en el volumen `auth-keys`, montado únicamente en auth. No hay ningún secreto compartido.
- **JWKS con `kid`.** Cada llave es `auth-key-N.pem`; se firma con la de número más alto y `/jwks` publica todas, así rotar no invalida tokens vigentes.
- **Validación local.** `backend/auth.js` y `pump-service/auth.js` (el mismo archivo) comprueban firma, `exp`, `iss`, `aud` y que el token sea de tipo `access`. El JWKS se guarda en memoria; solo se vuelve a pedir si llega un `kid` desconocido, y como máximo una vez cada 30 s.
- **La puerta no valida firmas.** nginx solo exige que venga `Authorization: Bearer ...` en rutas protegidas (`gateway/requiere-token.conf`) y la reenvía intacta. No agrega cabeceras de identidad.
- **Access 15 min, refresh 8 h** (configurable con `ACCESS_TOKEN_MINUTES` y `REFRESH_TOKEN_HOURS` en el compose). El refresh es un valor aleatorio opaco; en `auth-db` solo se guarda su SHA-256. Usarlo lo marca como usado en un único `UPDATE`, así que dos usos simultáneos no pueden ganar ambos.
- **401 vs 403.** Sin token, firma inválida o token vencido → 401. Bomba de otro usuario → 403.
- **Menor privilegio.** Cada servicio usa su propio usuario de MariaDB (`auth_user`, `backend_user`, `pump_user`) con solo los GRANT que necesita.

## Cómo verificar cada requisito

Los comandos son para Git Bash, desde `02-gateway` y con el sistema corriendo.

```bash
login() { curl -s -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"clave123\"}"; }
campo() { sed -E "s/.*\"$1\":\"([^\"]+)\".*/\1/"; }
TOKEN=$(login ana@hospital.cr | campo accessToken)
```

**Requisito 1 — servicios y bases separados**

```bash
# backend no llega a auth-db por red (espera ENOTFOUND)
docker compose exec backend node -e "require('net').connect(3306,'auth-db').on('error',e=>console.log(e.code))"
# y operacion-db no tiene la base de autenticación
docker compose exec operacion-db mariadb -ubackend_user -pbackend_pass -e "SELECT * FROM autenticacion.Usuarios"
```

**Requisito 2 — una sola puerta**

```bash
curl -i localhost:8080/api/proyectos                    # 401 de la puerta: no trae cabecera
curl -i localhost:8080/api/proyectos -H "Authorization: Bearer $TOKEN"   # 200
docker compose stop auth-service
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8080/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"ana@hospital.cr","password":"clave123"}'   # 502 (error de la puerta)
docker compose start auth-service
```

**Requisito 3 — firma asimétrica y JWKS**

```bash
curl -s localhost:8080/api/auth/jwks                    # {"keys":[{"kty":"RSA","kid":"auth-key-1",...}]}
docker compose exec auth-service ls /app/keys           # la privada está aquí...
docker compose exec backend ls /app/keys                # ...y en backend no existe
# rotación: un token firmado con la llave 1 sigue sirviendo después de agregar la 2
docker compose exec auth-service python keys.py rotar && docker compose restart auth-service
curl -s localhost:8080/api/auth/jwks                    # ahora trae auth-key-1 y auth-key-2
curl -s localhost:8080/api/proyectos -H "Authorization: Bearer $TOKEN"   # token viejo (auth-key-1): sigue 200
TOKEN2=$(login ana@hospital.cr | campo accessToken)      # firmado con auth-key-2
curl -s localhost:8080/api/proyectos -H "Authorization: Bearer $TOKEN2"  # 200: backend recarga el JWKS al ver el kid nuevo
```

Refresh rotado:

```bash
R1=$(login ana@hospital.cr | campo refreshToken)
curl -s -X POST localhost:8080/api/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"$R1\"}"   # par nuevo
curl -s -X POST localhost:8080/api/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"$R1\"}"   # 401: ya usado
```

**Requisito 4 — defensa en profundidad** (saltándose la puerta; backend y pump-service publican su puerto)

```bash
curl -i localhost:4000/proyectos                        # 401
curl -i localhost:4000/proyectos -H "Authorization: Bearer $TOKEN"       # igual que por la puerta
curl -i localhost:4002/productos                        # 401
```

**401 vs 403**

```bash
TOKEN_CARLOS=$(login carlos@hospital.cr | campo accessToken)
curl -i localhost:8080/api/bombas/1 -H "Authorization: Bearer $TOKEN_CARLOS"   # 403: la bomba 1 es de Ana
curl -i localhost:8080/api/bombas/1 -H "Authorization: Bearer x.y.z"            # 401: token inválido
```

## Herramientas usadas

- **Claude (Anthropic), asistente de IA.** Se usó para revisar el sistema contra la guía del taller y para estos cambios: quitar el `auth_request` del gateway (validaba tokens en la puerta, lo que prohíbe la guía) y reemplazarlo por solo exigir la cabecera; poner caché de JWKS en pump-service (antes lo pedía en cada petición); pasar los refresh tokens de un `set()` en memoria a hash en `auth-db`; alinear las respuestas con el contrato (201, 401, `accessToken`/`refreshToken`/`expiresIn`); soportar varias llaves para rotar.
