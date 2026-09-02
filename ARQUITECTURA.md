# Arquitectura de referencia — CE5508

Este documento define **el sistema completo** que los seis talleres construyen. Cada taller agrega servicios a este mismo destino; nada se descarta entre uno y otro.

Léelo antes de construir cualquier taller: aquí están los contratos que cada pieza debe respetar.

---

## 1. El dominio

Una **plataforma de monitoreo de dispositivos médicos conectados**.

| Entidad | Qué representa | Taller |
|---|---|---|
| `Usuarios` | Quién puede acceder al sistema | T1 |
| `Proyectos` | El **modelo** de dispositivo en desarrollo (ej. "Bomba de Infusión V2") | T1 |
| `Dispositivos` | Las **unidades desplegadas** de ese modelo, cada una en un hospital | T2 |
| `Telemetria` | Lecturas que envía cada dispositivo | T2 |
| `Alertas` | Generadas cuando una lectura cruza un umbral | T2 |

La distinción clave: un **Proyecto** es un modelo de producto; un **Dispositivo** es una unidad física de ese modelo. Solo los dispositivos reportan telemetría.

---

## 2. Servicios del sistema final

16 contenedores, agrupados por capa.

### Datos
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `mariadb` | `mariadb:11` | 3306 | T1 |

### Borde — el dispositivo
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `device-sim` | propia | — | T3 |
| `mosquitto` | `eclipse-mosquitto:2` | 1883 | T3 |
| `mqtt-bridge` | propia | — | T3 |

### Eventos
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `kafka` | `apache/kafka:3.9.0` | 9092 | T2 |
| `kafka-ui` | `ghcr.io/kafbat/kafka-ui` | 8080 | T2 |

### Servicios de negocio
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `backend` | propia | 4000 | T1 |
| `auth-service` | propia | 4001 | T1 (reto) |
| `telemetry-consumer` | propia | 4002 | T2 (reto) |
| `alert-service` | propia | 4003 | T2 |

### Presentación
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `frontend` | propia | 5173 | T1 |

### Operación
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `prometheus` | `prom/prometheus` | 9090 | T4 |
| `grafana` | `grafana/grafana-oss` | 3000 | T4 |
| `registry` | `registry:2` | 5000 | T5 |
| `ci-runner` | `gitea/act_runner` | — | T5 |

### Agentes
| Servicio | Imagen | Puerto | Taller |
|---|---|---|---|
| `mcp-server` | propia | 4004 | T6 |

---

## 3. Cómo se comunican

```
                        ┌──────────── BORDE ────────────┐
  device-sim  ──MQTT──▶  mosquitto  ──MQTT──▶  mqtt-bridge
                        └───────────────────────────────┘
                                                    │
                                            produce │ (Kafka)
                                                    ▼
                                        ┌──────── kafka ────────┐
                                        │   topic: telemetria   │
                                        └───────────────────────┘
                                            │               │
                              consume ──────┘               └────── consume
                                    ▼                                ▼
                          telemetry-consumer                   alert-service
                                    │                                │
                                    └──────────┬─────────────────────┘
                                               ▼
                                            mariadb
                                               ▲
                                               │ SQL
   frontend ──HTTP──▶ backend ─────────────────┘
       │                  │
       │                  └──valida token──▶ auth-service
       └──HTTP login──────────────────────────────┘

   prometheus ──scrape /metrics──▶ backend · telemetry-consumer
                                    alert-service · mqtt-bridge
   grafana ──consulta──▶ prometheus

   agente ──MCP──▶ mcp-server ──HTTP solo lectura──▶ backend

   ci-runner ──push──▶ registry ──pull──▶ docker compose
```

### El punto pedagógico central

`telemetry-consumer` y `alert-service` **leen el mismo topic de forma independiente**. Ninguno sabe que el otro existe. Agregar un tercer consumidor no requiere tocar al productor.

