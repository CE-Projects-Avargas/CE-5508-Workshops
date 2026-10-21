# Talleres 1, 2 y 3 — Plataforma de monitoreo de dispositivos médicos

CE5508 - Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes.

Este directorio contiene la evolución acumulativa de los Talleres 1, 2 y 3. El sistema comenzó con Docker + Login, luego incorporó identidad con JWT/JWKS y un API Gateway, y finalmente agregó autorización por recurso, RabbitMQ y un consumidor de eventos.

## 1. Evolución por taller

### Taller 1 — Docker + Login

Objetivos principales:

- levantar el sistema localmente con Docker Compose;
- mantener frontend, backend y base de datos funcionando;
- implementar `auth-service` como contenedor independiente;
- permitir registro y login de usuarios;
- conectar el login del frontend con `auth-service`;
- permitir el acceso a la pantalla de proyectos únicamente después de un login válido;
- declarar las herramientas utilizadas, incluida IA, y poder explicar la implementación.

En este punto, `auth-service` y `backend` eran servicios separados, pero todavía compartían la misma base de datos.

### Taller 2 — Identidad y puerta de entrada

Cambios principales:

- `auth-service` y `backend` tienen bases de datos separadas;
- se agrega Nginx como API Gateway;
- el frontend utiliza una sola URL: `http://localhost:8080`;
- `auth-service` firma access tokens con RSA;
- la clave privada permanece únicamente en `auth-service`;
- la clave pública se expone mediante JWKS;
- `backend` valida localmente firma y claims del JWT;
- se validan `iss`, `aud`, `exp` y firma;
- el JWKS se mantiene en caché;
- se utilizan access tokens cortos y refresh tokens;
- los refresh tokens se almacenan como hash y se rotan;
- se diferencia entre `401 Unauthorized` y `403 Forbidden`;
- el backend sigue validando el JWT incluso si se accede directamente a su puerto interno.

Arquitectura al terminar el Taller 2:

```text
navegador -> gateway :8080 --+--> auth-service --> auth-db
                             +--> backend      --> backend-db
```

### Taller 3 — Microservicios y eventos

El Taller 3 mantiene la autenticación del Taller 2 y agrega:

- `device-service` con su propia base de datos;
- autorización por recurso;
- dispositivos pertenecientes a usuarios o proyectos;
- RabbitMQ como broker;
- eventos `device.registered` y `device.alert.triggered`;
- `notification-service` como consumidor independiente;
- confirmación de mensajes procesados;
- reintento ante errores temporales;
- idempotencia mediante `eventId`;
- `/api/devices/*` a través del gateway.

Arquitectura final:

```text
Frontend
   |
   v
Nginx Gateway :8080
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

## 2. Servicios

| Servicio | Puerto local | Responsabilidad |
|---|---:|---|
| `frontend` | 5173 | Interfaz React + Vite |
| `gateway` | 8080 | Punto único de entrada a las APIs |
| `auth-service` | 5000 | Registro, login, refresh y JWKS |
| `backend` | 4000 | Gestión y autorización de proyectos |
| `device-service` | 6000 | Gestión y autorización de dispositivos |
| `rabbitmq` | 5672 | Broker AMQP |
| RabbitMQ Management | 15672 | Interfaz web del broker |
| `notification-service` | interno | Consume eventos y registra notificaciones |
| `auth-db` | interno | Usuarios y refresh tokens |
| `backend-db` | interno | Proyectos |
| `device-db` | interno | Dispositivos |
| `notification-db` | interno | Notificaciones |

## 3. API Gateway

El frontend utiliza una sola dirección:

```text
http://localhost:8080
```

Enrutamiento principal:

```text
/api/auth/*       -> auth-service
/api/proyectos/*  -> backend
/api/devices/*    -> device-service
```

El gateway centraliza CORS y exige la presencia del header `Authorization` en las rutas protegidas, pero no valida la firma del JWT. La validación real del JWT se realiza dentro de cada servicio protegido.

## 4. Autenticación JWT/JWKS

Cada petición protegida utiliza:

```text
Authorization: Bearer <accessToken>
```

`auth-service` firma los tokens usando RSA. Los servicios validan firma, `iss`, `aud`, `exp`, algoritmo `RS256` y `kid`. La clave pública se obtiene desde JWKS y se mantiene en caché.

Los refresh tokens se almacenan como hash, tienen una duración mayor al access token, se rotan al utilizarlos y dejan de ser válidos después de la rotación.

```text
401 -> token ausente, inválido o expirado
403 -> identidad válida, pero sin permiso sobre el recurso
```

## 5. Clave privada

La clave privada RSA no se almacena en Git.

Debe existir localmente:

```text
secrets/private.pem
```

Ejemplo:

```bash
mkdir -p secrets
openssl genrsa -out secrets/private.pem 2048
```

La clave se monta únicamente en `auth-service` y en modo lectura.

## 6. Autorización por recurso

### Dispositivo perteneciente a usuario

Para `ownerType: "user"`, `device-service` compara `ownerId` con el `sub` del JWT.

### Dispositivo perteneciente a proyecto

Para `ownerType: "project"`, `device-service` consulta:

```text
GET http://backend:4000/proyectos/:id
```

reenviando el mismo JWT. El backend comprueba que el proyecto pertenezca al usuario autenticado. `device-service` no accede directamente a `backend-db`.

## 7. Endpoints

### Autenticación

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/jwks
```

### Proyectos

```text
GET  /api/proyectos
GET  /api/proyectos/:id
POST /api/proyectos
```

Los proyectos quedan asociados automáticamente al usuario autenticado mediante `usuarioId`.

### Dispositivos

```text
POST /api/devices/
GET  /api/devices/:id
POST /api/devices/:id/alerts
```

Registro:

```json
{
  "serial": "DEV-001",
  "nombre": "Sensor UCI",
  "ownerType": "user",
  "ownerId": 1
}
```

Alerta:

```json
{
  "level": "high",
  "message": "Temperatura fuera de rango"
}
```

## 8. Eventos y RabbitMQ

Exchange:

```text
devices.events
```

Tipo:

```text
topic
```

Eventos mínimos:

```text
device.registered
device.alert.triggered
```

Cada evento incluye al menos:

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

## 9. Notification service

`notification-service` consume la cola `notification.events`, enlazada al exchange `devices.events`.

Comportamiento:

- procesa el mensaje;
- registra la notificación;
- ejecuta `ack` únicamente después de procesarla;
- ante error temporal ejecuta `nack(..., requeue=true)`;
- evita duplicados usando `eventId`.

La columna `event_id` es única en `Notifications`.

## 10. Cómo levantar el sistema

Requiere Docker Desktop.

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

Detener y borrar volúmenes:

```bash
docker compose down -v
```

También se verificó el sistema desde cero utilizando:

```bash
docker compose down -v
docker compose up --build
```

Las bases y servicios se reconstruyeron correctamente sin pasos manuales adicionales.

## 11. RabbitMQ Management

```text
http://localhost:15672
```

Credenciales de desarrollo:

```text
usuario: rabbit
password: rabbit123
```

## 12. Verificación de requisitos del Taller 2

### Separación de servicios y bases

- `auth-service` utiliza únicamente `auth-db`;
- `backend` utiliza únicamente `backend-db`;
- ningún servicio accede directamente a la base de datos del otro.

### Una sola puerta

El frontend conoce únicamente:

```text
http://localhost:8080
```

### Firma asimétrica y JWKS

- la privada existe únicamente en `auth-service`;
- el JWKS expone la pública;
- los servicios protegidos validan localmente los JWT;
- no se utiliza un secreto JWT compartido.

### Defensa en profundidad

Aunque se llame directamente a:

```text
http://localhost:4000
http://localhost:6000
```

las rutas protegidas siguen exigiendo un JWT válido.

## 13. Pruebas obligatorias del Taller 3

### 1. Registrar dispositivo

```text
POST /api/devices/ -> 201
```

Se guarda el dispositivo y se publica `device.registered`.

### 2. Autorización

```text
sin JWT                         -> 401
JWT válido + dispositivo ajeno -> 403
dispositivo inexistente        -> 404
```

También se verificó autorización para dispositivos pertenecientes a proyectos.

### 3. Reportar anomalía

```text
POST /api/devices/:id/alerts -> 202
```

Se publica `device.alert.triggered` y `notification-service` registra la notificación.

### 4. Caída temporal del consumidor

Se detuvo:

```bash
docker compose stop notification-service
```

Después de generar un evento:

```text
messages_ready = 1
consumers = 0
```

Al levantar nuevamente:

```bash
docker compose start notification-service
```

el evento pendiente fue procesado.

### 5. Idempotencia

Se publicó nuevamente un evento con el mismo `eventId`.

Resultado:

```text
Evento duplicado ignorado
```

La base mantuvo una sola notificación para ese evento.

## 14. Comandos útiles

Estado de colas:

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

## 15. Decisiones técnicas

- Docker Compose para despliegue local.
- Un contenedor por servicio.
- Una base de datos por servicio a partir del Taller 2.
- Nginx como API Gateway.
- JWT con firma RSA asimétrica.
- JWKS para distribuir únicamente la clave pública.
- Validación local de JWT en los servicios.
- Caché de JWKS.
- Access tokens cortos y refresh tokens rotados.
- Gateway como única puerta del frontend.
- Defensa en profundidad dentro de cada servicio.
- RabbitMQ como broker desacoplado.
- Exchange `topic`.
- Cola durable y mensajes persistentes.
- `ack` posterior al procesamiento.
- `nack` con requeue ante errores temporales.
- Idempotencia mediante `eventId`.
- Autorización por usuario o proyecto.
- Comunicación por nombre de servicio Docker en lugar de IP fija.
- La clave privada nunca se versiona.

## 16. Herramientas utilizadas

- Docker Desktop
- Docker Compose
- Node.js
- Express
- Sequelize
- MariaDB
- RabbitMQ
- Nginx
- React + Vite
- JWT
- JWKS
- Git / GitHub
- curl
- ChatGPT

### Uso de IA

ChatGPT se utilizó como apoyo para análisis de requisitos, explicación de arquitectura, generación y revisión de código, depuración de errores, diseño y ejecución de pruebas, revisión de configuración Docker/Nginx/RabbitMQ y documentación.

Durante el desarrollo se revisaron y corrigieron distintos puntos de la solución, entre ellos configuración de rutas del gateway, inicialización de bases de datos, autorización por recurso y pruebas de persistencia e idempotencia.

La solución final fue probada localmente.
