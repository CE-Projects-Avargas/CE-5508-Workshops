# Taller 3: Microservicios y eventos

CE5508 - Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes.

Este taller parte de la arquitectura obtenida al finalizar el Taller 2: frontend React, Nginx API Gateway, `auth-service` con JWT/JWKS, backend de proyectos y bases de datos separadas.

El objetivo del Taller 3 es agregar gestión de dispositivos, autorización por recurso y comunicación desacoplada mediante RabbitMQ.

## Arquitectura

```text
Frontend
   |
   v
Nginx API Gateway :8080
   |
   +--> /api/auth/*      --> auth-service --> auth-db
   |
   +--> /api/proyectos/* --> backend      --> backend-db
   |
   +--> /api/devices/*   --> device-service --> device-db
                                  |
                                  | publica eventos
                                  v
                               RabbitMQ
                                  |
                                  | consume
                                  v
                         notification-service
                                  |
                                  v
                          notification-db
```

El frontend mantiene una sola puerta de entrada:

```text
http://localhost:8080
```

## Componentes agregados en este taller

### `device-service`

Servicio independiente encargado de:

- registrar dispositivos;
- consultar dispositivos;
- validar autorización sobre cada dispositivo;
- publicar eventos al registrar dispositivos y reportar alertas.

Utiliza su propia base:

```text
device-db
```

### RabbitMQ

Se utiliza como broker de eventos para desacoplar al productor de los consumidores.

Exchange:

```text
devices.events
```

Tipo:

```text
topic
```

### `notification-service`

Consumidor independiente que:

- escucha eventos;
- registra cada evento procesado en `notification-db`;
- confirma los mensajes procesados con `ack`;
- reencola mensajes ante errores temporales;
- evita duplicados utilizando `eventId`.

No expone una API pública.

## Autenticación y autorización

Se mantiene la autenticación JWT/JWKS del Taller 2.

Cada petición protegida utiliza:

```text
Authorization: Bearer <accessToken>
```

Reglas:

```text
401 -> token ausente, inválido o expirado
403 -> identidad válida, pero sin permiso sobre el recurso
```

### Dispositivos pertenecientes a usuarios

Ejemplo:

```json
{
  "ownerType": "user",
  "ownerId": 1
}
```

`device-service` compara `ownerId` con el `sub` del JWT.

### Dispositivos pertenecientes a proyectos

Ejemplo:

```json
{
  "ownerType": "project",
  "ownerId": 1
}
```

`device-service` consulta al backend de proyectos:

```text
GET http://backend:4000/proyectos/:id
```

reenviando el mismo JWT.

El backend determina si el proyecto pertenece al usuario autenticado. De esta forma, `device-service` no accede directamente a `backend-db`.

## Contratos mínimos

### Registrar dispositivo

```text
POST /api/devices/
```

Body:

```json
{
  "serial": "DEV-001",
  "nombre": "Sensor UCI",
  "ownerType": "user",
  "ownerId": 1
}
```

Respuesta esperada:

```text
201 Created
```

Además se publica:

```text
device.registered
```

### Consultar dispositivo

```text
GET /api/devices/:id
```

Respuestas relevantes:

```text
200 -> dispositivo permitido
401 -> token ausente o inválido
403 -> usuario sin permiso
404 -> dispositivo inexistente
```

### Reportar anomalía

```text
POST /api/devices/:id/alerts
```

Body:

```json
{
  "level": "high",
  "message": "Temperatura fuera de rango"
}
```

Respuesta esperada:

```text
202 Accepted
```

Además se publica:

```text
device.alert.triggered
```

## Eventos

Eventos mínimos:

```text
device.registered
device.alert.triggered
```

Cada evento contiene al menos:

```text
eventId
type
occurredAt
deviceId
ownerType
ownerId
```

Ejemplo:

```json
{
  "eventId": "uuid",
  "type": "device.alert.triggered",
  "occurredAt": "2026-10-19T05:45:12.000Z",
  "deviceId": 1,
  "ownerType": "project",
  "ownerId": 1,
  "level": "high",
  "message": "Temperatura fuera de rango"
}
```

## Cola de notificaciones

La cola utilizada por `notification-service` es:

```text
notification.events
```

Está enlazada al exchange `devices.events` para recibir:

```text
device.registered
device.alert.triggered
```

### Confirmación y reintento

Después de procesar correctamente:

```text
ack
```

Ante un error temporal:

```text
nack(..., requeue=true)
```

Esto permite que el mensaje vuelva a estar disponible y evita que se pierda silenciosamente.

### Idempotencia

`event_id` es único en la tabla `Notifications`.

Si llega nuevamente el mismo `eventId`, el consumidor no genera una segunda notificación.

