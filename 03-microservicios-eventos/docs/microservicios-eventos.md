# Taller 3: Microservicios y eventos

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes, TEC.
Equipo Transformers-Enterprise (TE) · rama `TE-Develop`.

Enunciado completo en [`Guia_Estudiante_T3.pdf`](Guia_Estudiante_T3.pdf).

## Arquitectura

```
navegador --> gateway :8080 --+--> auth-service   :5001 --> auth-db     (red datos-auth)
                              +--> backend        :4000 --> backend-db  (red datos-backend)
                              +--> device-service :4100 --> device-db   (red datos-device)
                                        |      \
                                        |       +--(HTTP, red interna)--> backend: ¿quién es el dueño del proyecto?
                                        | publica
                                        v
                                    RabbitMQ (red mensajeria)
                                        | consume
                                        v
                               notification-service --> notification-db (red datos-notification)
```

| Servicio | Imagen | Redes | Expuesto al host |
|---|---|---|---|
| gateway | nginx:alpine | borde, interna | 8080 |
| auth-service | Python 3.12 + Flask + PyJWT | interna, datos-auth | no |
| backend | Node 20 + Express + jose | interna, datos-backend | 4000 (a propósito, viene del Req 4 del Taller 2) |
| device-service | Node 20 + Express + jose + amqplib | interna, datos-device, mensajeria | no |
| notification-service | Node 20 + amqplib | datos-notification, mensajeria | no |
| rabbitmq | rabbitmq:3-management | mensajeria | 15672 (panel web) |
| auth-db, backend-db, device-db, notification-db | mariadb:11 | cada una en su red `datos-*` | no |
| frontend | Node 20 + Vite/React | borde | 5173 |

Once contenedores, siete redes y seis volúmenes, todo local. Cada servicio tiene
su propia base y solo comparte red con lo que necesita: notification-service no
está en la red `interna` (nadie le habla por HTTP), backend no está en
`mensajeria` (ni publica ni consume) y ningún servicio alcanza la base de otro.

## Flujo de eventos

```
device-service --publish--> exchange "device.events" (topic, durable)
                                   | routing key = type, enlace "device.#"
                                   v
                           cola "notification.events" (durable)
                                   |
                           notification-service (prefetch 1, ack manual)
                             guardado o repetido ............... ack
                             error temporal (p. ej. base caída) -> "notification.events.retry"
                                                                   espera 5 s y vuelve a la cola
                             inválido o 10 intentos fallidos ... -> "notification.events.dlq"
```

Cada evento viaja como JSON persistente:

```json
{
  "eventId": "d63e9aec-1bb5-410b-9790-2067819717fd",
  "type": "device.alert.triggered",
  "occurredAt": "2026-10-27T00:30:47.189Z",
  "deviceId": 2,
  "userId": 1,
  "ownerType": "project",
  "ownerId": 2,
  "data": { "alertId": 1, "level": "critical", "message": "Presion alta" }
}
```

`userId` es quien hizo la acción; `ownerType` + `ownerId` es el dueño del
dispositivo, un usuario o un proyecto. Esa es la "referencia al usuario o
proyecto" que pide el enunciado. `device.registered` lleva en `data` el
`serial` y el `nombre`.

## Estructura del proyecto

Estado final del taller. Los archivos marcados con ★ son los que cambiaron o
nacieron en el Taller 3; el resto viene igual del Taller 2.

