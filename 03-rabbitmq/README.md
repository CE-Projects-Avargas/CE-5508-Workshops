# Taller 3 Microservicios y eventos

CE5508 · Maryuri Reyes, Mauro Navarro y Melina Porras

El sistema registra dispositivos, autoriza el acceso por usuario o proyecto y publica eventos con RabbitMQ. Un consumidor independiente guarda notificaciones de alertas sin duplicarlas por `eventId`. Las cinco pruebas obligatorias se verificaron con salidas de terminal.

## Componentes

| Componente | Función |
| --- | --- |
| auth-service / auth-db | Usuarios, JWT RS256, JWKS y refresh tokens |
| backend / operacion-db | Proyectos y comprobación de propiedad |
| device-service / device-db | Dispositivos, autorización y Outbox |
| RabbitMQ | Exchange y colas persistentes |
| notification-service / notification-db | Alertas, notificaciones, ACK y deduplicación |
| Nginx / frontend | Entrada de APIs e interfaz heredada de proyectos |

El servicio de bombas se conserva como componente heredado; no es parte del flujo mínimo de eventos. Notificaciones no expone API pública.

## Ejecución

Desde `03-rabbitmq`, con Docker Desktop activo:

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Detener antes los contenedores de otros talleres que ocupen los mismos puertos. No detener indiscriminadamente otros proyectos. `docker compose down` conserva datos; `docker compose down -v` elimina los volúmenes.

| Acceso local | Dirección |
| --- | --- |
| Frontend de proyectos | http://localhost:5173 |
| API | http://localhost:8080/api |
| Administración RabbitMQ | http://localhost:15672 |

RabbitMQ usa las credenciales locales `taller3` / `taller3_pass`. La raíz del gateway no está configurada para servir React. Las bases y el consumidor se comunican por redes de Docker. Los scripts SQL se ejecutan al inicializar volúmenes vacíos; editar un script no migra una base existente.

## Contratos y permisos

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| POST /api/devices | serial, nombre, ownerType, ownerId | 201, dispositivo y evento pendiente |
| GET /api/devices/:id | Bearer token | 200, 401, 403 o 404 según identidad y permiso |
| POST /api/devices/:id/alerts | level, message | 202 y eventId de alerta aceptada |

Las rutas exigen `Authorization: Bearer <accessToken>`. `ownerType` admite `user` y `project`. El dueño usuario se compara con `sub`; para proyectos se consulta al backend con el JWT y se verifica el propietario. Se admiten niveles `info`, `warning` y `critical`. Datos inválidos producen 400; serial duplicado, 409; imposibilidad de verificar el proyecto por un fallo del backend, 503.

## Flujo de eventos

1. La API valida identidad, permiso y datos.
2. El registro del dispositivo y `device.registered` se guardan en una transacción. Las alertas se guardan como `device.alert.triggered` en Outbox.
3. El despachador publica los pendientes y marca `publishedAt` después del publisher confirm.
4. `device.events` enruta `device.registered` a `registrations.queue` y `device.alert.triggered` a `alerts.queue`.
5. Notificaciones valida la alerta, inserta la fila y envía ACK. Un `eventId` ya existente se confirma sin insertar otra fila.

Cada evento incluye `eventId`, `type`, `occurredAt`, `deviceId`, `ownerType`, `ownerId`, `usuarioId` y `data`. El productor no llama por HTTP al consumidor. Una respuesta 202 no significa que ya se haya guardado la notificación.

Las colas y el exchange son durables; los mensajes son persistentes y RabbitMQ utiliza `rabbitmq_data`, hostname `rabbitmq` e identidad `rabbit@rabbitmq`. La topología del publicador se prepara cuando necesita publicar; el consumidor también declara el exchange y su cola al iniciar. Los registros quedan sin consumidor por ahora.

## Consumidor y fallos

`notification-service` utiliza `amqplib`, `mysql2`, `prefetch(1)` y ACK manual. `notifications.Notifications` tiene `eventId` único y conserva dispositivo, dueño, usuario, nivel, mensaje y fechas. `notification_user` tiene SELECT e INSERT. `notification_data` conserva su base.

