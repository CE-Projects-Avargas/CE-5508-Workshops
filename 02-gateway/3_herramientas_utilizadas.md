# 3. Herramientas utilizadas

## Docker y Docker Compose

Se utilizó Docker para ejecutar los diferentes componentes del sistema
en contenedores independientes.

Docker Compose se utilizó para definir y levantar los servicios del
proyecto de forma conjunta mediante:

``` bash
docker compose up --build
```

También se utilizaron comandos de Docker para revisar el estado de las
imágenes y contenedores:

``` bash
docker images
docker ps
docker compose ps
```

Cuando fue necesario revisar problemas de ejecución se utilizaron los
logs:

``` bash
docker compose logs <servicio>
```

## Docker Desktop

Docker Desktop se utilizó como apoyo visual para comprobar el estado de
los contenedores y verificar cuáles servicios estaban ejecutándose.

También permitió revisar de forma más sencilla el estado general del
entorno mientras se realizaban las pruebas.

## Git y GitHub

Se utilizó Git para controlar los cambios realizados durante el
desarrollo y GitHub como repositorio del proyecto.

El historial de commits permitió identificar los cambios realizados por
cada integrante y mantener separadas las diferentes partes del
desarrollo.

## Inteligencia Artificial

Se utilizó ChatGPT como herramienta de apoyo durante el desarrollo.

### ¿Para qué se utilizó?

Principalmente para:

-   Comprender la arquitectura propuesta para el taller.
-   Analizar la separación entre `auth-service`, `backend`, `auth-db` y
    `backend-db`.
-   Entender el funcionamiento de JWT, RSA, JWKS y el middleware de
    autenticación.
-   Planificar las tareas correspondientes a la Persona 2.
-   Analizar posibles problemas relacionados con Docker Compose, Nginx y
    la comunicación entre contenedores.
-   Organizar las comprobaciones y las pruebas necesarias para la
    entrega.
-   Resolver dudas puntuales sobre comandos de Docker y la estructura de
    los servicios.

La IA se utilizó como apoyo para comprender y planificar el trabajo, no
como sustituto de la revisión del código.

## Revisión y corrección de lo generado por IA

El contenido generado con IA fue tratado como una propuesta inicial y se
contrastó con la estructura real del proyecto.

Durante este proceso se corrigieron o ajustaron aspectos cuando no
coincidían exactamente con el proyecto. Por ejemplo:

-   Se diferenciaron las responsabilidades de `auth-service`, `backend`
    y `gateway`.
-   Se adaptaron las recomendaciones a los nombres y puertos utilizados
    realmente en Docker Compose.
-   Se verificó que la arquitectura propuesta coincidiera con el reparto
    de responsabilidades del taller.
-   Se evitó asumir que una ruta como `/api` debía mostrar la interfaz;
    se distinguió entre la ruta principal del gateway y las rutas de
    API.
-   Se priorizó revisar el estado real de los contenedores y sus logs
    antes de realizar cambios en la configuración.

La revisión manual fue necesaria para entender qué hacía cada cambio y
evitar incorporar código o configuraciones que el equipo no pudiera
explicar durante la demostración.

## Resumen

Las herramientas principales fueron:

| Herramienta | Uso |
| --- | --- |
| Docker | Ejecución de servicios en contenedores |
| Docker Compose | Orquestación de los servicios |
| Docker Desktop | Revisión visual de contenedores |
| Git | Control de versiones |
| GitHub | Repositorio y seguimiento de cambios |
| ChatGPT | Apoyo conceptual, planificación y resolución de dudas |
