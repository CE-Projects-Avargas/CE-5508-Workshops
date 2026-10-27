#!/usr/bin/env bash
# CE5508 Taller 3: verificacion en vivo de los 4 requisitos y las 5 pruebas
# obligatorias del enunciado.
#
# Uso (Git Bash o Linux, con el sistema levantado):
#     cd 03-microservicios-eventos
#     bash scripts/verificar.sh
#
# Detiene notification-service y notification-db unos segundos (y los vuelve
# a levantar) para probar que ningun evento se pierde. Registra dispositivos de
# prueba con serial unico, y deja un mensaje invalido en la DLQ a proposito.

cd "$(dirname "$0")/.." || exit 1
export MSYS_NO_PATHCONV=1          # Git Bash: que no traduzca las rutas de los comandos

GW=http://localhost:8080/api
RMQ_API=http://localhost:15672/api
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

# Consulta notification-db (como root, solo para verificar).
notif()  { dc notification-db mariadb -uroot -proot123 -N notificaciones -e "$1" 2>/dev/null | tr -d '\r'; }
# Mensajes en una cola de RabbitMQ.
en_cola() { dc rabbitmq rabbitmqctl list_queues -q --no-table-headers name messages 2>/dev/null \
  | tr -d '\r' | awk -v c="$1" '$1 == c { print $2 }'; }
# Cuantas notificaciones hay para un eventId.
notificaciones() { notif "SELECT COUNT(*) FROM Notificaciones WHERE eventId = '$1'"; }

# Espera (hasta ~40 s) a que el eventId tenga una notificacion registrada.
esperar_notificacion() {
  for _ in $(seq 1 40); do
    [ "$(notificaciones "$1")" = "1" ] && return 0
    sleep 1
  done
  return 1
}

esperar_sano() {
  for _ in $(seq 1 40); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$1")" 2>/dev/null)" = "healthy" ] && return 0
    sleep 1
  done
  return 1
}

if [ "$(codigo "$GW/auth/jwks")" != "200" ]; then
  echo "El sistema no responde en $GW. Levantalo con: docker compose up --build -d"
  exit 1
fi

TOKEN=$(login ana@hospital.cr | campo accessToken)
TOKEN_CARLOS=$(login carlos@hospital.cr | campo accessToken)
SUFIJO=$(date +%s)

# ---------------------------------------------------------------------------
titulo "Requisito 1: device-service y autorizacion por recurso"

# Prueba obligatoria 1 (primera mitad): registrar con JWT valido
CREADO=$(json -X POST "$GW/devices" -H "Authorization: Bearer $TOKEN" \
  -d "{\"serial\":\"VER-U-$SUFIJO\",\"nombre\":\"Monitor de prueba\",\"ownerType\":\"user\",\"ownerId\":1}" -w "\n%{http_code}")
DEVICE=$(echo "$CREADO" | head -1 | campo id)
igual "Ana registra un dispositivo propio -> 201" "201" "$(echo "$CREADO" | tail -1)"

CREADO_P=$(json -X POST "$GW/devices" -H "Authorization: Bearer $TOKEN" \
  -d "{\"serial\":\"VER-P-$SUFIJO\",\"nombre\":\"Bomba de prueba\",\"ownerType\":\"project\",\"ownerId\":1}" -w "\n%{http_code}")
DEVICE_P=$(echo "$CREADO_P" | head -1 | campo id)
igual "Ana registra un dispositivo de su proyecto 1 -> 201" "201" "$(echo "$CREADO_P" | tail -1)"

# El body va en una variable: dentro de "$(...)" bash expandiria las llaves.
AJENO_PROYECTO="{\"serial\":\"VER-X-$SUFIJO\",\"nombre\":\"X\",\"ownerType\":\"project\",\"ownerId\":1}"
AJENO_USUARIO="{\"serial\":\"VER-Y-$SUFIJO\",\"nombre\":\"Y\",\"ownerType\":\"user\",\"ownerId\":1}"
igual "Carlos registra un dispositivo en el proyecto de Ana -> 403" "403" \
  "$(codigo -X POST "$GW/devices" -H "Authorization: Bearer $TOKEN_CARLOS" -H "Content-Type: application/json" -d "$AJENO_PROYECTO")"