```
03-microservicios-eventos/
├── docker-compose.yml          ★ 11 servicios, 7 redes, 6 volúmenes
├── .env.example                ★ + device-service, RabbitMQ y notification-service
│
├── gateway/
│   ├── nginx.conf              ★ + /api/devices -> device-service
│   ├── cors.conf
│   └── exigir-token.conf
│
├── auth-service/               autenticación (Python + Flask), sin cambios de lógica
│
├── backend/                    API de proyectos (Node + Express)
│   ├── routes/proyectos.js     ★ + GET /proyectos/:id (device-service lo consulta)
│   └── ...
│
├── device-service/             ★ nuevo: dispositivos y alertas (Node + Express)
│   ├── index.js                ★ arranque, /devices protegido con JWT
│   ├── middleware/auth.js      ★ verifica con JWKS (jose), igual que backend
│   ├── routes/devices.js       ★ endpoints y autorización por recurso (401/403/404)
│   ├── proyectos.js            ★ pregunta a backend el dueño de un proyecto
│   ├── events.js               ★ publica en RabbitMQ con confirmación del broker
│   ├── models/                 ★ Device.js, Alert.js
│   ├── db.js, package.json, Dockerfile, .env.example
│
├── notification-service/       ★ nuevo: consumidor de eventos (Node), sin API pública
│   ├── index.js                ★ arranque + GET / solo para el healthcheck
│   ├── consumidor.js           ★ ack manual, idempotencia, reintentos y DLQ
│   ├── models/Notificacion.js  ★
│   ├── db.js, package.json, Dockerfile, .env.example
│
├── frontend/src/
│   ├── App.jsx                 ★ pestañas Proyectos / Dispositivos
│   ├── api.js                  ★ + llamadas a /devices
│   ├── pages/Dispositivos.jsx  ★ registrar, consultar por id, reportar alerta
│   └── ...
│
├── auth-db/init/, backend-db/init/   iguales al Taller 2
├── device-db/init/             ★ Devices + Alerts, usuario device_user (SELECT, INSERT)
├── notification-db/init/       ★ Notificaciones (eventId UNIQUE), notification_user (SELECT, INSERT)
│
├── scripts/verificar.sh        ★ 43 comprobaciones en vivo: 4 requisitos y 5 pruebas obligatorias
└── docs/
    ├── microservicios-eventos.md  ★ esta guía
    └── Guia_Estudiante_T3.pdf     ★ enunciado del taller
```

Usuarios de prueba (contraseña `clave123`): `ana@hospital.cr` (id 1, dueña de los
tres proyectos del seed) y `carlos@hospital.cr` (id 2, sin proyectos). Los
dispositivos empiezan vacíos.

## Endpoints (por la puerta)

| Ruta | Método | Contrato |
|---|---|---|
| `/api/devices` | POST | `{serial, nombre, ownerType, ownerId}` -> 201 y publica `device.registered` |
| `/api/devices` | GET | Los dispositivos propios y los de proyectos propios |
| `/api/devices/:id` | GET | 200 si tiene permiso; 401 sin token o token inválido, 403 si es ajeno, 404 si no existe |
| `/api/devices/:id/alerts` | POST | `{level, message}` -> 202 y publica `device.alert.triggered` |
| `/api/proyectos/:id` | GET | Nuevo en este taller. Un proyecto (con su `ownerId`) |

Todo exige `Authorization: Bearer <token>`. Los endpoints de `/api/auth/*` y
`/api/proyectos` siguen igual que en el Taller 2. `level` es `info`, `warning` o
`critical`; `message` tiene como máximo 500 caracteres.

**Quién puede qué.** Un dispositivo con `ownerType: "user"` es de ese usuario.
Uno con `ownerType: "project"` es de un proyecto, y lo puede ver y modificar el
dueño del proyecto. Al registrar:

- `ownerType: "user"`: `ownerId` puede omitirse; si viene y no es el usuario del token, 403.
- `ownerType: "project"`: `ownerId` es el id del proyecto. Si no existe, 400; si no es tuyo, 403.
- Serial repetido: 409.

## Decisiones de implementación

- **Autorización por recurso.** device-service verifica el JWT por su cuenta con
  el JWKS de auth-service (mismo middleware que backend: firma, `exp`, `iss`,
  `aud`, solo RS256). Con eso sabe *quién* es; después compara con el dueño del
  dispositivo para decidir si *puede*. Sin token o con token inválido es 401;
  identidad válida sin permiso es 403.
- **Dispositivos de proyecto.** Los proyectos viven en backend-db, que
  device-service no alcanza por red. Para decidir sobre un dispositivo de
  proyecto, device-service le pide `GET /proyectos/:id` a backend por la red
  `interna`, reenviando el mismo token del usuario. Esa consulta es sincrónica a
  propósito: para responder 200 o 403 hace falta la respuesta ahora. Si backend
  no responde, el resultado es 503 (no un 403 equivocado). Los dispositivos de
  usuario no dependen de backend.
- **Publicación.** device-service usa un canal con confirmaciones: el `publish`
  se da por hecho solo cuando RabbitMQ confirma que recibió el mensaje, y el
  mensaje va `persistent` a un exchange y una cola `durable`. device-service
  declara también la cola y su enlace, porque un exchange sin cola enlazada
  descarta los mensajes: así un evento no se pierde aunque notification-service
  todavía no haya arrancado nunca.
- **Consumidor.** notification-service consume con `prefetch(1)` y ack manual:
  el mensaje sale de la cola solo después de guardarse en notification-db. Si el
  proceso muere a la mitad, RabbitMQ lo vuelve a entregar.
