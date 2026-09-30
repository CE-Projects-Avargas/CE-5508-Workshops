"""auth-service: la UNICA oficina que emite carnets (CE5508, Taller 2).

Rutas (el gateway las publica como /api/auth/*):
    POST /auth/register  {email, password, nombre} -> 201, o 409 si el correo existe
    POST /auth/login     {email, password}         -> {accessToken, refreshToken, expiresIn}, o 401
    POST /auth/refresh   {refreshToken}            -> par nuevo; el refresh usado deja de servir
    POST /auth/logout    Bearer + {refreshToken}   -> 204; revoca ese refresh
    GET  /auth/jwks      publico                   -> JSON Web Key Set (claves publicas)
    GET  /auth/me        Bearer <access>           -> datos del usuario del token

Tokens:
  - access:  JWT RS256 firmado con la clave PRIVADA (solo este servicio la tiene).
             Dura ACCESS_TTL_MIN (15 min). Lleva iss, aud, sub, exp y kid en la cabecera.
  - refresh: cadena aleatoria opaca (NO es JWT). Dura REFRESH_TTL_H (8 h).
             En la base se guarda solo su hash SHA-256. Usarlo lo invalida (rotacion).
"""
import datetime
import hashlib
import os
import secrets

import jwt
import pymysql
from flask import Flask, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

import claves as gestor_claves
from db import esperar_base_de_datos, get_connection

app = Flask(__name__)

JWT_ISSUER = os.getenv("JWT_ISSUER", "ce5508-auth-service")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "ce5508-backend")
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "15"))
REFRESH_TTL_H = int(os.getenv("REFRESH_TTL_H", "8"))

# Se cargan (o se generan si no hay) una vez al arrancar.
CLAVES = gestor_claves.cargar_claves()


# --- Emision de tokens -------------------------------------------------------

def generar_access_token(usuario):
    """JWT corto, firmado con RS256 y la clave privada activa."""
    kid, privada = gestor_claves.clave_activa(CLAVES)
    ahora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "iss": JWT_ISSUER,               # quien lo emite
        "aud": JWT_AUDIENCE,             # para quien es
        "sub": str(usuario["id"]),       # de quien es (el RFC pide texto)
        "email": usuario["email"],
        "nombre": usuario["nombre"],
        "iat": ahora,
        "exp": ahora + datetime.timedelta(minutes=ACCESS_TTL_MIN),
    }
    # El kid va en la CABECERA del token: dice con cual clave se firmo.
    return jwt.encode(payload, privada, algorithm="RS256", headers={"kid": kid})


def hash_refresh(token):
    """En la base se guarda solo el hash, nunca el refresh en claro."""
    return hashlib.sha256(token.encode()).hexdigest()


def generar_refresh_token(cur, usuario_id):
    """Cadena aleatoria opaca (NO es JWT). Se guarda su hash en auth-db."""
    token = secrets.token_urlsafe(48)
    expira = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=REFRESH_TTL_H)
    cur.execute(
        "INSERT INTO RefreshTokens (usuarioId, tokenHash, expiraEn) VALUES (%s, %s, %s)",
        (usuario_id, hash_refresh(token), expira.replace(tzinfo=None)),
    )
    return token


def emitir_par(cur, usuario):
    """Respuesta estandar de login y refresh: {accessToken, refreshToken, expiresIn}."""
    datos_publicos = {"id": usuario["id"], "email": usuario["email"], "nombre": usuario["nombre"]}
    return {
        "accessToken": generar_access_token(datos_publicos),
        "refreshToken": generar_refresh_token(cur, usuario["id"]),
        "expiresIn": ACCESS_TTL_MIN * 60,   # segundos que dura el access
        "usuario": datos_publicos,
    }


# --- Verificacion (solo para /me) -------------------------------------------

