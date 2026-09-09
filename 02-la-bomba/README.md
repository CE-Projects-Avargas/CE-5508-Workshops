# Taller 2 — Especificación de destino

> **Ustedes siguen en su propia rama.** Esta carpeta no se clona para reemplazar su trabajo: es la **especificación de a dónde tiene que llegar su sistema**, más los artefactos de configuración que pueden copiar tal cual.

**Pregunta del taller:** ya tengo varios servicios. ¿Cómo hago que colaboren sin que uno tenga que confiar ciegamente en el otro?

---

## 1. Qué se da, qué se especifica, qué construyen

| | |
|---|---|
| **Artefactos listos para copiar** — configuración, no lógica de negocio | `database/auth/` · `database/operacion/` · `gateway/nginx.conf` · `gateway/cors.conf` |
| **Especificación** — el qué, no el cómo | Arquitectura destino, contratos de los endpoints, comportamiento del motor, criterios de aceptación |
| **Referencia opcional** | `pump-service/` — un esqueleto en Node. Si su stack es otro, ignórenlo: lo que manda es el contrato |
| **Lo construyen ustedes, en su rama** | El servicio de bombas, los ajustes al backend y al frontend, y su propio `docker-compose.yml` |

---

## 2. Arquitectura destino

```
navegador → gateway :8080 ─┬→ auth-service :4001 ──→ auth-db      (autenticacion)
                           ├→ backend      :4000 ──┐
                           └→ pump-service :4002 ──┴→ operacion-db (operacion)
```

**Cuatro redes:** `borde` (navegador↔gateway) · `interna` (gateway↔servicios) · `datos-auth` · `datos-operacion`.

Consecuencia concreta: `pump-service` **no tiene ruta hacia `auth-db`**. La separación no depende de que nadie escriba la consulta equivocada.

**Dos bases:**

| Base | Guarda | Por qué separada |
|---|---|---|
| `auth-db` | Solo `Usuarios` | Contención de daño: una inyección en otro servicio no debe leer hashes |
| `operacion-db` | `Proyectos`, `Bombas`, `Productos`, `EventosControl` | El dominio. La comparten backend y pump-service |

**Un usuario de BD por servicio.** Nadie se conecta como `root`. Ver `database/operacion/03-permisos.sql`: los `GRANT` son la frontera entre servicios, escrita en SQL.

**Lo que se pierde:** `Proyectos.ownerId` y `EventosControl.usuarioId` dejan de ser claves foráneas, porque el usuario vive en otra base. Esa garantía pasa a ser del código.

---

## 3. Cómo migrar su rama

Su lógica de negocio no cambia. Lo que cambia es configuración y estructura.

### Paso 1 — Copien los artefactos

```bash
cp -r <este-repo>/02-la-bomba/database  .
cp -r <este-repo>/02-la-bomba/gateway   .
```

### Paso 2 — Ajusten la conexión de sus servicios

| Servicio | Antes (T1) | Ahora |
|---|---|---|
| `auth-service` | `mariadb` / `dispositivos_medicos` / `root` | `auth-db` / `autenticacion` / `auth_user` / `auth_pass` |
| `backend` | `mariadb` / `dispositivos_medicos` / `root` | `operacion-db` / `operacion` / `backend_user` / `backend_pass` |

> Si en el Taller 1 pusieron la conexión en variables de entorno, esto son cuatro líneas del compose. Si la escribieron a mano en el código, van a tener que buscarla. **Esa diferencia es el tema de hoy en miniatura.**

### Paso 3 — Su `docker-compose.yml`

Tomen el de aquí como referencia y adáptenlo a los nombres de sus carpetas. Debe quedar con `gateway`, `auth-db`, `operacion-db`, `auth-service`, `backend`, `pump-service`, `frontend` y las cuatro redes.

El gateway enruta hacia `auth-service:4001`: **su servicio tiene que llamarse exactamente así**.

### Paso 4 — El frontend

De dos direcciones a una: `VITE_API_URL=http://localhost:8080/api`.

### Paso 5 — Verifiquen antes de seguir

```bash
curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@hospital.cr","password":"clave123"}'
```

**Si devuelve un token, la infraestructura está bien y pueden empezar el reto.**
Si devuelve `502`, el gateway no encuentra `auth-service`. Si da error de conexión, revisen usuario y base.