igual "Carlos registra un dispositivo a nombre de Ana -> 403" "403" \
  "$(codigo -X POST "$GW/devices" -H "Authorization: Bearer $TOKEN_CARLOS" -H "Content-Type: application/json" -d "$AJENO_USUARIO")"

igual "Ana consulta su dispositivo -> 200" "200" "$(codigo "$GW/devices/$DEVICE" -H "Authorization: Bearer $TOKEN")"
igual "Ana consulta el dispositivo de su proyecto -> 200" "200" "$(codigo "$GW/devices/$DEVICE_P" -H "Authorization: Bearer $TOKEN")"
# Prueba obligatoria 2: ajeno con JWT valido -> 403, sin JWT -> 401
igual "Carlos consulta el dispositivo de Ana (ajeno, JWT valido) -> 403" "403" \
  "$(codigo "$GW/devices/$DEVICE" -H "Authorization: Bearer $TOKEN_CARLOS")"
igual "Carlos consulta el dispositivo del proyecto de Ana -> 403" "403" \
  "$(codigo "$GW/devices/$DEVICE_P" -H "Authorization: Bearer $TOKEN_CARLOS")"
igual "consultar sin JWT -> 401" "401" "$(codigo "$GW/devices/$DEVICE")"
if curl -s "$GW/devices/$DEVICE" -H "Authorization: Bearer falso" | grep -q "token invalido"; then
  ok "token falso: la puerta lo deja pasar y device-service lo rechaza (401)"
else
  falla "token falso: la puerta lo deja pasar y device-service lo rechaza (401)" "otra respuesta"
fi
igual "un dispositivo que no existe -> 404" "404" "$(codigo "$GW/devices/999999" -H "Authorization: Bearer $TOKEN")"
igual "Carlos reporta una alerta en el dispositivo de Ana -> 403" "403" \
  "$(codigo -X POST "$GW/devices/$DEVICE/alerts" -H "Authorization: Bearer $TOKEN_CARLOS" -H "Content-Type: application/json" \
    -d '{"level":"info","message":"x"}')"

if dc gateway wget -q -O /dev/null "http://device-service:4100/devices/$DEVICE" >/dev/null 2>&1; then
  falla "desde dentro de la red, device-service exige token" "respondio sin token"
else
  ok "desde dentro de la red, device-service exige token"
fi
igual "device-service no esta expuesto al host (:4100)" "000" "$(codigo -m 3 http://localhost:4100/)"

# ---------------------------------------------------------------------------
titulo "Requisito 2: publicacion de eventos"

# Prueba obligatoria 1 (segunda mitad): se publico device.registered
EVENTO_REG=$(notif "SELECT eventId FROM Notificaciones WHERE type = 'device.registered' AND deviceId = $DEVICE")
if [ -z "$EVENTO_REG" ]; then
  sleep 3
  EVENTO_REG=$(notif "SELECT eventId FROM Notificaciones WHERE type = 'device.registered' AND deviceId = $DEVICE")
fi
if [ -n "$EVENTO_REG" ]; then
  ok "registrar publico device.registered (notification-service lo registro)"
else
  falla "registrar publico device.registered (notification-service lo registro)" "sin notificacion"
fi

PAYLOAD=$(notif "SELECT payload FROM Notificaciones WHERE eventId = '$EVENTO_REG'")
FALTAN=""
for c in eventId type occurredAt deviceId userId ownerType ownerId; do
  echo "$PAYLOAD" | grep -q "\"$c\":" || FALTAN="$FALTAN $c"
done
igual "el evento trae eventId, type, occurredAt, deviceId y la referencia al usuario/proyecto" "" "$FALTAN"
igual "el evento del dispositivo de proyecto referencia al proyecto" "project 1" \
  "$(notif "SELECT CONCAT(ownerType, ' ', ownerId) FROM Notificaciones WHERE type = 'device.registered' AND deviceId = $DEVICE_P")"

