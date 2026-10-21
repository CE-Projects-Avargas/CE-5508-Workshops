# CE5508 - Talleres

Repositorio de talleres prácticos del curso CE5508 (Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes), Tecnológico de Costa Rica.

Cada carpeta corresponde a un taller y contiene su propio `README.md`, código, configuración y, cuando aplica, un `docker-compose.yml` para levantar el sistema localmente.

## Talleres

| Carpeta | Tema |
|---|---|
| [`01-docker-login`](01-docker-login/) | Docker + Docker Compose, frontend React, backend Node/Express, MariaDB y servicio independiente de registro/login |
| [`02-docker-gateway`](02-docker-gateway/) | Identidad con JWT/JWKS, firma RSA, refresh tokens, bases separadas y Nginx API Gateway |
| [`03-docker-rabbitmq`](03-docker-rabbitmq/) | Autorización por recurso, `device-service`, RabbitMQ, eventos y `notification-service` |

## Cómo usar este repositorio

```bash
git clone git@github.com:CE-Projects-Avargas/CE-5508-Workshops.git
cd CE-5508-Workshops/<carpeta-del-taller>
```

Luego sigue el `README.md` de la carpeta correspondiente.

Cada taller debe poder ejecutarse y demostrarse de forma independiente según las instrucciones incluidas en su directorio.
