#!/usr/bin/env bash
# CE5508 Taller 2: verificacion en vivo de los 4 requisitos.
#
# Uso (Git Bash o Linux, con el sistema levantado):
#     cd 02-id-gateway
#     bash scripts/verificar.sh
#
# Detiene auth-service unos segundos para probar el 502 y lo vuelve a levantar.
# Crea y borra un proyecto de prueba. No toca las claves RSA.

cd "$(dirname "$0")/.." || exit 1
export MSYS_NO_PATHCONV=1          # Git Bash: que no traduzca /keys a C:/Program Files/Git/keys

GW=http://localhost:8080/api
BACKEND=http://localhost:4000
OK=0
FALLAS=0

ok()     { echo "  [OK]    $1"; OK=$((OK + 1)); }
falla()  { echo "  [FALLA] $1  (obtenido: $2)"; FALLAS=$((FALLAS + 1)); }
igual()  { if [ "$2" = "$3" ]; then ok "$1"; else falla "$1" "$3"; fi; }
titulo() { echo; echo "== $1"; }

codigo() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
campo()  { tr -d '\n ' | sed -nE "s/.*\"$1\":\"?([^\",}]*)\"?.*/\1/p"; }
json()   { curl -s -H "Content-Type: application/json" "$@"; }
login()  { json -X POST "$GW/auth/login" -d "{\"email\":\"$1\",\"password\":\"clave123\"}"; }
dc()     { docker compose exec -T "$@"; }

esperar_auth() {
  for _ in $(seq 1 30); do
    [ "$(codigo "$GW/auth/jwks")" = "200" ] && return 0
    sleep 2
  done
  return 1
}

if [ "$(codigo "$GW/auth/jwks")" != "200" ]; then
  echo "El sistema no responde en $GW. Levantalo con: docker compose up --build -d"
  exit 1
fi

SESION=$(login ana@hospital.cr)
TOKEN=$(echo "$SESION" | campo accessToken)
REFRESH=$(echo "$SESION" | campo refreshToken)
TOKEN_CARLOS=$(login carlos@hospital.cr | campo accessToken)

# ---------------------------------------------------------------------------
titulo "Requisito 1: servicios y bases separados"

if dc backend ping -c1 -W1 auth-db >/dev/null 2>&1; then
  falla "backend NO alcanza auth-db por red" "si la alcanza"
else
  ok "backend NO alcanza auth-db por red"
fi
if dc backend ping -c1 -W1 backend-db >/dev/null 2>&1; then
  ok "backend si alcanza su propia base (backend-db)"
else
  falla "backend si alcanza su propia base (backend-db)" "no la alcanza"
fi
if dc auth-service python -c "import socket; socket.gethostbyname('backend-db')" >/dev/null 2>&1; then
  falla "auth-service NO alcanza backend-db por red" "si la alcanza"
else
  ok "auth-service NO alcanza backend-db por red"
fi
USUARIOS_AUTH=$(dc auth-db mariadb -uroot -proot123 -N -e "SELECT GROUP_CONCAT(user) FROM mysql.user WHERE user LIKE '%_user'" 2>/dev/null | tr -d '\r')
igual "auth-db solo tiene el usuario auth_user" "auth_user" "$USUARIOS_AUTH"
USUARIOS_BACK=$(dc backend-db mariadb -uroot -proot123 -N -e "SELECT GROUP_CONCAT(user) FROM mysql.user WHERE user LIKE '%_user'" 2>/dev/null | tr -d '\r')
igual "backend-db solo tiene el usuario backend_user" "backend_user" "$USUARIOS_BACK"

# ---------------------------------------------------------------------------
titulo "Requisito 2: una sola puerta"

igual "sin cabecera Authorization la puerta responde 401" "401" "$(codigo "$GW/proyectos")"
PREFLIGHT=$(curl -s -i -X OPTIONS "$GW/proyectos" -H "Origin: http://localhost:5173" | tr -d '\r')
if echo "$PREFLIGHT" | grep -q "^HTTP/1.1 204" && echo "$PREFLIGHT" | grep -qi "^access-control-allow-origin: http://localhost:5173"; then
  ok "preflight CORS resuelto en la puerta (204 + Allow-Origin)"
else
  falla "preflight CORS resuelto en la puerta (204 + Allow-Origin)" "$(echo "$PREFLIGHT" | head -1)"
fi
igual "auth-service no esta expuesto al host (:5001)" "000" "$(codigo -m 3 http://localhost:5001/)"

echo "  ...deteniendo auth-service para probar el 502"
docker compose stop auth-service >/dev/null 2>&1
igual "con auth caido, login responde 502 desde la puerta" "502" \
  "$(codigo -X POST "$GW/auth/login" -H "Content-Type: application/json" -d '{}')"
docker compose start auth-service >/dev/null 2>&1
if esperar_auth; then ok "auth-service volvio a levantar"; else falla "auth-service volvio a levantar" "no responde"; fi

# ---------------------------------------------------------------------------
titulo "Requisito 3: firma asimetrica y JWKS"

