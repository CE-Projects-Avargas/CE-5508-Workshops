"""Conexion a la misma MariaDB que usa el backend de /proyectos.

En docker-compose las variables DB_* ya se inyectan. Fuera de Docker,
se leen de un archivo .env (ver .env.example).
"""
import os
import time

import pymysql
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "root123"),
    "database": os.getenv("DB_NAME", "dispositivos_medicos"),
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": True,
}


def get_connection():
    """Abre una conexion nueva a MariaDB."""
    return pymysql.connect(**DB_CONFIG)


def esperar_base_de_datos(max_intentos=10, espera=3):
    """MariaDB tarda unos segundos en aceptar conexiones al arrancar.

    Reintenta igual que hace el backend de Node en su index.js.
    """
    for intento in range(1, max_intentos + 1):
        try:
            conn = get_connection()
            conn.close()
            print("Conexion a MariaDB establecida")
            return
        except pymysql.err.OperationalError:
            print(
                f"No se pudo conectar a la BD (intento {intento}/{max_intentos}), "
                f"reintentando en {espera}s..."
            )
            time.sleep(espera)
    raise RuntimeError("No se pudo conectar a MariaDB tras varios intentos")
