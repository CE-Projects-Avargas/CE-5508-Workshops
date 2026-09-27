import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import mysql.connector
import secrets
import hashlib

from flask import Flask, request, jsonify
from mysql.connector import IntegrityError, Error

from jwt.algorithms import RSAAlgorithm
from cryptography.hazmat.primitives import serialization


auth = Flask(__name__)


# Configuración de firma asimétrica de los access tokens.
# Solo auth-service tiene acceso a la clave privada RSA.
PRIVATE_KEY_PATH = os.getenv(
    "JWT_PRIVATE_KEY_PATH",
    "/run/secrets/auth_private.pem"
)

#Identifica la clave utilizada para permitir futuras rotaciones de claves sin invalidar los tokens existentes
JWT_KID = "auth-rsa-2026-01"

# Configuración de los tokens JWT
JWT_ISSUER = "ce5508-auth"
JWT_AUDIENCE = "ce5508-backend"

#Access tokens expiran en 15 minutos, refresh tokens expiran en 8 horas
ACCESS_TOKEN_SECONDS = 900
REFRESH_TOKEN_SECONDS = 28800


# Carga la clave privada RSA montada únicamente en auth-service
with open(PRIVATE_KEY_PATH, "rb") as archivo:
    PRIVATE_KEY = serialization.load_pem_private_key(
        archivo.read(),
        password=None
    )


# Obtiene la clave pública correspondiente a la privada(se publica mediante JWKS)
PUBLIC_KEY = PRIVATE_KEY.public_key()



# Genera un JWT firmado con la clave privada RSA
def generar_access_token(usuario):

    ahora = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": str(usuario["id"]),
            "email": usuario["email"],
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "iat": ahora,
            "exp": ahora + timedelta(
                seconds=ACCESS_TOKEN_SECONDS
            )
        },
        PRIVATE_KEY,
        algorithm="RS256",
        headers={
            "kid": JWT_KID
        }
    )

    return token

# Genera un refresh token aleatorio y calcula su hash SHA-256(solo el hash se almacena en la base de datos)
def generar_refresh_token():

    refresh_token = secrets.token_urlsafe(48)

    token_hash = hashlib.sha256(
        refresh_token.encode("utf-8")
    ).hexdigest()

    return refresh_token, token_hash


#Función para conectarse a la base de datos MySQL
def conectar_bd():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "auth-db"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "auth_db"),
        user=os.getenv("DB_USER", "auth_user"),
        password=os.getenv("DB_PASSWORD", "auth123")
    )

#Endpoint para comprobar que auth-service está disponible.
@auth.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "auth-service"
    }), 200


# Expone la clave pública RSA para verificar los JWT
@auth.route("/jwks", methods=["GET"])
def jwks():

    clave_publica = RSAAlgorithm.to_jwk(
        PUBLIC_KEY,
        as_dict=True
    )

    #Añade los metadatos necesarios para identificar el uso y el algoritmo de la clave pública
    clave_publica["kid"] = JWT_KID
    clave_publica["use"] = "sig"
    clave_publica["alg"] = "RS256"

    return jsonify({
        "keys": [
            clave_publica
        ]
    }), 200

#Registra un usuario nuevo en auth-db
@auth.route("/register", methods=["POST"])
def register():

    datos = request.get_json(silent=True) or {}

    nombre = datos.get("nombre", "").strip()
    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")


    #Revisa que se envien todos los datos indispensables 
    if not nombre or not email or not password:
        return jsonify({
            "error": "Nombre, email y password son obligatorios"
        }), 400

    # Convertimos la contraseña a bytes
    password_bytes = password.encode("utf-8")

    # Generamos un hash seguro con bcrypt
    password_hash = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    )

    # Lo convertimos a texto para almacenarlo en VARCHAR(255)
    password_hash = password_hash.decode("utf-8")

    conexion = None
    cursor = None

    try:

        conexion = conectar_bd()
        cursor = conexion.cursor()
        #Inserta al usuario que se está registrando en la base de datos
        cursor.execute(
            """
            INSERT INTO Usuarios (email, password, nombre)
            VALUES (%s, %s, %s)
            """,
            (email, password_hash, nombre)
        )

        conexion.commit()

        return jsonify({
            "mensaje": "Usuario registrado correctamente",
            "usuario": {
                "id": cursor.lastrowid,
                "nombre": nombre,
                "email": email
            }
        }), 201

    #El error si se quiere crear un usuario con un correo que ya otro usuario tiene
    except IntegrityError:

        return jsonify({
            "error": "Ya existe un usuario con ese email"
        }), 409

    except Error as error:

        print("Error de base de datos:", error)

        return jsonify({
            "error": "Error interno del servidor"
        }), 500

    #Libera los recursos de la base de datos, cierra el cursor y la conexión
    finally:

        if cursor:
            cursor.close()

        if conexion and conexion.is_connected():
            conexion.close()


