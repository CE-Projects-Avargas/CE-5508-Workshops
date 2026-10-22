# Taller 3 — Microservicios y eventos

CE5508 · Plataforma de monitoreo de dispositivos médicos.

```
navegador ──▶ gateway :8080 ─┬─▶ auth-service :4001 ──▶ auth-db        (red datos-auth)
                             ├─▶ backend      :4000 ──▶ operacion-db   (red datos-operacion)
                             └─▶ pump-service :4002 ──▶ operacion-db
                             └─▶ device-service:4003 ──▶ device-db     (red datos-device)

device-service ──publica──▶ RabbitMQ ──consume──▶ notification-service ──▶ notification-db
```

El Taller 3 conserva el login y gateway del Taller 2. Los servicios se ejecutan en contenedores separados; `device-service` publica eventos en RabbitMQ y `notification-service` los consume sin llamadas HTTP entre ellos.

## Cómo levantarlo

```bash
cd 02-gateway
docker compose up --build
```

Frontend en http://localhost:5173. RabbitMQ Management en http://localhost:15672 (`taller3` / `taller3-local-only`). Usuarios de prueba: `ana@hospital.cr` / `carlos@hospital.cr`, contraseña `clave123`.

Los servicios nuevos esperan sus implementaciones en `device-service/` y `notification-service/`, y sus scripts SQL en `database/device/` y `database/notification/`. No borren los volúmenes existentes salvo que quieran eliminar los datos locales; `docker compose down -v` borra también las bases, las llaves y la cola persistida.

## Endpoints de auth (públicos)

| Ruta | Método | Contrato |
|---|---|---|
| `/api/auth/register` | POST | `{email, password, nombre}` → 201, o 409 si el correo existe |
| `/api/auth/login` | POST | `{email, password}` → `{accessToken, refreshToken, expiresIn, user}`, o 401 |
| `/api/auth/refresh` | POST | `{refreshToken}` → par nuevo; el anterior deja de servir (401 si se reusa) |
| `/api/auth/jwks` | GET | JSON Web Key Set vigente |

Todo lo demás, incluyendo `/api/devices/*`, exige `Authorization: Bearer <accessToken>`.

## Contrato del Taller 3

Nginx enruta `/api/devices/*` a `device-service:4003`, quitando el prefijo `/api`. Por eso el servicio implementa `/devices`, `/devices/:id` y `/devices/:id/alerts`. Los requests de dispositivos conservan el header `Authorization` para que el servicio valide JWT con `JWKS_URL`.

| Ruta pública | Método | Resultado esperado |
|---|---|---|
| `/api/devices` | POST | Recibe `{serial, nombre, ownerType, ownerId}`, guarda y publica `device.registered`; responde 201 |
| `/api/devices/:id` | GET | Devuelve el dispositivo autorizado; responde 401, 403 o 404 según el caso |
| `/api/devices/:id/alerts` | POST | Recibe `{level, message}`, publica `device.alert.triggered`; responde 202 |

### Contrato de RabbitMQ

- Broker: `rabbitmq:5672` dentro de la red Docker. La interfaz de administración local está en el puerto `15672`.
- URL: `amqp://taller3:taller3-local-only@rabbitmq:5672`.
- Exchange durable de tipo `topic`: `ce5508.events`; routing key igual a `type` (`device.registered` o `device.alert.triggered`).
- Cola durable: `notifications`, enlazada a ambos tipos de evento. El consumidor confirma (`ACK`) solo después de guardar la notificación.
- Cada evento incluye `eventId` único, `type`, `occurredAt`, `deviceId` y `ownerType`/`ownerId`; los de alerta agregan `level` y `message`. El consumidor deduplica por `eventId`.

`device-service` debe comparar el usuario del JWT con el dueño cuando `ownerType` sea `user`. Para `ownerType: project`, el equipo debe acordar cómo confirmar que ese usuario tiene acceso al proyecto: el JWT actual no contiene membresías de proyectos. Documenten la decisión y no acepten un `ownerId` de proyecto sin verificarlo.

### Verificaciones del Taller 3

Con el sistema levantado y `TOKEN` establecido con un access token válido:

```bash
# Registro: 201; el servicio publica device.registered
curl -i -X POST localhost:8080/api/devices -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serial":"DEV-001","nombre":"Sensor de prueba","ownerType":"user","ownerId":1}'

# Sin JWT: 401. Un usuario válido que no sea dueño: 403.
curl -i localhost:8080/api/devices/1
curl -i localhost:8080/api/devices/1 -H "Authorization: Bearer $TOKEN"

# Alerta: 202; notification-service registra el eventId una sola vez.
curl -i -X POST localhost:8080/api/devices/1/alerts -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"level":"warning","message":"Lectura fuera de rango"}'

# Detener el consumidor, publicar otra alerta, iniciarlo y comprobar que procesa la cola pendiente.
docker compose stop notification-service
docker compose start notification-service
```

Para demostrar la deduplicación, reenvíen a RabbitMQ un mensaje con el mismo `eventId` y confirmen que la tabla de notificaciones contiene una sola fila para ese id.

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
