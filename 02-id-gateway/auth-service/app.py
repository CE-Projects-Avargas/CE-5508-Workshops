"""auth-service: la UNICA oficina que emite carnets (CE5508, Taller 2).

Firma los JWT con una clave PRIVADA RSA que solo este servicio tiene.
Los demas los comprueban con la PUBLICA, publicada en GET /auth/jwks.
"""
import datetime
import os

import jwt
import pymysql
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

import claves as gestor_claves
from db import esperar_base_de_datos, get_connection

app = Flask(__name__)
CORS(app)  # temporal: en el paso 5 CORS pasa al gateway

JWT_ISSUER = os.getenv("JWT_ISSUER", "ce5508-auth-service")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "ce5508-backend")
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "15"))

# Se cargan (o se generan si no hay) una vez al arrancar.
CLAVES = gestor_claves.cargar_claves()


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
    finally:
        conn.close()

    if not usuario or not check_password_hash(usuario["password"], password):
        return jsonify(error="credenciales invalidas"), 401

    datos_publicos = {"id": usuario["id"], "email": usuario["email"], "nombre": usuario["nombre"]}
    return jsonify(
        accessToken=generar_access_token(datos_publicos),
        expiresIn=ACCESS_TTL_MIN * 60,   # segundos
        usuario=datos_publicos,
    )


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