## Cómo levantar el sistema

Desde:

```text
CE-5508-Workshops/03-docker-rabbitmq
```

ejecutar:

```bash
docker compose up --build
```

En segundo plano:

```bash
docker compose up -d --build
```

Detener:

```bash
docker compose down
```

Detener y eliminar también los volúmenes:

```bash
docker compose down -v
```

También se verificó el sistema desde un entorno limpio mediante:

```bash
docker compose down -v
docker compose up --build
```

Las bases y servicios se reconstruyeron correctamente sin pasos manuales adicionales.

## Gestión de claves JWT/JWKS

`auth-service` genera automáticamente una clave RSA de 2048 bits cuando no existe ninguna.

Las claves se almacenan en el volumen Docker persistente `auth_keys_data`.

Para consultar las claves:

```bash
docker compose exec auth-service python jwt_keys.py list
```

Para rotar la clave activa:

```bash
docker compose exec auth-service python jwt_keys.py rotate
```

Las claves anteriores permanecen publicadas en JWKS para que los access tokens aún vigentes puedan seguir validándose.

## RabbitMQ Management

Interfaz:

```text
http://localhost:15672
```

Credenciales de desarrollo:

```text
usuario: rabbit
password: rabbit123
```

## Pruebas obligatorias verificadas

### 1. Registro de dispositivo

Con JWT válido:

```text
POST /api/devices/ -> 201
```

Se comprobó que:

- el dispositivo se guarda;
- se publica `device.registered`;
- `notification-service` registra posteriormente el evento.

### 2. Autorización por recurso

Se verificó:

```text
sin JWT                          -> 401
JWT válido + dispositivo ajeno  -> 403
dispositivo inexistente         -> 404
```

También se comprobó la autorización para dispositivos pertenecientes a proyectos:

```text
propietario del proyecto -> acceso permitido
otro usuario             -> 403
```

### 3. Reporte de anomalía

Se ejecutó:

```text
POST /api/devices/:id/alerts -> 202
```

Se publicó `device.alert.triggered` y `notification-service` registró la notificación.

### 4. Caída temporal del consumidor

Se detuvo:

```bash
docker compose stop notification-service
```

Después de generar un evento, RabbitMQ mostró:

```text
messages_ready = 1
consumers = 0
```

Al ejecutar:

```bash
docker compose start notification-service
```

el mensaje pendiente fue consumido y registrado.

### 5. Idempotencia

Se reenvió el mismo `eventId`.

El consumidor indicó:

```text
Evento duplicado ignorado
```

y la base mantuvo una sola fila para ese evento.

## Comandos útiles

Estado de la cola:

```bash
docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
```

Logs del consumidor:

```bash
docker compose logs notification-service --tail 30
```

Consultar notificaciones:

```bash
docker compose exec notification-db mariadb -u notification_user -pnotification123 notification_db -e "SELECT * FROM Notifications;"
```

Consultar dispositivos:

```bash
docker compose exec device-db mariadb -u device_user -pdevice123 device_db -e "SELECT * FROM Devices;"
```

## Decisiones técnicas

- `device-service` y `notification-service` en contenedores independientes.
- una base de datos propia por servicio.
- Nginx como única puerta de entrada del frontend.
- JWT/JWKS del Taller 2 mantenido para autenticación.
- autorización por recurso para usuarios y proyectos.
- RabbitMQ como broker desacoplado.
- exchange `topic`.
- cola durable y mensajes persistentes.
- `ack` después del procesamiento.
- `nack` con requeue ante errores temporales.
- idempotencia mediante `eventId`.
- comunicación entre contenedores por nombre de servicio Docker.
- las claves RSA de autenticación no se versionan y se almacenan en un volumen Docker persistente;
- la primera clave RSA se genera automáticamente durante el arranque si el llavero está vacío;
- la rotación utiliza un `kid` diferente por clave y JWKS conserva temporalmente las claves anteriores para validar access tokens vigentes.

## Herramientas utilizadas

- Docker Desktop
- Docker Compose
- Node.js
- Express
- Sequelize
- MariaDB
- RabbitMQ
- Nginx
- React + Vite
- JWT / JWKS
- Git / GitHub
- curl
- ChatGPT

### Uso de IA

ChatGPT se utilizó como apoyo para:

- análisis de requisitos;
- explicación y revisión de arquitectura;
- generación y revisión de código;
- depuración;
- diseño y ejecución de pruebas;
- revisión de configuración de Docker, Nginx y RabbitMQ;
- documentación.

Durante el desarrollo se corrigieron aspectos como el enrutamiento del gateway, inicialización de bases de datos, autorización por recurso, persistencia de mensajes e idempotencia.

La solución final fue probada localmente.
