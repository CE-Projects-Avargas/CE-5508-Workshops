# Taller 3: Microservicios y eventos

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes,
Tecnológico de Costa Rica.

Sobre la base del Taller 2 (gateway, JWT con JWKS y una base por servicio) se
agregan `device-service`, que registra dispositivos con autorización por
recurso, y `notification-service`, que reacciona a sus eventos a través de
RabbitMQ sin ninguna llamada HTTP entre los dos. Todo corre local con Docker
Compose.

## Estructura

```
03-microservicios-eventos/
├── docker-compose.yml       11 servicios, redes, volúmenes y variables
├── gateway/                 nginx: enrutamiento, CORS y exigencia de cabecera
├── auth-service/            autenticación (Python + Flask + PyJWT), firma RS256, JWKS
├── backend/                 API de proyectos (Node + Express + jose)
├── device-service/          dispositivos y alertas, publica eventos (Node + Express + amqplib)
├── notification-service/    consume eventos y registra notificaciones (Node + amqplib)
├── frontend/                interfaz web (React + Vite), habla solo con el gateway
├── auth-db/init/            SQL de auth-db: Usuarios, RefreshTokens, auth_user
├── backend-db/init/         SQL de backend-db: Proyectos, backend_user
├── device-db/init/          SQL de device-db: Devices, Alerts, device_user
├── notification-db/init/    SQL de notification-db: Notificaciones, notification_user
├── scripts/                 verificar.sh: prueba en vivo los 4 requisitos y las 5 pruebas
└── docs/                    guía (microservicios-eventos.md) y enunciado
```

## Levantarlo

```bash
docker compose down -v      # la primera vez, para que corran los SQL de init
docker compose up --build -d
```

Todo entra por http://localhost:8080 (frontend en http://localhost:5173, panel de
RabbitMQ en http://localhost:15672 con `eventos` / `eventos123`). Si el Taller 2
está corriendo, hay que detenerlo antes: usa los mismos puertos.

Para comprobar los 4 requisitos y las 5 pruebas obligatorias de un tiro (Git
Bash o Linux):

```bash
bash scripts/verificar.sh
```

Usuarios de prueba: `ana@hospital.cr` y `carlos@hospital.cr`, contraseña `clave123`.

Arquitectura, flujo de eventos, decisiones y cómo se verificó cada prueba en
[`docs/microservicios-eventos.md`](docs/microservicios-eventos.md).