# Prueba obligatoria 3: alerta -> device.alert.triggered -> notificacion
ALERTA=$(json -X POST "$GW/devices/$DEVICE/alerts" -H "Authorization: Bearer $TOKEN" \
  -d '{"level":"critical","message":"Frecuencia fuera de rango"}' -w "\n%{http_code}")
EVENTO_ALERTA=$(echo "$ALERTA" | head -1 | campo eventId)
igual "reportar una anomalia -> 202" "202" "$(echo "$ALERTA" | tail -1)"
if [ -n "$EVENTO_ALERTA" ] && esperar_notificacion "$EVENTO_ALERTA"; then
  ok "se publico device.alert.triggered y notification-service registro la notificacion"
else
  falla "se publico device.alert.triggered y notification-service registro la notificacion" "eventId '$EVENTO_ALERTA' sin notificacion"
fi

# ---------------------------------------------------------------------------
titulo "Requisito 3: consumidor independiente"

if dc gateway wget -q -O /dev/null http://notification-service:4200/ >/dev/null 2>&1; then
  falla "notification-service no tiene API publica (fuera de la red interna)" "el gateway lo alcanza"
else
  ok "notification-service no tiene API publica (fuera de la red interna)"
fi

# Prueba obligatoria 4: detener notification-service, generar un evento, reiniciarlo
echo "  ...deteniendo notification-service"
docker compose stop notification-service >/dev/null 2>&1
PENDIENTE=$(json -X POST "$GW/devices/$DEVICE/alerts" -H "Authorization: Bearer $TOKEN" \
  -d '{"level":"warning","message":"Evento con el consumidor apagado"}' | campo eventId)
sleep 1
EN_COLA=$(en_cola notification.events)
if [ -n "$EN_COLA" ] && [ "$EN_COLA" -ge 1 ]; then
  ok "con notification-service detenido, el evento espera en la cola ($EN_COLA mensaje/s)"
else
  falla "con notification-service detenido, el evento espera en la cola" "${EN_COLA:-sin cola}"
fi
igual "todavia no hay notificacion de ese evento" "0" "$(notificaciones "$PENDIENTE")"
docker compose start notification-service >/dev/null 2>&1
if esperar_notificacion "$PENDIENTE"; then
  ok "al reiniciar notification-service, el evento pendiente se proceso"
else
  falla "al reiniciar notification-service, el evento pendiente se proceso" "sin notificacion"
fi

# Prueba obligatoria 5: reenviar el mismo eventId no duplica
PAYLOAD_ALERTA=$(notif "SELECT payload FROM Notificaciones WHERE eventId = '$EVENTO_ALERTA'")
ESCAPADO=$(printf '%s' "$PAYLOAD_ALERTA" | sed 's/\\/\\\\/g; s/"/\\"/g')
RUTEADO=$(curl -s -u eventos:eventos123 -H "Content-Type: application/json" \
  -X POST "$RMQ_API/exchanges/%2F/device.events/publish" \
  -d "{\"properties\":{\"delivery_mode\":2,\"content_type\":\"application/json\"},\"routing_key\":\"device.alert.triggered\",\"payload\":\"$ESCAPADO\",\"payload_encoding\":\"string\"}")
igual "se reenvio el mismo evento por RabbitMQ" '{"routed":true}' "$RUTEADO"
sleep 3
igual "reenviar el mismo eventId no genera una notificacion duplicada" "1" "$(notificaciones "$EVENTO_ALERTA")"
igual "el repetido igual se confirmo (ack): la cola quedo vacia" "0" "$(en_cola notification.events)"

# Error temporal: notification-db caida -> reintento, no se pierde
echo "  ...deteniendo notification-db para simular un error temporal"
docker compose stop notification-db >/dev/null 2>&1
TEMPORAL=$(json -X POST "$GW/devices/$DEVICE/alerts" -H "Authorization: Bearer $TOKEN" \
  -d '{"level":"info","message":"Evento con la base caida"}' | campo eventId)
sleep 8
if docker compose logs --since 30s notification-service 2>/dev/null | grep "$TEMPORAL" | grep -q "error temporal"; then
  ok "con notification-db caida, el evento pasa a reintento (no se descarta)"
