# auth-service: unico servicio que emite tokens. Firma con RSA y publica las llaves publicas en /jwks
import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt  # type: ignore
import jwt
import mysql.connector  # type: ignore
from fastapi import FastAPI, HTTPException  # type: ignore
from pydantic import BaseModel  # type: ignore

from keys import cargar_llaves


ISSUER = "cafetico-auth"
AUDIENCE = "cafetico-api"

ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_HOURS = int(os.getenv("REFRESH_TOKEN_HOURS", "8"))

app = FastAPI(title="Auth Service")

KID_ACTIVO, LLAVES = cargar_llaves()


# --------------------------------------------------
# Modelos de datos
# --------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    nombre: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


# --------------------------------------------------
# Utilidades
# --------------------------------------------------

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "auth-db"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "autenticacion"),
        user=os.getenv("DB_USER", "auth_user"),
        password=os.getenv("DB_PASSWORD", "auth_pass"),
    )


def ahora():
    # UTC sin zona, que es como MariaDB guarda DATETIME
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_token(token):
    # SHA-256 alcanza: el refresh es aleatorio de 384 bits, y asi se puede buscar por hash
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def int_to_base64url(value):
    value_bytes = value.to_bytes((value.bit_length() + 7) // 8, byteorder="big")
    return base64.urlsafe_b64encode(value_bytes).rstrip(b"=").decode("ascii")


def llave_a_jwk(kid, private_key):
    numeros = private_key.public_key().public_numbers()
    return {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": kid,
        "n": int_to_base64url(numeros.n),
        "e": int_to_base64url(numeros.e),
    }


def crear_access_token(usuario):
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario["id"]),
        "email": usuario["email"],
        "iss": ISSUER,
        "aud": AUDIENCE,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, LLAVES[KID_ACTIVO], algorithm="RS256", headers={"kid": KID_ACTIVO})


def crear_refresh_token(cursor, usuario_id):
    # El refresh es un valor aleatorio opaco; en la base solo queda su hash
    token = secrets.token_urlsafe(48)
    cursor.execute(
        "INSERT INTO RefreshTokens (usuarioId, tokenHash, expiraEn) VALUES (%s, %s, %s)",
        (usuario_id, hash_token(token), ahora() + timedelta(hours=REFRESH_TOKEN_HOURS)),
    )
    return token


def emitir_par(cursor, usuario):
    return {
        "accessToken": crear_access_token(usuario),
        "refreshToken": crear_refresh_token(cursor, usuario["id"]),
        "expiresIn": ACCESS_TOKEN_MINUTES * 60,
        "tokenType": "Bearer",
    }


# --------------------------------------------------
# Endpoints
# --------------------------------------------------

@app.get("/")
def root():
    return {"message": "Auth Service funcionando"}


@app.post("/register", status_code=201)
def register(user: RegisterRequest):
    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT id FROM Usuarios WHERE email = %s", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El correo ya está registrado")

        password_hash = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
        cursor.execute(
            "INSERT INTO Usuarios (email, password, nombre) VALUES (%s, %s, %s)",
            (user.email, password_hash, user.nombre),
        )
        connection.commit()
        return {"id": cursor.lastrowid, "email": user.email, "nombre": user.nombre}
    finally:
        cursor.close()
        connection.close()


@app.post("/login")
def login(user: LoginRequest):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, email, nombre, password FROM Usuarios WHERE email = %s",
            (user.email,),
        )
        db_user = cursor.fetchone()

        stored = db_user["password"] if db_user else b""
        if isinstance(stored, str):
            stored = stored.encode("utf-8")
        if not db_user or not bcrypt.checkpw(user.password.encode("utf-8"), bytes(stored)):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

        respuesta = emitir_par(cursor, db_user)
        connection.commit()
        respuesta["user"] = {"id": db_user["id"], "email": db_user["email"], "nombre": db_user["nombre"]}
        return respuesta
    finally:
        cursor.close()
        connection.close()


@app.post("/refresh")
def refresh(request: RefreshRequest):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        token_hash = hash_token(request.refreshToken)

        # Marcarlo como usado en un solo UPDATE: si dos peticiones llegan con el mismo refresh, solo una gana
        cursor.execute(
            """
            UPDATE RefreshTokens SET usadoEn = %s
            WHERE tokenHash = %s AND usadoEn IS NULL AND expiraEn > %s
            """,
            (ahora(), token_hash, ahora()),
        )
        if cursor.rowcount != 1:
            raise HTTPException(status_code=401, detail="Refresh token inválido, vencido o ya usado")

        cursor.execute(
            """
            SELECT u.id, u.email FROM RefreshTokens r
            JOIN Usuarios u ON u.id = r.usuarioId
            WHERE r.tokenHash = %s
            """,
            (token_hash,),
        )
        usuario = cursor.fetchone()

        respuesta = emitir_par(cursor, usuario)
        connection.commit()
        return respuesta
    finally:
        cursor.close()
        connection.close()


@app.get("/jwks")
def get_jwks():
    # Publica todas las llaves: los tokens firmados con una llave anterior siguen validando
    return {"keys": [llave_a_jwk(kid, llave) for kid, llave in LLAVES.items()]}