JWKS=$(curl -s "$GW/auth/jwks")
if echo "$JWKS" | grep -q '"alg":"RS256"' && echo "$JWKS" | grep -q '"kid"'; then
  ok "JWKS publico con claves RS256 y kid"
else
  falla "JWKS publico con claves RS256 y kid" "$JWKS"
fi
igual "login entrega expiresIn de 900 s (15 min)" "900" "$(echo "$SESION" | campo expiresIn)"

CABECERA=$(echo "${TOKEN%%.*}" | tr '_-' '/+')
while [ $(( ${#CABECERA} % 4 )) -ne 0 ]; do CABECERA="$CABECERA="; done
CABECERA=$(echo "$CABECERA" | base64 -d 2>/dev/null)
KID=$(echo "$CABECERA" | campo kid)
igual "el access va firmado con RS256" "RS256" "$(echo "$CABECERA" | campo alg)"
if [ -n "$KID" ] && echo "$JWKS" | grep -q "\"kid\":\"$KID\""; then
  ok "el kid del token ($KID) esta en el JWKS"
else
  falla "el kid del token esta en el JWKS" "$KID"
fi

igual "backend acepta un token emitido por auth" "200" "$(codigo "$GW/proyectos" -H "Authorization: Bearer $TOKEN")"
igual "token con la firma alterada -> 401" "401" "$(codigo "$GW/proyectos" -H "Authorization: Bearer ${TOKEN}x")"

if dc auth-service sh -c 'ls /keys/*.pem' >/dev/null 2>&1; then
  ok "la clave privada existe dentro de auth-service"
else
  falla "la clave privada existe dentro de auth-service" "no hay .pem en /keys"
fi
if dc backend ls /keys >/dev/null 2>&1; then
  falla "backend NO tiene la clave privada" "backend tiene /keys"
else
  ok "backend NO tiene la clave privada"
fi
igual "ningun .pem esta en el repositorio" "" "$(git ls-files | grep '\.pem$')"

NUEVO=$(json -X POST "$GW/auth/refresh" -d "{\"refreshToken\":\"$REFRESH\"}")
REFRESH_NUEVO=$(echo "$NUEVO" | campo refreshToken)
if [ -n "$REFRESH_NUEVO" ]; then ok "refresh valido entrega un par nuevo"; else falla "refresh valido entrega un par nuevo" "$NUEVO"; fi
igual "reusar el refresh ya usado -> 401" "401" \
  "$(codigo -X POST "$GW/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")"
igual "tras el reuso, el refresh nuevo tambien quedo revocado -> 401" "401" \
  "$(codigo -X POST "$GW/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH_NUEVO\"}")"

SESION2=$(login ana@hospital.cr)
igual "logout -> 204" "204" "$(codigo -X POST "$GW/auth/logout" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(echo "$SESION2" | campo accessToken)" \
  -d "{\"refreshToken\":\"$(echo "$SESION2" | campo refreshToken)\"}")"
igual "el refresh de una sesion cerrada ya no sirve -> 401" "401" \
  "$(codigo -X POST "$GW/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$(echo "$SESION2" | campo refreshToken)\"}")"

# ---------------------------------------------------------------------------
titulo "Requisito 4: defensa en profundidad"

igual "directo a backend:4000 sin token -> 401" "401" "$(codigo "$BACKEND/proyectos")"
igual "directo a backend:4000 con token -> 200 (igual que por la puerta)" "200" \
  "$(codigo "$BACKEND/proyectos" -H "Authorization: Bearer $TOKEN")"
if curl -s "$GW/proyectos" -H "Authorization: Bearer falso" | grep -q "token invalido"; then
  ok "la puerta deja pasar un token falso y el backend lo rechaza"
else
  falla "la puerta deja pasar un token falso y el backend lo rechaza" "otra respuesta"
fi
if dc gateway wget -q -O /dev/null http://backend:4000/proyectos >/dev/null 2>&1; then
  falla "desde dentro de la red, backend exige token" "respondio sin token"
else
  ok "desde dentro de la red, backend exige token"
fi

CREADO=$(json -X POST "$GW/proyectos" -H "Authorization: Bearer $TOKEN" -d '{"nombre":"Prueba verificar.sh","encargado":"Ana","ownerId":99}')
ID=$(echo "$CREADO" | campo id)
igual "el dueno sale del token, no del body (ownerId 1)" "1" "$(echo "$CREADO" | campo ownerId)"
igual "Carlos (identidad valida, no es dueno) borra proyecto de Ana -> 403" "403" \
  "$(codigo -X DELETE "$GW/proyectos/$ID" -H "Authorization: Bearer $TOKEN_CARLOS")"
igual "Ana borra su propio proyecto -> 204" "204" \
  "$(codigo -X DELETE "$GW/proyectos/$ID" -H "Authorization: Bearer $TOKEN")"

# ---------------------------------------------------------------------------
echo
echo "Resultado: $OK OK, $FALLAS fallas"
[ "$FALLAS" -eq 0 ]
