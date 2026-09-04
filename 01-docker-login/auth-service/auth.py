import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import mysql.connector

from flask import Flask, request, jsonify
from flask_cors import CORS
from mysql.connector import IntegrityError, Error


auth = Flask(__name__)

# Permite que el frontend React haga peticiones al servicio
CORS(auth, origins=["http://localhost:5173"])

#Aquí se abre la misma base de MariaDB 
def conectar_bd():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "mariadb"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "dispositivos_medicos"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root123")
    )

#Verifica que el servicio de autenticación está funcionando
@auth.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "auth-service"
    }), 200


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
        #Si las credenciales son correctas, se genera un token JWT con la información del usuario y una fecha de expiración de 2 horas
        token = jwt.encode(
            {
                "usuario_id": usuario["id"],
                "email": usuario["email"],
                "exp": datetime.now(timezone.utc) + timedelta(hours=2)
            },
            os.getenv("JWT_SECRET", "clave-desarrollo-taller1"),
            algorithm="HS256"
        )

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


if __name__ == "__main__":

    puerto = int(os.getenv("PORT", "5000"))

    auth.run(
        host="0.0.0.0",
        port=puerto
    )