import os

import mysql.connector # type: ignore
from fastapi import FastAPI, HTTPException # type: ignore
from pydantic import BaseModel # type: ignore
import bcrypt # type: ignore
import jwt 
from datetime import datetime, timedelta, timezone
from keys import load_keys
import base64
from cryptography.hazmat.primitives.asymmetric import rsa


KEY_ID = "auth-key-1"
ISSUER = "cafetico-auth"
AUDIENCE = "cafetico-api"

app = FastAPI(title="Auth Service")

private_key, public_key = load_keys() 

def int_to_base64url(value: int) -> str:
    byte_length = (value.bit_length() + 7) // 8
    value_bytes = value.to_bytes(byte_length, byteorder="big")

    return base64.urlsafe_b64encode(value_bytes).rstrip(b"=").decode("ascii")


def public_key_to_jwk(public_key):
    if not isinstance(public_key, rsa.RSAPublicKey):
        raise TypeError("La clave pública no es una clave RSA")

    public_numbers = public_key.public_numbers()

    return {
        "kty": "RSA",
        "use": "sig",
        "kid": KEY_ID,
        "alg": "RS256",
        "n": int_to_base64url(public_numbers.n),
        "e": int_to_base64url(public_numbers.e),
    }


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


# --------------------------------------------------
# Conexión a MariaDB
# --------------------------------------------------

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "mariadb"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "dispositivos_medicos"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root123")
    )


# --------------------------------------------------
# Endpoint de prueba
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "Auth Service funcionando"
    }


# --------------------------------------------------
# Registro
# --------------------------------------------------

@app.post("/register")
def register(user: RegisterRequest):

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Verificar si el correo ya existe
        cursor.execute(
            "SELECT id FROM Usuarios WHERE email = %s",
            (user.email,)
        )

        existing_user = cursor.fetchone()

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="El correo ya está registrado"
            )

        # Insertar usuario
        password_hash = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())

        cursor.execute(
            """
            INSERT INTO Usuarios (email, password, nombre)
            VALUES (%s, %s, %s)
            """,
            (
                user.email,
                password_hash,
                user.nombre
            )
        )

        connection.commit()

        return {
            "message": "Usuario registrado correctamente"
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar usuario: {str(e)}"
        )

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


# --------------------------------------------------
# Login
# --------------------------------------------------

@app.post("/login")
def login(user: LoginRequest):

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, email, nombre, password
            FROM Usuarios
            WHERE email = %s
            """,
            (user.email,)
        )

        db_user = cursor.fetchone()

        # Usuario no existe
        if not db_user:
            return {
                "authenticated": False,
                "message": "Correo o contraseña incorrectos"
            }

        # Verificar contraseña
        stored_password = db_user["password"]
        if isinstance(stored_password, str):
            stored_password = stored_password.encode("utf-8")

        if not bcrypt.checkpw(user.password.encode("utf-8"), stored_password):
            return {
                "authenticated": False, 
                "message": "Correo o contraseña incorrectos"
            }

        payload = {
            "sub": str(db_user["id"]),
            "email": db_user["email"],
            "iss": ISSUER,
            "aud": AUDIENCE,
            "exp": datetime.now(timezone.utc) + timedelta(hours=2)
        }

        token = jwt.encode(
            payload,
            private_key,
            algorithm="RS256",
            headers={
                "kid": KEY_ID
            }
        )

        return {
            "authenticated": True,
            "message": "Login exitoso",
            "token": token,
            "user": {
                "id": db_user["id"],
                "email": db_user["email"],
                "nombre": db_user["nombre"]
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al realizar login: {str(e)}"
        )

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


# --------------------------------------------------
# JWKS
# --------------------------------------------------

@app.get("/jwks")
def get_jwks():
    return {
        "keys": [
            public_key_to_jwk(public_key)
        ]
    }
