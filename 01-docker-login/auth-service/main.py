import os

import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt


app = FastAPI(title="Auth Service")

# Permite que el frontend (otro origen: localhost:5173) llame a este
# servicio (localhost:8000). Sin esto el navegador bloquea las
# peticiones fetch() por la politica de CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


        return {
            "authenticated": True,
            "message": "Login exitoso",
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