- **Idempotencia.** `eventId` es `UNIQUE` en notification-db. No se pregunta
  antes "¿ya existe?": se intenta el `INSERT` y, si choca, es un repetido, se
  hace ack y se ignora. Así ni dos entregas simultáneas generan dos notificaciones.
- **Errores temporales.** Si notification-db falla, el mensaje pasa a
  `notification.events.retry`, una cola sin consumidores con TTL de 5 s que, al
  vencer, lo devuelve sola a `notification.events`. Tras 10 intentos, o si el
  mensaje es inválido (no es JSON o le faltan campos), queda en
  `notification.events.dlq` con el motivo en una cabecera, visible en el panel.
  Para mover un mensaje primero se copia a la otra cola y solo cuando RabbitMQ
  lo confirma se hace ack del original: en el peor caso llega repetido, y eso ya
  lo resuelve el `eventId`.
- **RabbitMQ con hostname fijo.** RabbitMQ guarda sus datos en una carpeta con
  el nombre del host. Sin `hostname: rabbitmq`, al recrear el contenedor cambia
  el nombre y las colas y mensajes pendientes "desaparecen" aunque el volumen
  siga ahí.
- **Bases.** device-db y notification-db tienen su propio usuario, con `SELECT`
  e `INSERT` solo sobre sus tablas (ni dispositivos ni notificaciones se editan).
  `ownerId` y `userId` no son claves foráneas porque usuarios y proyectos viven
  en otras bases.
- **notification-service sin API.** El enunciado lo permite. Su `GET /` en el
  puerto 4200 solo existe para el healthcheck de Docker (sano = conectado a
  RabbitMQ y consumiendo), y no se alcanza desde fuera ni desde el gateway.

### Limitación conocida

device-service guarda el dispositivo o la alerta en device-db y *después*
publica. Si RabbitMQ está caído en ese momento, la petición igual responde
201/202 (el dato ya quedó guardado), el error queda en el log y ese evento no
se publica; en la alerta, `eventId` vuelve en `null`. Garantizarlo exigiría un
patrón *outbox* (guardar el evento en la misma transacción y publicarlo
después), que quedó fuera del alcance del taller. Del lado del consumidor, en
cambio, ningún mensaje se pierde en silencio.

## Levantarlo y verificarlo

### 0. Levantar

Primero hay que **apagar el Taller 2 si está corriendo**: publica los mismos
puertos `8080`, `4000` y `5173`.

```bash
cd 02-id-gateway && docker compose stop && cd ../03-microservicios-eventos
docker compose down -v          # la primera vez: fuerza que corran los SQL de init
docker compose up --build -d    # si cambió package.json, agregar -V
docker compose ps               # 11 contenedores, servicios y bases "healthy"
```

MariaDB ejecuta sola los `.sql` de cada `*/init` la primera vez que arranca con
el volumen vacío, y auth-service genera su clave RSA si no existe. Las colas las
declaran device-service y notification-service al conectarse.

> Si cambias `notification-db/init` o `device-db/init` con las bases ya creadas,
> hace falta `docker compose down -v` para que se vuelvan a ejecutar. Eso
> también borra la clave RSA (`auth_keys`), así que los tokens anteriores dejan
> de servir.

### 1. La verificación completa: `verificar.sh`

```bash
bash scripts/verificar.sh       # Resultado: 43 OK, 0 fallas
```

Corre 43 comprobaciones e imprime `[OK]` o `[FALLA]` en cada una. Cubre los
cuatro requisitos, las cinco pruebas obligatorias, el reintento con
notification-db caída, la DLQ y que lo del Taller 2 se mantiene. Detiene y
vuelve a levantar notification-service y notification-db, registra dispositivos
con serial único y deja un mensaje inválido en la DLQ a propósito.

| Prueba obligatoria | Cómo la comprueba |
|---|---|
| 1. Registrar con JWT válido | `POST /api/devices` da 201 y aparece en notification-db una notificación `device.registered` de ese `deviceId` |
| 2. Ajeno -> 403, sin JWT -> 401 | Carlos pide el dispositivo de Ana (403), sin cabecera (401) |
| 3. Anomalía -> notificación | `POST /api/devices/:id/alerts` da 202 con un `eventId`, y ese `eventId` aparece en notification-db |
| 4. Consumidor detenido | `docker compose stop notification-service`, se reporta una alerta, la cola tiene el mensaje y no hay notificación; `start` y la notificación aparece |
| 5. Mismo `eventId` dos veces | Se toma el evento ya procesado de notification-db, se reenvía tal cual por la API del panel de RabbitMQ y sigue habiendo una sola notificación con ese `eventId` |