---

## 4. Contrato del servicio de bombas

Nueve endpoints. Todos exigen `Authorization: Bearer <token>`.

### Gestión

| Método | Ruta | Comportamiento |
|---|---|---|
| `GET` | `/bombas` | Solo bombas de proyectos del usuario. Incluir nombre del producto. Acepta `?proyectoId=` |
| `GET` | `/bombas/:id` | La bomba, si es suya. Si existe pero es de otro: **403**, no 404 |
| `POST` | `/bombas` | Crear. El proyecto debe ser del usuario. Serie única → `409` si repite |
| `PUT` | `/bombas/:id` | Editar ubicación, producto, volumen o caudal |
| `DELETE` | `/bombas/:id` | Eliminar. Decidan qué pasa con su historial |

### Control

| Método | Ruta | Comportamiento |
|---|---|---|
| `POST` | `/bombas/:id/iniciar` | `{caudalMlH, volumenObjetivoMl}`. Exige producto y volumen asignados → `400` si faltan |
| `POST` | `/bombas/:id/programar` | `{programadaPara}` futuro → `400` si es pasado. Estado `programada` |
| `POST` | `/bombas/:id/pausar` | Conserva el volumen entregado. Solo si está infundiendo → `409` si no |
| `POST` | `/bombas/:id/detener` | Limpia caudal, objetivo y programación |

Toda acción se registra en `EventosControl` con el usuario responsable.

### El motor

Un temporizador cada segundo, dentro del servicio:

```
1. Bombas en 'programada' con programadaPara <= ahora
   → estado 'infundiendo', volumenEntregado = 0, iniciadaEn = ahora

2. Bombas en 'infundiendo'
   → volumenEntregado += caudalMlH / 3600
   → si alcanza el objetivo: estado 'completada'
```

Deliberadamente simple. Lo importante es que **el estado cambia solo con el tiempo**, y eso obliga al frontend a consultar periódicamente.

---

## 5. El reto

`pump-service` debe rechazar con **403** cualquier intento de tocar una bomba de otro usuario, aunque el token sea válido y la bomba exista.

Para eso hay que averiguar de quién es el proyecto. **Dos caminos, ninguno incorrecto:**

| | A · Consultar la base | B · Preguntarle al backend |
|---|---|---|
| Cómo | `JOIN Bombas → Proyectos`, comparar `ownerId` | `GET /proyectos/:id` con el token |
| Gana | Rápido, sin red de por medio | Cada servicio dueño de sus datos |
| Pierde | Comparten esquema: si el backend cambia `Proyectos`, esto se rompe sin aviso | Un salto de red. Si el backend cae, no se controla ninguna bomba |

> `pump_user` **tiene** permiso de lectura sobre `Proyectos` — ese `GRANT` está puesto a propósito. Tener el permiso no significa que deban usarlo.

**Se evalúa que puedan explicar qué perdieron al elegir.** Una decisión sin costo declarado no es una decisión: es una preferencia.

---

## 6. Criterios de aceptación

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@hospital.cr","password":"clave123"}' | jq -r .token)

# Ve 3 bombas, no 5
curl -s localhost:8080/api/bombas -H "Authorization: Bearer $TOKEN" | jq length

# Inicia una propia → 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8080/api/bombas/1/iniciar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"caudalMlH":25,"volumenObjetivoMl":250}'

# Intenta una de Carlos → 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8080/api/bombas/4/iniciar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"caudalMlH":25,"volumenObjetivoMl":250}'
```

Si la última línea imprime `200`, el taller no está terminado.

**Datos precargados** — contraseña `clave123` para ambos:

| Usuario | Proyecto | Bombas |
|---|---|---|
| `ana@hospital.cr` | Bombas Ala Norte | 3 — la `BIV2-0043` viene sin configurar, para probar el alta |
| `carlos@hospital.cr` | Bombas UCI | 2 |

---

## 7. Tres decisiones que no son técnicas

Aparecen al implementar. Acuérdenlas en grupo **antes** de codificar:

1. ¿Se puede editar una bomba que está infundiendo?
2. Al eliminarla, ¿qué pasa con su historial de eventos?
3. ¿Y si la programan para una hora que ya pasó?

Son reglas de negocio, no detalles de implementación.