Un fallo de almacenamiento devuelve el mensaje a la cola después de cinco segundos. Los mensajes inválidos se conservan en `alerts.rejected.queue`; se confirma la copia antes del ACK original. Las conexiones se reintentan. Los errores persistentes de almacenamiento requieren revisar los logs; no hay límite de intentos implementado.

Outbox puede reenviar un evento si falla el marcado después de publicar. La restricción única evita duplicar la notificación; no se promete entrega exactamente una vez ni envío externo de correos o SMS.

## Cinco pruebas obligatorias verificadas

| Prueba | Resultado observado |
| --- | --- |
| 1 Registro con JWT | Dispositivo 1, evento de registro y publishedAt con fecha; mensaje en registrations.queue |
| 2 Autorización | Sin token: 401; Carlos sobre dispositivo de Ana: 403; Ana: 200 |
| 3 Alerta | Respuesta de API, log y fila SQL con el mismo eventId |
| 4 Consumidor apagado | 1 pendiente, 0 consumidores y 0 notificaciones; al reiniciar se guardó |
| 5 Duplicado | Se republicó el mismo evento, se detectó duplicado, conteo en 1 y cola sin pendientes ni entregas sin confirmar |

Identificadores observados:

- Registro: `68dd4205-6a21-4c01-867e-b8388db05b74`.
- Alerta inicial: `35294c9e-5972-4f8e-8370-878bd9f9415a`.
- Recuperación del consumidor y duplicado: `14c24363-2555-4a54-985f-92bf68e96b0c`.

Para reproducir la deduplicación, usar un eventId de alerta ya procesado: comprobar COUNT(*)=1, marcar únicamente su Outbox con `publishedAt=NULL`, esperar la republicación y comprobar de nuevo COUNT(*)=1, log de duplicado y cola vacía. Es una modificación controlada para pruebas; un POST nuevo genera otro eventId.

## Recuperación del broker verificada

Se detuvo RabbitMQ, se aceptó la alerta `f706afee-291c-4d3b-91ed-5a3511090653` y Outbox quedó con `publishedAt=NULL`; el conteo de notificaciones era 0. Después de iniciar RabbitMQ, se publicó y guardó sin reiniciar manualmente productor ni consumidor. `publishedAt` quedó en `2026-10-18 17:15:03.662`.

Los errores DNS y ECONNREFUSED durante la caída y el arranque precedieron la reconexión. El documento parcial registra también persistencia al recrear el contenedor conservando el volumen; esa recreación no se repitió en esta sesión con notificaciones integrado.

## Comandos de inspección

```powershell
docker compose logs --tail=50 device-service notification-service
docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
docker compose exec notification-db mariadb -unotification_user -pnotification_pass notifications -e "SELECT id, eventId, deviceId, level, message FROM Notifications ORDER BY id DESC LIMIT 10;"
docker compose exec device-db mariadb -udevice_user -pdevice_pass devices -e "SELECT eventId, publishedAt FROM Outbox ORDER BY createdAt DESC LIMIT 10;"
```

Pruebas unitarias existentes del servicio de dispositivos, desde esta carpeta con Node:

```powershell
node --test device-service/test/*.test.js
```

Esas pruebas de lógica no sustituyen las pruebas de integración. Los resultados de integración descritos arriba proceden de la ejecución del equipo y las salidas compartidas en terminal.

## Herramientas y decisiones

Se utilizaron Docker, Docker Compose, Docker Desktop, Node.js, MariaDB, RabbitMQ, PowerShell, curl.exe y Git. ChatGPT apoyó el análisis, el código del consumidor, la preparación de comandos y la documentación; el equipo ejecutó las pruebas y revisó las salidas.

Se eligieron bases propias, autorización por recurso, Outbox, publisher confirms, persistencia, ACK posterior al guardado e idempotencia por eventId. No se implementaron una interfaz de dispositivos, un consumidor de registros ni correo o SMS reales.

Mejoras pendientes de robustez: tiempos máximos y manejo de conexiones antiguas del publicador, preparación anticipada de su topología y protección del endpoint de rotación de claves accesible por el puerto directo de autenticación. Estas mejoras no se presentan como realizadas.
