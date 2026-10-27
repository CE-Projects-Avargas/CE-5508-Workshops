# Taller 3: Microservicios y eventos

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes, TEC.
Equipo Transformers-Enterprise (TE) · rama `TE-Develop`.

Enunciado completo en [`Guia_Estudiante_T3.pdf`](Guia_Estudiante_T3.pdf). Esta
guía sigue el orden del **entregable (punto 6 del enunciado)**:

1. [Sistema ejecutándose localmente con Docker Compose](#1-sistema-ejecutándose-localmente-con-docker-compose)
2. [Repositorio: servicios, configuración y dependencias](#2-repositorio-servicios-configuración-y-dependencias)
3. [Arquitectura, flujo de eventos y verificación de las cinco pruebas](#3-arquitectura-flujo-de-eventos-y-verificación-de-las-cinco-pruebas)
4. [Herramientas, uso de IA y decisiones técnicas](#4-herramientas-uso-de-ia-y-decisiones-técnicas)

## Cumplimiento del enunciado

Cada punto del enunciado, dónde se cumple y qué comprobación de
`scripts/verificar.sh` lo demuestra.

| Punto del enunciado | Dónde se cumple | Se comprueba con |
|---|---|---|
| RabbitMQ como broker, productor y consumidor solo por mensajes | servicio `rabbitmq`; `device-service/events.js` publica, `notification-service/consumidor.js` consume | Req 2 y Req 3 |
| Todo local con Docker Compose, incluido RabbitMQ y todas las bases | `docker-compose.yml`, 11 contenedores | Req 4 |
| **Contrato** `POST /api/devices` `{serial, nombre, ownerType, ownerId}` -> 201 | `device-service/routes/devices.js` | Req 1 |
| **Contrato** `GET /api/devices/:id` -> 200 / 401 / 403 / 404 | ídem | Req 1 |
| **Contrato** `POST /api/devices/:id/alerts` `{level, message}` -> 202 y publica `device.alert.triggered` | ídem | Req 2 |
| Eventos mínimos `device.registered` y `device.alert.triggered` con `eventId`, `type`, `occurredAt`, `deviceId` y referencia al usuario o proyecto | `device-service/events.js` | Req 2 |
| notification-service interno, sin API pública | fuera de la red `interna`, sin `ports` | Req 3 |
| **Req 1** device-service + device-db; dispositivo de un usuario o proyecto; 401 sin token o inválido, 403 sin permiso | `device-service/`, `device-db/init/` | Req 1 |
| **Req 2** publicar `device.registered` al registrar y `device.alert.triggered` al reportar | `device-service/routes/devices.js` | Req 2 |
| **Req 3** consumidor con ack, tolerante a repetidos por `eventId`, sin perder mensajes ante errores temporales | `notification-service/consumidor.js`, `notification-db/init/` | Req 3 |
| **Req 4** `docker compose up --build`, un contenedor por servicio, una base por servicio, nada en la nube | `docker-compose.yml` | Req 4 |
| La autenticación del Taller 2 se mantiene y el frontend habla con una sola puerta | `gateway/`, `auth-service/`, `frontend/` | "Lo del Taller 2 se mantiene" |
| **Prueba 1** registrar con JWT válido -> se guarda y se publica `device.registered` | | Req 1 + Req 2 |
| **Prueba 2** dispositivo ajeno -> 403; sin JWT -> 401 | | Req 1 |
| **Prueba 3** anomalía -> `device.alert.triggered` -> notificación registrada | | Req 2 |
| **Prueba 4** detener notification-service, generar un evento, reiniciarlo -> se procesa | | Req 3 |
| **Prueba 5** reenviar el mismo `eventId` -> sin notificación duplicada | | Req 3 |

---

## 1. Sistema ejecutándose localmente con Docker Compose

Primero hay que **apagar el Taller 2 si está corriendo**: publica los mismos
puertos `8080` y `5173`.

```bash
cd 02-id-gateway && docker compose stop && cd ../03-microservicios-eventos
docker compose down -v          # la primera vez: fuerza que corran los SQL de init
docker compose up --build -d    # si cambió package.json, agregar -V
docker compose ps               # 11 contenedores, servicios y bases "healthy"
```

MariaDB ejecuta sola los `.sql` de cada `*/init` la primera vez que arranca con
el volumen vacío, y auth-service genera su clave RSA si no existe. Las colas las
declaran device-service y notification-service al conectarse. No hay que correr
nada a mano ni depende de ningún servicio en la nube.

| Dirección | Qué es |
|---|---|
| http://localhost:8080/api | el gateway, la única puerta de la API |
| http://localhost:5173 | el frontend |
| http://localhost:15672 | panel de RabbitMQ (`eventos` / `eventos123`) |

Usuarios de prueba (contraseña `clave123`): `ana@hospital.cr` (id 1, dueña de los
tres proyectos del seed) y `carlos@hospital.cr` (id 2, sin proyectos). Los
dispositivos empiezan vacíos.

> Si cambias `notification-db/init` o `device-db/init` con las bases ya creadas,
> hace falta `docker compose down -v` para que se vuelvan a ejecutar. Eso
> también borra la clave RSA (`auth_keys`), así que los tokens anteriores dejan
> de servir.

---

## 2. Repositorio: servicios, configuración y dependencias

Los archivos marcados con ★ son los que cambiaron o nacieron en el Taller 3; el
resto viene igual del Taller 2.

```
03-microservicios-eventos/
├── docker-compose.yml          ★ 11 servicios, 7 redes, 6 volúmenes
├── .env.example                ★ referencia de todas las variables del stack
│
├── gateway/
│   ├── nginx.conf              ★ + /api/devices -> device-service
│   ├── cors.conf
│   └── exigir-token.conf
│
├── auth-service/               autenticación (Python + Flask), firma RS256 y JWKS
│
├── backend/                    API de proyectos (Node + Express)
│   ├── routes/proyectos.js     ★ + GET /proyectos/:id (device-service lo consulta)
│   └── ...
│
├── device-service/             ★ dispositivos y alertas (Node + Express)
│   ├── index.js                ★ arranque, /devices protegido con JWT
│   ├── middleware/auth.js      ★ verifica con JWKS (jose), igual que backend
│   ├── routes/devices.js       ★ endpoints y autorización por recurso (401/403/404)
│   ├── proyectos.js            ★ pregunta a backend el dueño de un proyecto
│   ├── events.js               ★ publica en RabbitMQ con confirmación del broker
│   ├── models/                 ★ Device.js, Alert.js
│   └── db.js, package.json, Dockerfile, .env.example
│
├── notification-service/       ★ consumidor de eventos (Node), sin API pública
│   ├── index.js                ★ arranque + GET / solo para el healthcheck
│   ├── consumidor.js           ★ ack manual, idempotencia, reintentos y DLQ
│   ├── models/Notificacion.js  ★
│   └── db.js, package.json, Dockerfile, .env.example
│
├── frontend/src/
│   ├── App.jsx                 ★ pestañas Proyectos / Dispositivos
│   ├── api.js                  ★ + llamadas a /devices
│   ├── pages/Dispositivos.jsx  ★ registrar, consultar por id, reportar alerta
│   └── ...
│
├── auth-db/init/, backend-db/init/   esquema, seed y usuario de cada base
├── device-db/init/             ★ Devices + Alerts, usuario device_user (SELECT, INSERT)
├── notification-db/init/       ★ Notificaciones (eventId UNIQUE), notification_user (SELECT, INSERT)
│
├── scripts/verificar.sh        ★ 44 comprobaciones en vivo: 4 requisitos y 5 pruebas obligatorias
└── docs/
    ├── microservicios-eventos.md  ★ esta guía
    └── Guia_Estudiante_T3.pdf     ★ enunciado del taller
```

### Dependencias

Cada servicio declara las suyas y se instalan al construir su imagen
(`docker compose up --build`); no hay que instalar nada en la máquina.

| Servicio | Imagen base | Dependencias |
|---|---|---|
| device-service | node:20-alpine | express, jose, amqplib, sequelize, mysql2 |
| notification-service | node:20-alpine | amqplib, sequelize, mysql2 |
| backend | node:20-alpine | express, jose, sequelize, mysql2, dotenv |
| auth-service | python:3.12-slim | Flask, PyJWT, cryptography, PyMySQL, python-dotenv |
| frontend | node:20-alpine | react, react-dom, vite |
| gateway | nginx:alpine | — |
| rabbitmq | rabbitmq:3-management | — |
| bases | mariadb:11 | — |

### Configuración

Los valores están en `docker-compose.yml` para que `docker compose up --build`
funcione en un clon limpio; `.env.example` (y uno por servicio) los documenta.
Las variables nuevas del Taller 3:

| Variable | Servicio | Para qué |
|---|---|---|
| `RABBITMQ_URL` | device-service, notification-service | conexión al broker por la red `mensajeria` |
| `BACKEND_URL` | device-service | preguntar el dueño de un proyecto |
| `MAX_INTENTOS` | notification-service | intentos ante un error temporal antes de la DLQ (10) |
| `DB_*` | device-service, notification-service | su propia base y su propio usuario |

---

## 3. Arquitectura, flujo de eventos y verificación de las cinco pruebas

### Arquitectura

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
| backend | Node 20 + Express + jose | interna, datos-backend | no |
| device-service | Node 20 + Express + jose + amqplib | interna, datos-device, mensajeria | no |
| notification-service | Node 20 + amqplib | datos-notification, mensajeria | no |
| rabbitmq | rabbitmq:3-management | mensajeria | 15672 (panel web) |
| auth-db, backend-db, device-db, notification-db | mariadb:11 | cada una en su red `datos-*` | no |
| frontend | Node 20 + Vite/React | borde | 5173 |

Once contenedores, siete redes y seis volúmenes, todo local. A la API solo se
entra por el gateway. Cada servicio tiene su propia base y solo comparte red con
lo que necesita: notification-service no está en la red `interna` (nadie le
habla por HTTP), backend no está en `mensajeria` (ni publica ni consume) y
ningún servicio alcanza la base de otro.

### Contratos (por la puerta)

| Ruta | Método | Contrato |
|---|---|---|
| `/api/devices` | POST | `{serial, nombre, ownerType, ownerId}` -> 201 y publica `device.registered` |
| `/api/devices/:id` | GET | 200 si tiene permiso; 401 sin token o token inválido, 403 si es ajeno, 404 si no existe |
| `/api/devices/:id/alerts` | POST | `{level, message}` -> 202 y publica `device.alert.triggered` |
| `/api/devices` | GET | Extra: los dispositivos propios y los de proyectos propios (lo usa el frontend) |
| `/api/proyectos/:id` | GET | Extra: un proyecto con su `ownerId` (lo usa device-service) |

Todo exige `Authorization: Bearer <token>`. Los endpoints de `/api/auth/*` y
`/api/proyectos` siguen igual que en el Taller 2. `level` es `info`, `warning` o
`critical`; `message` tiene como máximo 500 caracteres.

**Quién puede qué.** Un dispositivo con `ownerType: "user"` es de ese usuario.
Uno con `ownerType: "project"` es de un proyecto, y lo puede ver y modificar el
dueño del proyecto. Al registrar:

- `ownerType: "user"`: `ownerId` puede omitirse; si viene y no es el usuario del token, 403.
- `ownerType: "project"`: `ownerId` es el id del proyecto. Si no existe, 400; si no es tuyo, 403.
- Serial repetido: 409.

### Flujo de eventos

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
`serial` y el `nombre`. notification-service guarda una fila por evento en
`Notificaciones` con un texto legible y el evento completo en `payload`.

### Cómo verificamos las cinco pruebas

**Todo de un tiro** (Git Bash o Linux, con el sistema levantado):

```bash
bash scripts/verificar.sh       # Resultado: 44 OK, 0 fallas
```

Corre 44 comprobaciones e imprime `[OK]` o `[FALLA]` en cada una, agrupadas por
requisito. Además de las cinco pruebas cubre el reintento con notification-db
caída, la DLQ, el aislamiento de redes y bases, y que lo del Taller 2 se
mantiene. Detiene y vuelve a levantar notification-service y notification-db,
registra dispositivos con serial único y deja un mensaje inválido en la DLQ a
propósito, así que se puede correr varias veces.

| Prueba obligatoria | Cómo la comprueba |
|---|---|
| 1. Registrar con JWT válido | `POST /api/devices` da 201 y aparece en notification-db una notificación `device.registered` de ese `deviceId` |
| 2. Ajeno -> 403, sin JWT -> 401 | Carlos pide el dispositivo de Ana (403), sin cabecera (401) |
| 3. Anomalía -> notificación | `POST /api/devices/:id/alerts` da 202 con un `eventId`, y ese `eventId` aparece en notification-db |
| 4. Consumidor detenido | `docker compose stop notification-service`, se reporta una alerta, la cola tiene el mensaje y no hay notificación; `start` y la notificación aparece |
| 5. Mismo `eventId` dos veces | Se toma el evento ya procesado de notification-db, se reenvía tal cual por la API del panel de RabbitMQ y sigue habiendo una sola notificación con ese `eventId` |

**A mano**, para mostrarlo en la defensa:

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

Prueba 5 a mano: en el panel, **Exchanges -> device.events -> Publish
message**, routing key `device.alert.triggered`, y como payload el `payload` de
una notificación ya registrada. El log de notification-service dice
`repetido, ya estaba registrado (se ignora)` y la tabla no cambia.

**En el navegador.** En http://localhost:5173, como Ana, la pestaña
**Dispositivos** registra dispositivos (propios o de uno de sus proyectos),
reporta anomalías y consulta un dispositivo por id. Todas las peticiones van a
`localhost:8080/api/...`. Consultando por id un dispositivo de Ana desde la
sesión de Carlos se ve el 403 ("no tienes permiso sobre este dispositivo"), y la
sesión sigue abierta. En el panel de RabbitMQ, **Exchanges -> device.events**
muestra el enlace `device.#` a `notification.events`, y en **Queues**, con
notification-service detenido, cada alerta suma un mensaje en
`notification.events`.

---

## 4. Herramientas, uso de IA y decisiones técnicas

### Herramientas

- Docker Desktop + Docker Compose, VS Code, Git Bash, GitHub.
- RabbitMQ 3 con el plugin de administración (panel y API HTTP).
- Librerías: amqplib (publicar y consumir en Node), jose (verificación con
  JWKS), Sequelize + mysql2, Express, nginx, MariaDB.
- curl, jq, `rabbitmqctl` y las DevTools del navegador para las verificaciones.

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

### Decisiones técnicas

- **RabbitMQ con exchange topic.** device-service publica en el exchange
  `device.events` con el tipo del evento como routing key, sin saber quién
  consume. La cola `notification.events` se enlaza con `device.#`; otro
  consumidor futuro solo necesitaría su propia cola enlazada al mismo exchange.
- **Autorización por recurso.** device-service verifica el JWT por su cuenta con
  el JWKS de auth-service (mismo middleware que backend: firma, `exp`, `iss`,
  `aud`, solo RS256). Con eso sabe *quién* es; después compara con el dueño del
  dispositivo para decidir si *puede*. Sin token o con token inválido es 401;
  identidad válida sin permiso es 403.
- **Dispositivos de proyecto.** Los proyectos viven en backend-db, que
  device-service no alcanza por red. Para decidir sobre un dispositivo de
  proyecto, device-service le pide `GET /proyectos/:id` a backend por la red
  `interna`, reenviando el mismo token del usuario. Esa consulta es sincrónica a
  propósito: para responder 200 o 403 hace falta la respuesta ahora. Lo que
  ocurre *después* de un suceso (notificar) sí va desacoplado por RabbitMQ. Si
  backend no responde, el resultado es 503, no un 403 equivocado. Los
  dispositivos de usuario no dependen de backend.
- **Publicación confirmada.** device-service usa un canal con confirmaciones: el
  `publish` se da por hecho solo cuando RabbitMQ confirma que recibió el
  mensaje, y el mensaje va `persistent` a un exchange y una cola `durable`.
- **Ack manual.** notification-service consume con `prefetch(1)` y ack manual:
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
- **Bases.** device-db y notification-db tienen su propio usuario, con `SELECT`
  e `INSERT` solo sobre sus tablas (ni dispositivos ni notificaciones se editan).
  `ownerId` y `userId` no son claves foráneas porque usuarios y proyectos viven
  en otras bases.
- **notification-service sin API.** El enunciado lo permite. Su `GET /` en el
  puerto 4200 solo existe para el healthcheck de Docker (sano = conectado a
  RabbitMQ y consumiendo), y no se alcanza desde fuera ni desde el gateway.
- **Una sola puerta.** Ningún servicio publica puertos al host salvo el gateway,
  el frontend y el panel de RabbitMQ. Cada servicio igual verifica el token por
  su cuenta, se llegue por donde se llegue.

### Limitación conocida

device-service guarda el dispositivo o la alerta en device-db y *después*
publica. Si RabbitMQ está caído en ese momento, la petición igual responde
201/202 (el dato ya quedó guardado), el error queda en el log y ese evento no
se publica; en la alerta, `eventId` vuelve en `null`. Garantizarlo exigiría un
patrón *outbox* (guardar el evento en la misma transacción y publicarlo
después), que quedó fuera del alcance del taller. Del lado del consumidor, en
cambio, ningún mensaje se pierde en silencio.