else
  falla "con notification-db caida, el evento pasa a reintento (no se descarta)" "sin reintento en el log"
fi
docker compose start notification-db >/dev/null 2>&1
esperar_sano notification-db
if esperar_notificacion "$TEMPORAL"; then
  ok "al volver notification-db, el reintento registro la notificacion"
else
  falla "al volver notification-db, el reintento registro la notificacion" "sin notificacion"
fi

# Un mensaje que nunca se va a poder procesar queda apartado, no se pierde
DLQ_ANTES=$(en_cola notification.events.dlq)
curl -s -o /dev/null -u eventos:eventos123 -H "Content-Type: application/json" \
  -X POST "$RMQ_API/exchanges/%2F/device.events/publish" \
  -d '{"properties":{},"routing_key":"device.invalido","payload":"esto no es JSON","payload_encoding":"string"}'
sleep 2
igual "un mensaje invalido queda en notification.events.dlq" "$((${DLQ_ANTES:-0} + 1))" "$(en_cola notification.events.dlq)"

# ---------------------------------------------------------------------------
titulo "Requisito 4: despliegue local en Docker"

igual "los 11 contenedores estan corriendo" "11" "$(docker compose ps --status running -q | wc -l | tr -d ' ')"
for par in auth-db:auth_user backend-db:backend_user device-db:device_user notification-db:notification_user; do
  BASE=${par%%:*}
  USUARIO=${par##*:}
  igual "$BASE solo tiene su usuario $USUARIO" "$USUARIO" \
    "$(dc "$BASE" mariadb -uroot -proot123 -N -e "SELECT GROUP_CONCAT(user) FROM mysql.user WHERE user LIKE '%_user'" 2>/dev/null | tr -d '\r')"
done
if dc device-service ping -c1 -W1 notification-db >/dev/null 2>&1; then
  falla "device-service NO alcanza notification-db por red" "si la alcanza"
else
  ok "device-service NO alcanza notification-db por red"
fi
if dc notification-service ping -c1 -W1 device-db >/dev/null 2>&1; then
  falla "notification-service NO alcanza device-db por red" "si la alcanza"
else
  ok "notification-service NO alcanza device-db por red"
fi
if dc backend ping -c1 -W1 rabbitmq >/dev/null 2>&1; then
  falla "backend NO alcanza rabbitmq (no publica ni consume)" "si lo alcanza"
else
  ok "backend NO alcanza rabbitmq (no publica ni consume)"
fi
igual "RabbitMQ corre local (panel en :15672)" "200" "$(codigo -u eventos:eventos123 "$RMQ_API/overview")"

# ---------------------------------------------------------------------------
titulo "Lo del Taller 2 se mantiene"

JWKS=$(curl -s "$GW/auth/jwks")
if echo "$JWKS" | grep -q '"alg":"RS256"' && echo "$JWKS" | grep -q '"kid"'; then
  ok "JWKS publico con claves RS256 y kid"
else
  falla "JWKS publico con claves RS256 y kid" "$JWKS"
fi
igual "backend acepta el mismo token -> 200" "200" "$(codigo "$GW/proyectos" -H "Authorization: Bearer $TOKEN")"
igual "sin cabecera Authorization la puerta responde 401" "401" "$(codigo "$GW/proyectos")"
PREFLIGHT=$(curl -s -i -X OPTIONS "$GW/devices" -H "Origin: http://localhost:5173" | tr -d '\r')
if echo "$PREFLIGHT" | grep -q "^HTTP/1.1 204" && echo "$PREFLIGHT" | grep -qi "^access-control-allow-origin: http://localhost:5173"; then
  ok "preflight CORS de /api/devices resuelto en la puerta"
else
  falla "preflight CORS de /api/devices resuelto en la puerta" "$(echo "$PREFLIGHT" | head -1)"
fi
igual "auth-service no esta expuesto al host (:5001)" "000" "$(codigo -m 3 http://localhost:5001/)"

# ---------------------------------------------------------------------------
echo
echo "Resultado: $OK OK, $FALLAS fallas"
[ "$FALLAS" -eq 0 ]