#Para validar el login, se revisa que el correo y la contraseña sean correctos
@auth.route("/login", methods=["POST"])
def login():

    datos = request.get_json(silent=True) or {}

    email = datos.get("email", "").strip().lower()
    password = datos.get("password", "")

    if not email or not password:
        return jsonify({
            "error": "Email y password son obligatorios"
        }), 400

    conexion = None
    cursor = None

    try:

        conexion = conectar_bd()
        cursor = conexion.cursor(dictionary=True)
        #Busca el correo para buscar el hash que tenga asociado y poder compararlo con la contraseña que se está enviando
        cursor.execute(
            """
            SELECT id, email, password, nombre
            FROM Usuarios
            WHERE email = %s
            """,
            (email,)
        )

        usuario = cursor.fetchone()

        if usuario is None:
            return jsonify({
                "error": "Credenciales incorrectas"
            }), 401
        #Se compara la contraseña que se está enviando con el hash que tiene asociado el correo en la base de datos
        password_correcto = bcrypt.checkpw(
            password.encode("utf-8"),
            usuario["password"].encode("utf-8")
        )

        if not password_correcto:
            return jsonify({
                "error": "Credenciales incorrectas"
            }), 401
        #Si las credenciales son correctas, se genera un token JWT con la información del usuario y una fecha de expiración de 5 segundos
        
        
        # Genera un access token firmado con la clave privada RSA
        ahora = datetime.now(timezone.utc)

        token = jwt.encode(
            {
                "sub": str(usuario["id"]),
                "email": usuario["email"],
                "iss": JWT_ISSUER,
                "aud": JWT_AUDIENCE,
                "iat": ahora,
                "exp": ahora + timedelta(seconds=ACCESS_TOKEN_SECONDS)
            },
            PRIVATE_KEY,
            algorithm="RS256",
            headers={
                "kid": JWT_KID
            }
        )
                # Genera las dos credenciales después de validar el login.
        access_token = generar_access_token(usuario)

        refresh_token, token_hash = generar_refresh_token()

        # Calcula la fecha de expiración del refresh token.
        expiracion = (
            datetime.now(timezone.utc)
            + timedelta(seconds=REFRESH_TOKEN_SECONDS)
        ).replace(tzinfo=None)

        # Guarda únicamente el hash del refresh token.
        cursor.execute(
            """
            INSERT INTO RefreshTokens
                (usuario_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (
                usuario["id"],
                token_hash,
                expiracion
            )
        )

        conexion.commit()

        return jsonify({
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "expiresIn": ACCESS_TOKEN_SECONDS,
            "usuario": {
                "id": usuario["id"],
                "nombre": usuario["nombre"],
                "email": usuario["email"]
            }
        }), 200

        return jsonify({
            "mensaje": "Login correcto",
            "token": token,
            "usuario": {
                "id": usuario["id"],
                "nombre": usuario["nombre"],
                "email": usuario["email"]
            }
        }), 200

    except Error as error:

        print("Error de base de datos:", error)

        return jsonify({
            "error": "Error interno del servidor"
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexion and conexion.is_connected():
            conexion.close()


# Renueva las credenciales e invalida el refresh token utilizado.
@auth.route("/refresh", methods=["POST"])
def refresh():

    datos = request.get_json(silent=True) or {}

    refresh_token = datos.get("refreshToken")

    if not isinstance(refresh_token, str) or not refresh_token:
        return jsonify({
            "error": "Refresh token obligatorio"
        }), 400

    # Calcula el hash para buscar el token en la base de datos.
    token_hash = hashlib.sha256(
        refresh_token.encode("utf-8")
    ).hexdigest()

    conexion = None
    cursor = None

    try:

        conexion = conectar_bd()
        cursor = conexion.cursor(dictionary=True)

        # Bloquea el registro mientras se realiza la rotación.
        cursor.execute(
            """
            SELECT
                rt.id,
                rt.expires_at,
                rt.revoked_at,
                u.id AS usuario_id,
                u.nombre,
                u.email

            FROM RefreshTokens rt

            INNER JOIN Usuarios u
                ON rt.usuario_id = u.id

            WHERE rt.token_hash = %s

            FOR UPDATE
            """,
            (token_hash,)
        )

        registro = cursor.fetchone()

        if registro is None:
            return jsonify({
                "error": "Refresh token inválido"
            }), 401

        ahora = datetime.now(timezone.utc).replace(
            tzinfo=None
        )

        # Verifica que no esté vencido ni haya sido utilizado.
        if (
            registro["revoked_at"] is not None
            or registro["expires_at"] <= ahora
        ):
            return jsonify({
                "error": "Refresh token inválido o expirado"
            }), 401

        usuario = {
            "id": registro["usuario_id"],
            "nombre": registro["nombre"],
            "email": registro["email"]
        }

        # Invalida el refresh token anterior.
        cursor.execute(
            """
            UPDATE RefreshTokens
            SET revoked_at = %s
            WHERE id = %s
            """,
            (
                ahora,
                registro["id"]
            )
        )

        # Genera un nuevo par de credenciales.
        nuevo_access_token = generar_access_token(usuario)

        nuevo_refresh_token, nuevo_hash = generar_refresh_token()

        nueva_expiracion = (
            datetime.now(timezone.utc)
            + timedelta(seconds=REFRESH_TOKEN_SECONDS)
        ).replace(tzinfo=None)

        # Almacena el hash del nuevo refresh token.
        cursor.execute(
            """
            INSERT INTO RefreshTokens
                (usuario_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (
                usuario["id"],
                nuevo_hash,
                nueva_expiracion
            )
        )

        conexion.commit()

        return jsonify({
            "accessToken": nuevo_access_token,
            "refreshToken": nuevo_refresh_token,
            "expiresIn": ACCESS_TOKEN_SECONDS
        }), 200

    except Error as error:

        if conexion:
            conexion.rollback()

        print("Error al renovar token:", error)

        return jsonify({
            "error": "Error interno del servidor"
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conexion and conexion.is_connected():
            conexion.close()

if __name__ == "__main__":

    puerto = int(os.getenv("PORT", "5000"))

    auth.run(
        host="0.0.0.0",
        port=puerto
    )