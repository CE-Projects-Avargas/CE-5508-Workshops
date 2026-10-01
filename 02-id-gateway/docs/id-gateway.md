# Taller 2: Identidad y la puerta de entrada

CE5508 · Arquitectura Orientada a Servicios aplicada a Sistemas Emergentes, TEC.
Equipo Transformers-Enterprise (TE) · rama `TE/hn/auth-db`.

Enunciado completo en [`Guia_Estudiante_T2.pdf`](Guia_Estudiante_T2.pdf).

## Arquitectura

```
navegador --> gateway :8080 --+--> auth-service :5001 --> auth-db     (red datos-auth)
                              +--> backend      :4000 --> backend-db  (red datos-backend)
```

| Servicio | Imagen | Redes | Expuesto al host |
|---|---|---|---|
| gateway | nginx:alpine | borde, interna | 8080 |
| auth-service | Python 3.12 + Flask + PyJWT | interna, datos-auth | no |
| backend | Node 20 + Express + jose | interna, datos-backend | 4000 (a propósito, para probar el Req 4) |
| auth-db | mariadb:11 | datos-auth | no |
| backend-db | mariadb:11 | datos-backend | no |
| frontend | Node 20 + Vite/React | borde | 5173 |

Un contenedor por servicio, cada uno con su propia imagen. auth-service y backend
tienen `healthcheck`, y el gateway no arranca hasta que los dos estén sanos.

## Estructura del proyecto

Estado final del taller. Los archivos marcados con ★ son los que cambiaron o
nacieron en el Taller 2; el resto viene del Taller 1.

```
02-id-gateway/
├── docker-compose.yml          ★ 6 servicios, 4 redes, 3 volúmenes
├── .env.example                ★ referencia de variables (ya sin JWT_SECRET)
│
├── gateway/                    ★ la puerta, nueva en este taller
│   ├── nginx.conf              ★ enrutamiento /api/auth/* y /api/*, 502, rutas públicas
│   ├── cors.conf               ★ CORS en un solo lugar + preflight + proxy_set_header
│   └── exigir-token.conf       ★ exige que exista Authorization (no verifica firma)
│
├── auth-service/               autenticación (Python + Flask)
│   ├── app.py                  ★ register, login, refresh, logout, me, jwks
│   ├── claves.py               ★ genera/carga claves RSA, kid, arma el JWKS
│   ├── rotar_clave.py          ★ agrega una clave nueva (rotación)
│   ├── db.py                   conexión a auth-db
│   ├── requirements.txt        ★ + cryptography, ya sin flask-cors
│   └── Dockerfile
│
├── backend/                    API de proyectos (Node + Express)
│   ├── index.js                ★ sin cors() ni sequelize.sync()
│   ├── middleware/auth.js      ★ verifica con JWKS (jose): firma, exp, iss, aud
│   ├── routes/proyectos.js     ★ dueño desde el token, 403 si no es dueño
│   ├── models/Proyecto.js      ★ + ownerId
│   ├── db.js                   conexión a backend-db
│   ├── package.json            ★ + jose, ya sin jsonwebtoken ni cors
│   └── Dockerfile
│
├── frontend/                   interfaz web (React + Vite)
│   └── src/
│       ├── auth.js             ★ una sola URL, refresh rotado, logout real
│       ├── api.js              ★ reintento único tras 401, no cierra sesión en 403
│       ├── App.jsx, main.jsx, index.css
│       └── pages/              Login.jsx, NuevoProyecto.jsx
│
├── auth-db/init/               ★ base exclusiva de auth-service
│   ├── 01-schema.sql           ★ Usuarios + RefreshTokens (hash, revocadoEn, motivo)
│   ├── 02-seed.sql             ★ ana@hospital.cr (id 1), carlos@hospital.cr (id 2)
│   └── 03-permisos.sql         ★ auth_user, solo sobre sus dos tablas
│
├── backend-db/init/            ★ base exclusiva de backend
│   ├── 01-schema.sql           ★ Proyectos (con ownerId, sin FK a Usuarios)
│   ├── 02-seed.sql             ★ 3 proyectos de ejemplo
│   └── 03-permisos.sql         ★ backend_user, solo sobre Proyectos
│
├── scripts/verificar.sh        ★ 31 comprobaciones en vivo de los 4 requisitos
└── docs/
    ├── id-gateway.md           ★ esta guía
    └── Guia_Estudiante_T2.pdf  enunciado del taller
```

