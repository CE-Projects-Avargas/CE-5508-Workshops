import os
import mysql.connector # type: ignore
from fastapi import FastAPI, HTTPException, Header # type: ignore
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

ACCESS_TOKEN_EXPIRE = 5
REFRESH_TOKEN_EXPIRE = 20

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

used_refresh_tokens = set()

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
# ACCESS TOKEN
# --------------------------------------------------

def create_access_token(user):
    now = datetime.utcnow()

    payload = {
        "sub": str(user["id"]),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE),
    }

    if "email" in user:
        payload["email"] = user["email"]

    return jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={
            "kid": KEY_ID
        }
    )


# --------------------------------------------------
# REFRESH TOKEN
# --------------------------------------------------

def create_refresh_token(user):
    now = datetime.utcnow()

    payload = {
        "sub": str(user["id"]),
        "iss": ISSUER,
        "aud": ISSUER,
        "type": REFRESH_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=REFRESH_TOKEN_EXPIRE),
    }

    return jwt.encode(
        payload,
        private_key,
        algorithm="RS256",
        headers={
            "kid": KEY_ID
        }
    )


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
    refresh_token: str


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

        access_token = create_access_token(db_user)
        refresh_token = create_refresh_token(db_user)

        return {
            "authenticated": True,
            "message": "Login exitoso",
            "access_token": access_token,
            "refresh_token": refresh_token,
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


# --------------------------------------------------
# REFRESH
# --------------------------------------------------

@app.post("/refresh")
def refresh_token(request: RefreshRequest):
    try:
        payload = jwt.decode(
            request.refresh_token,
            public_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            audience=ISSUER,
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Refresh token expirado"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Refresh token inválido"
        )

    if payload.get("type") != REFRESH_TOKEN_TYPE:
        raise HTTPException(
            status_code=401,
            detail="El token no es un refresh token"
        )

    if request.refresh_token in used_refresh_tokens:
        raise HTTPException(
            status_code=401,
            detail="Refresh token ya utilizado"
        )

    used_refresh_tokens.add(request.refresh_token)

    user = {
        "id": payload["sub"]
    }

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }


# --------------------------------------------------
# VERIFY ACCESS TOKEN
# --------------------------------------------------

@app.get("/verify")
def verify_token(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header requerido"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header inválido"
        )

    token = authorization[len("Bearer "):].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Access token requerido"
        )

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            audience=AUDIENCE,
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Access token expirado"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Access token inválido"
        )

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise HTTPException(
            status_code=401,
            detail="El token no es un access token"
        )

    return {
        "valid": True,
        "sub": payload.get("sub")
    }