Eso es lo que una arquitectura basada en eventos compra, y no se puede explicar bien sin verlo funcionando.

---

## 4. Contratos

Estos contratos son el punto de encuentro entre talleres. Un taller puede cambiar su implementación interna; **no puede romper su contrato**.

### 4.1 Telemetría — MQTT (define T3, consume T2)

**Topic:** `dispositivos/{deviceId}/telemetria`

```json
{
  "deviceId": "BIV2-0042",
  "ts": "2026-09-02T14:31:05.220Z",
  "metricas": {
    "caudalMlH": 24.8,
    "presionKpa": 118.4,
    "bateriaPct": 87,
    "aireEnLinea": false
  },
  "estado": "infundiendo",
  "seq": 10432
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `deviceId` | string | Debe existir en `Dispositivos` |
| `ts` | ISO-8601 UTC | Generado por el dispositivo, no por el servidor |
| `seq` | entero | Incremental por dispositivo. **Base de la idempotencia** |
| `estado` | enum | `infundiendo` · `detenido` · `alarma` · `standby` |

### 4.2 Telemetría — Kafka (define T2)

**Topic:** `telemetria` · particiones: 3 · retención: 24 h

- **key** = `deviceId` (garantiza orden por dispositivo)
- **value** = el mismo JSON de arriba, sin transformar

`mqtt-bridge` no interpreta el contenido: solo traslada y asigna la llave.

### 4.3 Idempotencia (regla del sistema)

`(deviceId, seq)` es único. Todo consumidor debe poder reprocesar un mensaje sin duplicar efectos.

```sql
UNIQUE KEY uk_dispositivo_seq (deviceId, seq)
```

Es la restricción que hace seguro reintentar, y el concepto que el T2 instala.

### 4.4 API REST (define T1, extiende T2)

| Método | Ruta | Auth | Taller |
|---|---|---|---|
| `GET` | `/proyectos` | — | T1 |
| `POST` | `/proyectos` | — | T1 |
| `POST` | `/auth/register` | — | T1 (reto) |
| `POST` | `/auth/login` | — | T1 (reto) |
| `GET` | `/dispositivos` | token | T2 |
| `POST` | `/dispositivos` | token | T2 |
| `GET` | `/dispositivos/:id/telemetria?desde=&hasta=` | token | T2 |
| `GET` | `/alertas?estado=` | token | T2 |

Token: `Authorization: Bearer <jwt>`, emitido por `auth-service`.

### 4.5 Métricas (define T4)

Cada servicio propio expone `GET /metrics` en formato Prometheus:

```
ce5508_mensajes_procesados_total{servicio="telemetry-consumer"} 10432
ce5508_ingesta_latencia_segundos_bucket{le="0.1"} 9800
ce5508_dispositivos_activos 12
```

### 4.6 Herramientas MCP (define T6)

Solo lectura. El servidor MCP **nunca** escribe.

| Herramienta | Parámetros | Devuelve |
|---|---|---|
| `listar_dispositivos` | `estado?` | Dispositivos y su último reporte |
| `consultar_telemetria` | `deviceId`, `desde`, `hasta` | Serie de lecturas |
| `listar_alertas` | `desde`, `severidad?` | Alertas del periodo |

---

## 5. Qué entrega cada taller

Cada taller **debe cerrar con el sistema corriendo**. Esta es la condición de entrega.

| | Taller | Servicios al cerrar | Contrato que fija | Reto del grupo |
|---|---|---|---|---|
| T1 | Stack base | 4 | API REST · JWT | `auth-service` completo |
| T2 | Bus de eventos | 7 | Topic `telemetria` · idempotencia | `telemetry-consumer` |
| T3 | Origen de datos | 10 | Payload MQTT · cadencia | Buffer ante desconexión |
| T4 | Observabilidad | 12 | `/metrics` · alertas | Tablero y regla de alerta |
| T5 | Despliegue | 14 | Imágenes versionadas | Desplegar v2 y revertir |
| T6 | Agentes | 15* | Herramientas MCP | Exponer solo lectura |

\* 16 con `alert-service`, que se entrega construido en T2.

---

## 6. Licencias y costo

**Verificado: todo es software libre y sin costo.** Ningún componente requiere cuenta de pago, licencia comercial ni servicio en la nube.

| Componente | Licencia | Nota |
|---|---|---|
| MariaDB 11 | GPL-2.0 | Imagen oficial |
| Apache Kafka | Apache-2.0 | Imagen **oficial de Apache**, modo KRaft |
| Kafka UI (kafbat) | Apache-2.0 | Fork activo del proyecto original |
| Eclipse Mosquitto | EPL-2.0 / EDL-1.0 | Imagen oficial |
| Prometheus | Apache-2.0 | Imagen oficial |
| Grafana OSS | AGPL-3.0 | Usar `grafana/grafana-oss` |
| Distribution (registry) | Apache-2.0 | Proyecto CNCF |
| Gitea + act_runner | MIT | Autoalojado |
| MCP SDK | MIT | Protocolo abierto |
| Node.js · React · Vite | MIT | — |

### Trampas evitadas a propósito

Estas son decisiones deliberadas para que nada dependa de un plan de pago:

- **`apache/kafka`, no `bitnami/kafka`.** Bitnami restringió su catálogo gratuito en 2025; las imágenes oficiales de Apache no tienen esa condición.
- **`grafana/grafana-oss`, no `grafana/grafana`.** La segunda incluye funciones Enterprise que piden licencia. La OSS es AGPL y completa para lo que necesitamos.
- **`kafbat/kafka-ui`, no `provectuslabs/kafka-ui`.** El original quedó sin mantenimiento activo. Alternativa igualmente libre: AKHQ (Apache-2.0).
- **Gitea autoalojado, no GitHub Actions.** Evita depender de minutos de cómputo de un plan externo. Alternativa: **Forgejo** (GPL-3.0), fork con gobernanza comunitaria.
- **Registro local, no Docker Hub.** Además de evitar cuentas, mitiga el límite de descargas anónimas de Docker Hub, que en un aula con muchas máquinas tras la misma IP se alcanza rápido.
- **MCP Inspector para probar, no una API de modelo.** El T6 se valida con el inspector oficial (MIT); **no hace falta pagar por acceso a ningún modelo** para completar el taller.

### Sobre Docker Desktop

Docker Engine y Docker Compose son Apache-2.0. **Docker Desktop** (el envoltorio de escritorio) no es open source: es gratuito para uso educativo y personal, pero exige suscripción en empresas grandes.

Para el curso es gratuito. Si se quiere una cadena estrictamente libre, alternativas equivalentes:

| Alternativa | Licencia | Plataforma |
|---|---|---|
| Podman + podman-compose | Apache-2.0 | Linux · macOS · Windows |
| Rancher Desktop | Apache-2.0 | Linux · macOS · Windows |
| Colima | MIT | macOS · Linux |
| Docker Engine nativo | Apache-2.0 | Linux |

Los `docker-compose.yml` del curso funcionan sin cambios con `podman-compose`.

---

## 7. Convenciones del repositorio

```
CE-5508-Workshops/
├── ARQUITECTURA.md          ← este documento
├── 00-referencia/
│   ├── docker-compose.final.yml   estado final, comentado por taller
│   ├── modelo-datos.sql           esquema completo
│   └── contratos/                 esquemas de payload
├── 01-docker-login/         T1
├── 02-eventos-kafka/        T2
├── 03-dispositivo-mqtt/     T3
├── 04-observabilidad/       T4
├── 05-despliegue/           T5
└── 06-mcp/                  T6
```

Cada carpeta de taller es autocontenida: se clona, se levanta y funciona. El taller N incluye ya resuelto todo lo de los talleres anteriores.
