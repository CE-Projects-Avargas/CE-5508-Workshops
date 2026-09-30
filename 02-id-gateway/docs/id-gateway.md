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

## Levantarlo

```bash
docker compose down -v          # solo la primera vez, para que corran los SQL de init
docker compose up --build -d
```

Usuarios de prueba (contraseña `clave123`): `ana@hospital.cr` (id 1, dueña de los
proyectos del seed) y `carlos@hospital.cr` (id 2).

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

## Cómo verificamos cada requisito

**Automático:** `bash scripts/verificar.sh` corre 31 comprobaciones de los cuatro
requisitos e imprime `[OK]` o `[FALLA]` en cada una (detiene auth-service unos
segundos para probar el 502). Termina con `Resultado: 31 OK, 0 fallas`.

**A mano:** los mismos chequeos, uno por uno. Se corrieron en Git Bash desde
`02-id-gateway/`. Para obtener un token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ana@hospital.cr","password":"clave123"}' | tr -d '\n ' | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

### Requisito 1: Separar servicios y bases

```bash
docker compose exec backend ping -c1 auth-db
# ping: bad address 'auth-db'            -> backend no llega a auth-db por red
docker compose exec auth-service python -c "import socket; socket.gethostbyname('backend-db')"
# socket.gaierror: Name or service not known
docker compose exec auth-db mariadb -uroot -proot123 -e "SELECT user FROM mysql.user WHERE user LIKE '%_user'"
# solo auth_user     -> en auth-db no existe usuario para backend
docker compose exec backend-db mariadb -uroot -proot123 -e "SELECT user FROM mysql.user WHERE user LIKE '%_user'"
# solo backend_user
```

### Requisito 2: Una sola puerta

```bash
curl -i http://localhost:8080/api/proyectos
# 401 {"error":"falta la cabecera Authorization (gateway)"}
curl -i -X OPTIONS http://localhost:8080/api/proyectos -H "Origin: http://localhost:5173"
# 204 + Access-Control-Allow-Origin: http://localhost:5173
docker compose stop auth-service
curl -i -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{}'
# 502 {"error":"servicio no disponible (502 desde el gateway)"}
docker compose start auth-service
curl -m 3 http://localhost:5001/auth/jwks
# sin respuesta: auth-service no está expuesto al host
```

En el navegador (DevTools > Network) todas las peticiones del frontend van a
`http://localhost:8080/api/...`. Con auth-service detenido, la pantalla de login
muestra "servicio no disponible (502 desde el gateway)".

### Requisito 3: Firma asimétrica y JWKS

```bash
curl http://localhost:8080/api/auth/jwks
# {"keys":[{"alg":"RS256","e":"AQAB","kid":"...","kty":"RSA","n":"...","use":"sig"}]}
```

- Pegando el access en jwt.io: cabecera `alg: RS256` y el `kid` (el mismo del
  JWKS); payload con `iss`, `aud`, `sub` y `exp` (exp - iat = 900 s).
- `docker compose exec auth-service ls //keys` muestra el `.pem`;
  `docker compose exec backend ls //keys` da "No such file or directory";
  `git status` no muestra ningún `.pem` (están en `.gitignore`).
- Un token de auth lo acepta backend: `GET /api/proyectos` con `$TOKEN` -> 200.
- Refresh: el primer uso da 200 con un par nuevo; reusar el mismo da 401 "refresh
  reutilizado" y además revoca el refresh nuevo. En `RefreshTokens` solo hay hashes
  de 64 caracteres, con `revocadoEn` y `motivo` en los usados.
- Logout: `POST /api/auth/logout` da 204 y después ese refresh da 401.
- Rotación: después de `rotar_clave.py` y reiniciar auth-service, el JWKS tiene dos
  `kid`; el token firmado con la clave vieja y el firmado con la nueva dan 200 en
  backend. (El token nuevo puede dar 401 durante los primeros 30 s por el
  `cooldownDuration` de jose; es intencional, evita que tokens con `kid`
  inventados obliguen a descargar el JWKS en cada petición.)
- Con auth-service detenido, backend sigue aceptando tokens: el JWKS está en caché
  y no le pregunta a auth en cada petición.

### Requisito 4: Defensa en profundidad

```bash
curl -i http://localhost:4000/proyectos
# 401 {"error":"token ausente"}
curl -i http://localhost:4000/proyectos -H "Authorization: Bearer $TOKEN"
# 200, igual que pasando por la puerta
curl -i http://localhost:8080/api/proyectos -H "Authorization: Bearer falso"
# 401 {"error":"token invalido"}  -> la puerta lo deja pasar, el backend lo rechaza
docker compose exec gateway wget -qO- http://backend:4000/proyectos
# wget: server returned error: HTTP/1.1 401 Unauthorized  -> también desde dentro de la red
```

**401 vs 403.** Carlos (token válido) intenta `DELETE /api/proyectos/1`, que es de
Ana, y recibe 403 "no eres el dueno de este proyecto"; su sesión sigue activa. Sin
token, con firma alterada o vencido, la respuesta es 401.

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
