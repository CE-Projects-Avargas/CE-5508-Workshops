"""Manejo de las claves RSA con las que auth-service firma los JWT.

- La clave PRIVADA vive solo en KEYS_DIR (en Docker, un volumen montado
  unicamente en auth-service). Nunca va al repositorio.
- La clave PUBLICA se publica en formato JWKS en GET /auth/jwks.
- Cada clave tiene un "kid". Pueden existir varias (rotacion): se firma con
  la mas nueva, pero el JWKS publica todas.

Cada clave se guarda como  <KEYS_DIR>/<kid>.pem
"""
import datetime
import json
import os
import secrets

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

KEYS_DIR = os.getenv("KEYS_DIR", "/keys")


def _nuevo_kid():
    # Ej: 20260930-043500-1ed043 -> fecha legible + sufijo aleatorio
    ahora = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{ahora}-{secrets.token_hex(3)}"


def generar_clave():
    """Genera un par RSA de 2048 bits y guarda la privada como <kid>.pem."""
    os.makedirs(KEYS_DIR, exist_ok=True)
    privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    kid = _nuevo_kid()
    ruta = os.path.join(KEYS_DIR, f"{kid}.pem")
    tmp = ruta + ".tmp"            # se escribe aparte y se renombra: nadie lee un archivo a medias
    with open(tmp, "wb") as f:
        f.write(pem)
    os.chmod(tmp, 0o600)
    os.replace(tmp, ruta)
    print(f"Nueva clave RSA generada, kid={kid}")
    return kid


def cargar_claves():
    """Lee todas las claves; si no hay ninguna, genera una.
    Devuelve [(kid, clave_privada)] de la mas vieja a la mas nueva."""
    os.makedirs(KEYS_DIR, exist_ok=True)
    archivos = sorted(f for f in os.listdir(KEYS_DIR) if f.endswith(".pem"))
    if not archivos:
        generar_clave()
        archivos = sorted(f for f in os.listdir(KEYS_DIR) if f.endswith(".pem"))

    claves = []
    for nombre in archivos:
        with open(os.path.join(KEYS_DIR, nombre), "rb") as f:
            privada = serialization.load_pem_private_key(f.read(), password=None)
        claves.append((nombre[:-4], privada))
    return claves


def clave_activa(claves):
    """La clave con la que se firma: la mas nueva."""
    return claves[-1]


def jwks(claves):
    """JSON Web Key Set (RFC 7517) con la parte PUBLICA de cada clave."""
    keys = []
    for kid, privada in claves:
        jwk = json.loads(RSAAlgorithm.to_jwk(privada.public_key()))
        jwk.pop("key_ops", None)   # el RFC recomienda no mezclar key_ops con use
        jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
        keys.append(jwk)
    return {"keys": keys}