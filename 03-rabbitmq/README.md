# Taller 3 — Persona 1: device-service y seguridad

Maryuri Reyes - Mauro Navarro - Melina Porras

Esta carpeta conserva la aplicación de `02-gateway` y agrega únicamente la parte de Persona 1:

- `device-service`, su Dockerfile y su base independiente `device-db`.
- Scripts SQL con dispositivos, eventos pendientes y usuario de permisos mínimos.
- Validación JWT/JWKS reutilizada del servicio de bombas.
- Validación de entradas y autorización por usuario o proyecto.
- Los tres endpoints y la generación de `device.registered` y `device.alert.triggered`.
- Un punto de integración para publicar usando la conexión que prepare Persona 2.

El Compose no incluye RabbitMQ ni servicios o bases de notificaciones.

## Ejecución

Con Docker Desktop activo, desde esta carpeta:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f device-service
```

Detener el Taller 2 antes de iniciar este si ocupa los mismos puertos. El nombre del proyecto `ce5508-taller3` separa los volúmenes. Para detener conservando datos: `docker compose down`.

Frontend existente: http://localhost:5173. API: http://localhost:8080/api. Los endpoints de dispositivos están disponibles a través del gateway; el frontend heredado todavía no tiene una pantalla de dispositivos.

`device-service` escucha internamente en 4003 y se conecta únicamente a `device-db` con `device_user`, nunca como root. Comparte la red interna para consultar JWKS y al backend; la base permanece en `datos-device` y no expone un puerto al anfitrión.

## Autenticación y endpoints

Registrar usuarios con `POST /api/auth/register` (`{nombre, email, password}`) y obtener `accessToken` con `POST /api/auth/login` (`{email, password}`). Enviar `Authorization: Bearer <accessToken>` para los tres endpoints:

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| POST | `/api/devices` | `{serial, nombre, ownerType, ownerId}` → `201` |
| GET | `/api/devices/:id` | Dispositivo autorizado → `200` |
| POST | `/api/devices/:id/alerts` | `{level, message}` → `202` con `eventId` |

```json
{"serial":"DEV-001","nombre":"Sensor de temperatura","ownerType":"user","ownerId":1}
```

`ownerType` admite `user` o `project`. Para `user`, `ownerId` debe coincidir con el `sub` del JWT. Para `project`, el servicio consulta `GET /proyectos/:id` del backend reenviando el JWT y verifica que el proyecto pertenezca al usuario. No consulta directamente la base del backend.

`serial` es obligatorio y único, con hasta 64 caracteres; `nombre` admite hasta 255. `ownerId` debe ser un entero positivo.

```json
{"level":"critical","message":"Temperatura fuera del rango esperado"}
```

`level` admite `info`, `warning` y `critical`; `message` es obligatorio y admite hasta 2000 caracteres.

Sin token o token inválido: `401`; usuario sin permiso: `403`; dispositivo o proyecto inexistente: `404`; entrada inválida: `400`; serial duplicado: `409`; backend inaccesible al comprobar el proyecto: `503`.

## Integración con Persona 2

Registrar un dispositivo genera `device.registered`; reportar una alerta genera `device.alert.triggered`. Los eventos incluyen `eventId`, `type`, `occurredAt`, `deviceId`, `ownerType`, `ownerId`, `usuarioId` y `data`.

El registro del dispositivo y su evento se guardan juntos en una transacción. Las alertas también se guardan en `device-db.Outbox`. Esto permite conservar eventos mientras Persona 2 prepara la conexión.

**La publicación real está pendiente de esa conexión.** Sin adaptador, los endpoints funcionan y guardan eventos pendientes; el servicio lo indica en sus logs y no los marca como publicados.

Persona 2 debe proporcionar un módulo dentro de `device-service` que exporte una función asíncrona `publicar(event)` y use su conexión preparada. La función debe resolver cuando el broker confirme la publicación y rechazar si falla. El adaptador se selecciona con la variable `DEVICE_EVENT_PUBLISHER_MODULE`, por ejemplo en un `.env` al lado del Compose:

```dotenv
DEVICE_EVENT_PUBLISHER_MODULE=./publisher.js
```

El módulo se carga relativo al directorio `device-service`. La conexión, credenciales, exchange, dependencias y redes necesarias serán integradas por Persona 2. El servicio invoca el publicador al iniciar y cada segundo para los eventos pendientes. Solo marca `publishedAt` después de la confirmación. Una entrega puede repetirse ante un fallo entre publicar y actualizar; el consumidor de Persona 3 debe deduplicar por `eventId`.

Consultar los eventos generados:

```bash
docker compose exec device-db mariadb -udevice_user -pdevice_pass devices -e "SELECT eventId, payload, publishedAt FROM Outbox;"
```

Los scripts SQL se ejecutan al inicializar un volumen de base vacío.

## Validación

Con Node.js 20 o superior, sin instalar dependencias:

```bash
node --test device-service/test/*.test.js
```

Las pruebas cubren validación, autorización por usuario/proyecto, errores del backend, transacción de registro, alertas y publicación mediante un adaptador simulado. No sustituyen la prueba con contenedores y con la conexión real de Persona 2.

La validación del Compose y las pruebas de lógica se pueden ejecutar sin el motor Docker activo. La construcción de imágenes y las pruebas HTTP en contenedores requieren iniciarlo.


Para levantar esto:

```
cd 03-rabbitmq
docker compose up --build -d
```