def payload_desde_header():
    """Valida 'Authorization: Bearer <token>': firma, exp, iss y aud."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:]
    try:
        kid = jwt.get_unverified_header(token).get("kid")
        publica = next(p.public_key() for k, p in CLAVES if k == kid)
        return jwt.decode(
            token,
            publica,
            algorithms=["RS256"],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except (jwt.PyJWTError, StopIteration):
        return None


# --- Rutas --------------------------------------------------------------------

@app.get("/")
def health():
    return jsonify(status="ok", servicio="CE5508 - Auth Service (RS256 + JWKS)")


@app.get("/auth/jwks")
def jwks():
    """Publico, sin token. Solo claves PUBLICAS."""
    return jsonify(gestor_claves.jwks(CLAVES))


@app.post("/auth/register")
def register():
    datos = request.get_json(silent=True) or {}
    email = (datos.get("email") or "").strip().lower()
    password = datos.get("password") or ""
    nombre = (datos.get("nombre") or "").strip()

    if not email or not password or not nombre:
        return jsonify(error="email, password y nombre son obligatorios"), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO Usuarios (email, password, nombre) VALUES (%s, %s, %s)",
                (email, generate_password_hash(password), nombre),
            )
            user_id = cur.lastrowid
    except pymysql.err.IntegrityError:
        return jsonify(error="ese email ya esta registrado"), 409
    finally:
        conn.close()

    return jsonify(id=user_id, email=email, nombre=nombre), 201


@app.post("/auth/login")
def login():
    """El UNICO momento en que viaja una contrasena."""
    datos = request.get_json(silent=True) or {}
    email = (datos.get("email") or "").strip().lower()
    password = datos.get("password") or ""

    if not email or not password:
        return jsonify(error="email y password son obligatorios"), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password, nombre FROM Usuarios WHERE email = %s",
                (email,),
            )
            usuario = cur.fetchone()
            if not usuario or not check_password_hash(usuario["password"], password):
                return jsonify(error="credenciales invalidas"), 401
            return jsonify(emitir_par(cur, usuario))
    finally:
        conn.close()


@app.post("/auth/refresh")
def refresh():
    """Cambia un refresh valido por un par nuevo y deja inservible el usado.

    Deteccion de reuso: si alguien presenta un refresh que YA se habia usado,
    lo mas probable es que se lo hayan robado. Se revocan todos los refresh
    vigentes de ese usuario y tiene que volver a iniciar sesion.
    """
    datos = request.get_json(silent=True) or {}
    token = datos.get("refreshToken") or ""
    if not token:
        return jsonify(error="refreshToken es obligatorio"), 400

    token_hash = hash_refresh(token)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Se marca como usado SOLO si seguia vigente. Es UNA sentencia:
            # si llegan dos peticiones con el mismo refresh, solo una gana.
            cur.execute(
                "UPDATE RefreshTokens SET revocadoEn = UTC_TIMESTAMP(), motivo = 'rotado' "
                "WHERE tokenHash = %s AND revocadoEn IS NULL AND expiraEn > UTC_TIMESTAMP()",
                (token_hash,),
            )
            if cur.rowcount != 1:
                # Un refresh que ya se habia ROTADO no deberia volver a llegar nunca.
                cur.execute(
                    "SELECT usuarioId FROM RefreshTokens WHERE tokenHash = %s AND motivo = 'rotado'",
                    (token_hash,),
                )
                reusado = cur.fetchone()
                if reusado:
                    cur.execute(
                        "UPDATE RefreshTokens SET revocadoEn = UTC_TIMESTAMP(), motivo = 'reuso' "
                        "WHERE usuarioId = %s AND revocadoEn IS NULL",
                        (reusado["usuarioId"],),
                    )
                    return jsonify(error="refresh reutilizado: se cerraron todas las sesiones"), 401
                return jsonify(error="refresh token invalido, vencido o ya usado"), 401

            cur.execute(
                "SELECT u.id, u.email, u.nombre FROM RefreshTokens r "
                "JOIN Usuarios u ON u.id = r.usuarioId WHERE r.tokenHash = %s",
                (token_hash,),
            )
            return jsonify(emitir_par(cur, cur.fetchone()))
    finally:
        conn.close()


@app.post("/auth/logout")
def logout():
    """Cierra la sesion de verdad: revoca el refresh en auth-db.

    Exige Bearer (no es una de las cuatro rutas publicas) y solo revoca un
    refresh que sea del mismo usuario del access token.
    """
    payload = payload_desde_header()
    if not payload:
        return jsonify(error="token invalido o ausente"), 401

    datos = request.get_json(silent=True) or {}
    token = datos.get("refreshToken") or ""
    if not token:
        return jsonify(error="refreshToken es obligatorio"), 400

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE RefreshTokens SET revocadoEn = UTC_TIMESTAMP(), motivo = 'logout' "
                "WHERE tokenHash = %s AND usuarioId = %s AND revocadoEn IS NULL",
                (hash_refresh(token), int(payload["sub"])),
            )
    finally:
        conn.close()
    return "", 204


@app.get("/auth/me")
def me():
    payload = payload_desde_header()
    if not payload:
        return jsonify(error="token invalido o ausente"), 401
    return jsonify(
        usuario={"id": int(payload["sub"]), "email": payload["email"], "nombre": payload["nombre"]}
    )


if __name__ == "__main__":
    esperar_base_de_datos()
    puerto = int(os.getenv("PORT", "5001"))
    # use_reloader: recarga al guardar cambios. debug=False: sin depurador expuesto.
    app.run(host="0.0.0.0", port=puerto, debug=False, use_reloader=True)