Lo que **ya no existe** respecto al Taller 1: la carpeta `database/` (se partió en
`auth-db/` y `backend-db/`), el `JWT_SECRET` compartido, `flask-cors` en
auth-service y `cors` + `jsonwebtoken` en backend. Las claves RSA no están en el
repositorio: viven en el volumen `auth_keys`.

Usuarios de prueba (contraseña `clave123`): `ana@hospital.cr` (id 1, dueña de los
proyectos del seed) y `carlos@hospital.cr` (id 2). Cómo levantarlo, más abajo en
[Levantarlo y verificarlo](#levantarlo-y-verificarlo).

## Endpoints (por la puerta)

| Ruta | Método | Contrato |
|---|---|---|
| `/api/auth/register` | POST | `{email, password, nombre}` -> 201, o 409 si el correo existe |
| `/api/auth/login` | POST | `{email, password}` -> `{accessToken, refreshToken, expiresIn}`, o 401 |
| `/api/auth/refresh` | POST | `{refreshToken}` -> par nuevo; el anterior deja de servir |
| `/api/auth/jwks` | GET | Público. JSON Web Key Set vigente |
| `/api/auth/logout` | POST | Bearer + `{refreshToken}` -> 204; revoca ese refresh |
| `/api/auth/me` | GET | Bearer. Datos del usuario del token |
| `/api/proyectos` | GET, POST | Bearer. POST toma el dueño del token, no del body |
| `/api/proyectos/:id` | DELETE | Bearer. 403 si el usuario no es el dueño |

Cabecera siempre `Authorization: Bearer <token>`. Las cuatro primeras rutas son
públicas; todo lo demás exige token.

## Decisiones de implementación

- **Firma asimétrica.** auth-service genera un par RSA de 2048 bits al arrancar
  (si no existe) y lo guarda en el volumen `auth_keys`, montado solo en
  auth-service. Firma con RS256 y pone el `kid` en la cabecera del token.
  `GET /auth/jwks` publica solo la parte pública (`kty, kid, use, alg, n, e`).
- **Rotación.** `python rotar_clave.py` agrega una clave nueva. Se firma con la más
  nueva y el JWKS publica todas, así que los tokens viejos siguen siendo válidos.
- **Access y refresh.** El access es un JWT de 15 min con `iss`, `aud`, `sub` y
  `exp`. El refresh es una cadena aleatoria de 8 h; en `auth-db` se guarda solo su
  SHA-256. Un `UPDATE ... WHERE revocadoEn IS NULL` lo verifica e invalida en una
  sola sentencia, así que cada refresh sirve una sola vez. La columna `motivo`
  guarda por qué se revocó (`rotado`, `logout` o `reuso`).
- **Detección de reúso.** Si llega un refresh que ya se había rotado, lo más
  probable es que alguien lo robó: auth-service revoca todos los refresh vigentes
  de ese usuario y responde 401 "refresh reutilizado". El frontend nunca reusa un
  refresh (comparte un único refresh entre peticiones simultáneas), así que esto
  solo pasa con un token filtrado.
- **Logout real.** "Cerrar sesión" llama a `/api/auth/logout`, que revoca el
  refresh en auth-db; antes solo se borraba localStorage y el refresh seguía
  sirviendo 8 h. Solo se puede revocar un refresh del mismo usuario del access.
- **Backend.** `jose.createRemoteJWKSet` descarga el JWKS una vez y lo cachea en
  memoria. Si llega un `kid` desconocido lo vuelve a pedir, como máximo una vez
  cada 30 s (`cooldownDuration`). `jwtVerify` comprueba firma, `exp`, `iss` y
  `aud`, y solo acepta RS256. No se confía en ninguna cabecera tipo `X-User-Id`.
- **Gateway.** Enruta por prefijo con `rewrite` explícito (`/api/auth/x` ->
  `/auth/x`, `/api/x` -> `/x`), resuelve CORS (preflight incluido) y exige que
  exista `Authorization` en todo lo que no sea register, login, refresh o jwks.
  No verifica firmas. Resuelve los nombres de los servicios por petición, así que
  si auth-service está caído responde 502 en JSON.
- **Frontend.** Conoce una sola URL (`http://localhost:8080/api`). Ante un 401
  llama a `/api/auth/refresh`, guarda el par nuevo y reintenta una vez; si varias
  peticiones reciben 401 a la vez comparten un único refresh.
- **Bases.** Cada servicio entra con su propio usuario y `GRANT` solo sobre sus
  tablas. `Proyectos.ownerId` ya no es clave foránea porque el usuario vive en
  otra base; esa garantía pasa al código.


## Levantarlo y verificarlo

### 0. Levantar

Primero hay que **apagar el Taller 1 si está corriendo**: publica los mismos
puertos `4000` y `5173`, así que el Taller 2 no arranca hasta liberarlos.

```bash
cd 01-docker-login && docker compose stop && cd ../02-id-gateway
docker compose down -v          # la primera vez: fuerza que corran los SQL de init
docker compose up --build -d    # si cambió package.json, agregar -V
docker compose ps               # 6 contenedores; auth-service y backend "healthy"
```

No hay que correr ningún seed a mano: MariaDB ejecuta sola los `.sql` de
`auth-db/init` y `backend-db/init` la primera vez que arranca con el volumen
vacío, y auth-service genera su clave RSA al arrancar si no existe. Al terminar
esto ya hay usuarios, proyectos de ejemplo y claves.

> **Si el arranque falla a mitad** (por ejemplo por un puerto ocupado), no
> alcanza con repetir `docker compose up -d`: el contenedor queda creado a
> medias con una configuración de red incompleta, el gateway no lo resuelve y
> responde 502. Hay que recrearlo con `docker compose down && docker compose up -d`.
>
> **Y cuidado con `down -v` después del primer arranque:** borra también el
> volumen `auth_keys`, así que auth-service genera una clave nueva y todos los
> tokens emitidos antes quedan inválidos (su `kid` ya no está en el JWKS). Para
> reiniciar sin perder claves ni sesiones, `docker compose restart`.

### 1. La verificación completa: `verificar.sh`

```bash
bash scripts/verificar.sh       # Resultado: 31 OK, 0 fallas
```

Corre 31 comprobaciones de los cuatro requisitos e imprime `[OK]` o `[FALLA]` en
cada una: aislamiento de red y de usuarios de base, el 401 del gateway, el
preflight CORS, el 502 con auth caído (lo detiene y lo vuelve a levantar), el
JWKS con `kid` y RS256, el `expiresIn` de 900 s, la rotación de refresh con
detección de reúso, el logout, el acceso directo al `:4000` y el 403 por no ser
dueño. **Si esto da 31 OK, los cuatro requisitos están cumplidos.**

Lo que sigue es para *mostrarlo* en la defensa, no para volver a validarlo.

### 2. En el navegador

Abrir http://localhost:5173 con las DevTools en la pestaña **Network**. Usuarios
de prueba: `ana@hospital.cr` y `carlos@hospital.cr`, contraseña `clave123`.

| Qué hacer | Qué se ve |
|---|---|
| Iniciar sesión | Todas las peticiones van a `localhost:8080/api/...` — nunca a `:5001` ni a `:4000`. El frontend conoce una sola dirección (Req 2) |
| Crear un proyecto | Queda con el usuario de la sesión como dueño, aunque el body no lo diga: sale del token |
| Entrar como Carlos y mirar los proyectos de Ana | No aparece el botón *Eliminar*: la interfaz solo lo muestra en los propios. Que el backend igual responda 403 si alguien llama al DELETE a mano es el Req 4, abajo |
| Cerrar sesión | Llama a `/api/auth/logout`, que revoca el refresh en `auth-db` — no solo borra el navegador |
| `docker compose stop auth-service` y volver a entrar | La pantalla de login dice "servicio no disponible (502 desde el gateway)", no un error de conexión del navegador (Req 2) |

En **Almacenamiento local** (DevTools → *Application* en Chrome, *Almacenamiento*
en Firefox) la clave `ce5508_sesion` guarda `accessToken`, `refreshToken` y
`usuario`. Pegando el access en [jwt.io](https://jwt.io) se ve la cabecera con
`alg: RS256` y el `kid`, y el payload con `iss`, `aud`, `sub` y `exp`
(`exp - iat = 900`, los 15 min) — eso es el Req 3 a la vista.

Para ver el refresh automático, estropear el token en la Console y recargar:

```js
const s = JSON.parse(localStorage.ce5508_sesion);
s.accessToken = s.accessToken.slice(0, -3) + 'xxx';
localStorage.ce5508_sesion = JSON.stringify(s);
location.reload();
```

La sesión **no** se cae: el 401 dispara `/api/auth/refresh` y el storage queda con
un par nuevo. Si en cambio se *borra* el token, vuelve al login — sin token
`verificarSesion()` corta antes de intentar renovar.

### 3. Lo que el navegador no puede mostrar

**Requisito 1 — las bases están separadas.** En Docker Desktop se ven los dos
contenedores de base (`auth-db` y `backend-db`) como procesos distintos, cada uno
con su volumen. Que además estén aislados por red se ve pidiéndole a un servicio
que resuelva la base del otro:

```bash
docker compose exec auth-service python -c "import socket; socket.gethostbyname('backend-db')"
# socket.gaierror: [Errno -2] Name or service not known
```

Ese error **es el resultado esperado**, no una falla: auth-service no está en la
red `datos-backend`, así que para él el nombre `backend-db` no existe. Lo mismo al
revés con `docker compose exec backend ping -c1 auth-db`.

**Requisito 3 — la clave privada vive en un solo lugar.**

```bash
docker compose exec auth-service ls //keys   # el .pem está aquí
docker compose exec backend      ls //keys   # y solo aquí: "No such file or directory"
git ls-files | grep '\.pem$'                 # vacío: ninguna clave en el repo
```

Rotar la clave sin invalidar los tokens que ya están circulando:

```bash
docker compose exec auth-service python rotar_clave.py
docker compose restart auth-service
curl -s http://localhost:8080/api/auth/jwks   # ahora el JWKS publica dos kid
```

Un token emitido **antes** de rotar sigue dando 200, porque el JWKS publica la
clave vieja además de la nueva. (Un token con el `kid` nuevo puede dar 401 durante
los primeros 30 s por el `cooldownDuration` de jose; es intencional — evita que
tokens con `kid` inventados obliguen a descargar el JWKS en cada petición.)

**Requisito 4 — defensa en profundidad.** Acá sí hace falta curl: el navegador
nunca llama al `:4000` directo, solo conoce el `:8080`. Para tener un token a
mano:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@hospital.cr","password":"clave123"}' | jq -r .accessToken)
```

```bash
curl -i http://localhost:4000/proyectos                           # 401: sin token, saltándose la puerta
curl -i http://localhost:4000/proyectos -H "Authorization: Bearer $TOKEN"     # 200: igual que por la puerta
curl -i http://localhost:8080/api/proyectos -H "Authorization: Bearer falso"  # 401: la puerta lo pasa, el backend lo rechaza
curl -i http://localhost:4000/proyectos -H "X-User-Id: 1"         # 401: no confía en cabeceras inyectadas
```

El último es el punto fino del requisito: el backend no delega en nadie. La puerta
solo exige que la cabecera `Authorization` exista; quien comprueba firma, `exp`,
`iss` y `aud` es el backend, se llegue por donde se llegue.

**401 vs 403.** Con el token de Carlos, borrar un proyecto de Ana da 403 y su
sesión sigue viva — identidad válida, permiso insuficiente. Sin token, con firma
alterada o vencido, es 401. (Un `id` que no existe da 404, no 403; conviene tomar
un id real de `GET /api/proyectos` para no confundirlos.)

## Herramientas usadas

- Docker Desktop + Docker Compose, VS Code, Git Bash, GitHub.
- Librerías: PyJWT + cryptography (firma y JWKS en Python), jose (verificación con
  JWKS en Node), nginx (gateway), MariaDB.
- curl, jwt.io y las DevTools del navegador para las verificaciones.

### Uso de IA

Usamos Claude como guía paso a paso: propuso la estructura de cada paso, el código
base y los comandos de prueba. Cada paso se probó antes de hacer commit (un commit
por paso). Lo que tuvimos que corregir o ajustar:

- El `sed` para sacar el token del JSON no funcionaba porque Flask devolvía el JSON
  en varias líneas; se agregó `tr -d '\n '` antes.
- En Git Bash, `ls /keys` se convertía en `C:/Program Files/Git/keys`; hubo que
  usar `//keys`.
- Con `backend_user` sin permiso de CREATE, `sequelize.sync()` tumbaba el backend;
  se quitó y el esquema quedó solo en los SQL de init.
- Tras cambiar `package.json`, el volumen anónimo de `node_modules` conservaba las
  dependencias viejas; hubo que levantar con `docker compose up --build -d -V`.
- La primera prueba de rotación dio 401 con el token nuevo por el `cooldownDuration`
  de 30 s de jose; se dejó así a propósito (ver Requisito 3).
- Nos aseguramos de que la verificación incluyera `iss`, `aud` y `exp` además de la
  firma, y de limitar `algorithms` a RS256.
- En la detección de reúso, la primera versión trataba igual un refresh revocado por
  logout que uno ya rotado, y cerraba todas las sesiones al presentar un refresh de
  una sesión ya cerrada. Se agregó la columna `motivo` para distinguirlos.