### 2. En el navegador

Abrir http://localhost:5173 e iniciar sesión como Ana. La pestaña
**Dispositivos** registra dispositivos (propios o de uno de sus proyectos),
reporta anomalías y consulta un dispositivo por id. Todas las peticiones van a
`localhost:8080/api/...`. Consultando por id un dispositivo de Ana desde la
sesión de Carlos se ve el 403 ("no tienes permiso sobre este dispositivo"), y la
sesión sigue abierta.

El panel de RabbitMQ está en http://localhost:15672 (usuario `eventos`,
contraseña `eventos123`). En **Exchanges -> device.events** se ve el enlace
`device.#` a `notification.events`. En **Queues** se ven las tres colas; con
notification-service detenido, cada alerta suma un mensaje en
`notification.events`.

### 3. Las pruebas a mano

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@hospital.cr","password":"clave123"}' | jq -r .accessToken)
TOKEN_CARLOS=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carlos@hospital.cr","password":"clave123"}' | jq -r .accessToken)
```

```bash
# 1. Registrar (201) y ver que se publicó device.registered
curl -i -X POST http://localhost:8080/api/devices -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"serial":"MON-001","nombre":"Monitor","ownerType":"user","ownerId":1}'
docker compose logs notification-service | tail -1    # [device.registered] ... -> notificacion registrada

# 2. Ajeno (403) y sin token (401)
curl -i http://localhost:8080/api/devices/1 -H "Authorization: Bearer $TOKEN_CARLOS"
curl -i http://localhost:8080/api/devices/1

# 3. Anomalía (202) -> notificación
curl -i -X POST http://localhost:8080/api/devices/1/alerts -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"level":"critical","message":"Frecuencia fuera de rango"}'

# 4. Con el consumidor detenido el evento espera en la cola
docker compose stop notification-service
curl -s -X POST http://localhost:8080/api/devices/1/alerts -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"level":"warning","message":"Con el consumidor apagado"}'
docker compose exec rabbitmq rabbitmqctl list_queues name messages   # notification.events 1
docker compose start notification-service                            # y se procesa al volver

# Las notificaciones registradas
docker compose exec notification-db mariadb -uroot -proot123 notificaciones \
  -e "SELECT eventId, type, deviceId, ownerType, ownerId, mensaje FROM Notificaciones"
```

La prueba 5 a mano: en el panel, **Exchanges -> device.events -> Publish
message**, routing key `device.alert.triggered`, y como payload el `payload` de
una notificación ya registrada. El log de notification-service dice
`repetido, ya estaba registrado (se ignora)` y la tabla no cambia.

## Herramientas usadas

- Docker Desktop + Docker Compose, VS Code, Git Bash, GitHub.
- RabbitMQ 3 con el plugin de administración (panel y API HTTP).
- Librerías: amqplib (publicar y consumir en Node), jose (verificación con
  JWKS), Sequelize + mysql2, Express, nginx, MariaDB.
- curl, `rabbitmqctl` y las DevTools del navegador para las verificaciones.

### Uso de IA

Usamos Claude como apoyo para proponer la estructura de cada servicio, el código
base y los comandos de prueba. Cada paso se probó con el sistema corriendo antes
de hacer commit. Puntos que revisamos y ajustamos:

- Un exchange sin cola enlazada descarta los mensajes. Por eso device-service
  declara también la cola y su enlace, y no depende de que notification-service
  haya arrancado antes.
- RabbitMQ guarda sus datos bajo el nombre del host. Se fijó
  `hostname: rabbitmq` para que recrear el contenedor no deje atrás las colas y
  los mensajes pendientes.
- Con notification-db caída, Sequelize espera por defecto un minuto antes de
  fallar. Se bajó a 5 s (`pool.acquire`) para que el mensaje pase rápido a
  reintento.
- La primera versión de device-service solo aceptaba `ownerType: "user"` y
  rechazaba los dispositivos de proyecto con 400. Se agregó la consulta del
  dueño a backend, con 503 cuando backend no responde, para no confundirlo con
  un 403.
- En `verificar.sh`, un body JSON escrito dentro de `"$(...)"` llegaba partido
  porque bash expandía las llaves. Se pasó el body por una variable.
