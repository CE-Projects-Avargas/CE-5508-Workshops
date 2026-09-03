# Taller 2 — La bomba funciona, y los servicios colaboran

> **Pregunta del taller:** ya tengo varios servicios. ¿Cómo hago que colaboren sin que uno tenga que confiar ciegamente en el otro?

## Antes de empezar

Traigan del Taller 1 sus carpetas y colóquenlas junto a este archivo:

```
02-la-bomba/
├── backend/        ← su Taller 1
├── auth-service/   ← su Taller 1 (y hay que declararlo en el compose)
├── frontend/       ← su Taller 1
├── pump-service/   ← ya está aquí, con el esqueleto
├── database/       ← ya está aquí: auth/ y operacion/, separadas
└── docker-compose.yml
```

Levantar:

```bash
docker compose up --build
```

## Dos bases de datos

La base única del Taller 1 se parte en dos:

| Base | Guarda | Por qué separada |
|---|---|---|
| `auth-db` | Solo `Usuarios` | **Contención de daño**: una inyección en otro servicio no debe leer hashes |
| `operacion-db` | `Proyectos`, `Bombas`, `Productos`, `EventosControl` | El dominio. La comparten backend y pump-service |

Ningún servicio se conecta como `root`: cada uno tiene su usuario con permisos mínimos (ver `database/operacion/03-permisos.sql`).

**Lo que se pierde:** `Proyectos.ownerId` y `EventosControl.usuarioId` dejan de ser claves foráneas — el usuario vive en otra base. Esa garantía pasa a ser del código.

**Redes separadas:** `pump-service` no tiene ruta hacia `auth-db`. La separación no depende de que nadie escriba la consulta equivocada.

## Qué ya está resuelto

| | Qué hace |
|---|---|
| `database/auth/` | Base de credenciales, aislada, con su usuario y permisos |
| `database/operacion/` | Dominio del negocio, precarga y **un usuario de BD por servicio** |
| `pump-service/bucle.js` | El avance de las bombas: cada segundo entregan `caudalMlH / 3600` ml |
| `pump-service/auth.js` | Verificación del token (autenticación) |
| `docker-compose.yml` | Los servicios cableados — **menos `auth-service`, que agregan ustedes** |

**Usuarios precargados** — contraseña `clave123` para ambos:

| Usuario | Proyecto | Bombas |
|---|---|---|
| `ana@hospital.cr` | Bombas Ala Norte | 3 |
| `carlos@hospital.cr` | Bombas UCI | 2 |

## Qué construyen ustedes

1. **Declarar `auth-service` en el `docker-compose.yml`.** No está ahí a propósito. El gateway ya enruta `/api/auth` hacia `auth-service:4001`, así que su bloque debe llamarse exactamente así, escuchar en el 4001 y usar el **mismo `JWT_SECRET`** que los demás. Mientras falte, `/api/auth/login` responde `502`.
2. **`pump-service/routes/bombas.js`** — los nueve endpoints, con autorización por propiedad. Los TODO están en el archivo.
3. **`backend`** — que `GET /proyectos` devuelva solo los del usuario del token.
4. **`frontend`** — la consola: alta y edición de bombas con producto y cantidad, más iniciar / programar / pausar / detener.

## El reto

`pump-service` debe rechazar con **403** cualquier intento de controlar una bomba de otro usuario, aunque el token sea válido y la bomba exista.

Para lograrlo hay que decidir **cómo** averiguar de quién es la bomba:

- **Opción A** — consultar la base de datos directamente (`JOIN Bombas → Proyectos`)
- **Opción B** — preguntarle al backend (`GET /proyectos/:id` con el token)

Las dos son defendibles. Elijan una, impleméntenla, y prepárense para explicar **qué perdieron al elegirla**.

## Verificación

```bash
# Ana inicia sesión
TOKEN=$(curl -s -X POST localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@hospital.cr","password":"clave123"}' | jq -r .token)

# Ve sus 3 bombas — no las 5
curl -s localhost:4002/bombas -H "Authorization: Bearer $TOKEN" | jq length

# Inicia una propia: 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:4002/bombas/1/iniciar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"caudalMlH":25,"volumenObjetivoMl":250}'

# Intenta una de Carlos: 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:4002/bombas/4/iniciar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"caudalMlH":25,"volumenObjetivoMl":250}'
```

Si la última línea imprime `200`, el taller no está terminado.

El enunciado completo está en la guía del estudiante.
