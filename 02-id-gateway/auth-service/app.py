"""auth-service — registro y login de usuarios con JWT (CE5508).

Contenedor separado del backend de /proyectos, pero habla con la misma
MariaDB y usa la tabla `Usuarios` que ya crea database/init/01-schema.sql:

    id, email, password, nombre, createdAt, updatedAt

Las contrasenas se guardan hasheadas (werkzeug / PBKDF2), nunca en claro.
`/login` devuelve un JWT firmado; `/me` valida ese token.
"""
import datetime
import os

import jwt
import pymysql
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from db import esperar_base_de_datos, get_connection

app = Flask(__name__)
CORS(app)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-ce5508-cambialo")
JWT_ALGORITMO = "HS256"
JWT_EXPIRA_MIN = int(os.getenv("JWT_EXPIRA_MIN", "60"))


def generar_token(usuario):
    """Firma un JWT con los datos del usuario y una expiracion."""
    ahora = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": usuario["id"],
        "email": usuario["email"],
        "nombre": usuario["nombre"],
        "iat": ahora,
        "exp": ahora + datetime.timedelta(minutes=JWT_EXPIRA_MIN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITMO)


def usuario_desde_token():
    """Lee 'Authorization: Bearer <token>' y devuelve el payload, o None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.split(" ", 1)[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITMO])
    except jwt.PyJWTError:
        return None


@app.get("/")
def health():
    return jsonify(status="ok", servicio="CE5508 - Auth Service (Flask + JWT)")


@app.post("/register")
def register():
    datos = request.get_json(silent=True) or {}
    email = (datos.get("email") or "").strip().lower()
    password = datos.get("password") or ""
    nombre = (datos.get("nombre") or "").strip()

    if not email or not password or not nombre:
        return jsonify(error="email, password y nombre son obligatorios"), 400

    hash_password = generate_password_hash(password)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO Usuarios (email, password, nombre) VALUES (%s, %s, %s)",
                (email, hash_password, nombre),
            )
            user_id = cur.lastrowid
    except pymysql.err.IntegrityError:
        return jsonify(error="ese email ya esta registrado"), 409
    finally:
        conn.close()

    return jsonify(id=user_id, email=email, nombre=nombre), 201


@app.post("/login")
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

    datos_publicos = {
        "id": usuario["id"],
        "email": usuario["email"],
        "nombre": usuario["nombre"],
    }
    return jsonify(
        mensaje="login correcto",
        token=generar_token(datos_publicos),
        usuario=datos_publicos,
    )


@app.get("/me")
def me():
    """Valida el JWT del header Authorization y devuelve el usuario."""
    payload = usuario_desde_token()
    if not payload:
        return jsonify(error="token invalido o ausente"), 401
    return jsonify(
        usuario={
            "id": payload["sub"],
            "email": payload["email"],
            "nombre": payload["nombre"],
        }
    )


if __name__ == "__main__":
    esperar_base_de_datos()
    puerto = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=puerto, debug=True)
