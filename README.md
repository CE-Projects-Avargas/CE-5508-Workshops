# CE5508 - Talleres

Repositorio de talleres prácticos del curso CE5508 (Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes), Tecnológico de Costa Rica.

Cada carpeta es un taller independiente y funciona como una fotografía del progreso del curso a esa fecha: trae su propio `README.md` con una vista general y su propia carpeta `docs/` con la guía completa, una base de código funcional (o parcialmente funcional, con TODOs) y, cuando aplica, un `docker-compose.yml` para levantar todo con un solo comando.

## Estructura

```
CE-5508-Workshops/
├── 01-docker-login/    Taller 1 — auth y proyectos como dos APIs con una base compartida
│   ├── README.md       vista general y cómo levantarlo
│   └── docs/           guía completa (docker-login.md)
│
└── 02-id-gateway/      Taller 2 — puerta única, bases separadas y JWKS
    ├── README.md       vista general y cómo levantarlo
    └── docs/           guía completa (id-gateway.md)
```

## Talleres

| Carpeta | Estado |
|---|---|
| [`01-docker-login`](01-docker-login/) | Docker + Docker Compose, API REST con Node/Express/Sequelize, servicio de autenticación en Python/Flask, MariaDB, sesiones con JWT. Completo. |
| [`02-id-gateway`](02-id-gateway/) | Gateway nginx como única puerta (`:8080`), una base de datos por servicio en redes separadas, firma asimétrica RS256 con JWKS y rotación de claves, access de 15 min con refresh rotado, y validación independiente en el backend. Completo. |

## Cómo usar este repositorio

```bash
git clone git@github.com:CE-Projects-Avargas/CE-5508-Workshops.git
cd CE-5508-Workshops/<carpeta-del-taller>
```

Luego sigue el `README.md` de esa carpeta, que redirige a la guía completa en su `docs/`.
