# Llaves RSA de auth-service: una por kid, guardadas como <kid>.pem en el volumen auth-keys
import os
import re
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


KEYS_DIR = os.getenv("KEYS_DIR", "/app/keys")
PATRON = re.compile(r"^auth-key-(\d+)\.pem$")


def _numero(kid):
    return int(kid.rsplit("-", 1)[1])


def _kids_existentes():
    return sorted(
        (m.group(0)[:-4] for m in map(PATRON.match, os.listdir(KEYS_DIR)) if m),
        key=_numero,
    )


def nueva_llave():
    # Crea auth-key-N+1; queda activa la proxima vez que arranque el servicio
    os.makedirs(KEYS_DIR, exist_ok=True)
    kids = _kids_existentes()
    kid = f"auth-key-{_numero(kids[-1]) + 1 if kids else 1}"

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    ruta = os.path.join(KEYS_DIR, f"{kid}.pem")
    with open(ruta, "wb") as f:
        f.write(pem)
    os.chmod(ruta, 0o600)
    return kid


def cargar_llaves():
    # Devuelve (kid_activo, {kid: llave_privada}); la activa es la de numero mas alto
    os.makedirs(KEYS_DIR, exist_ok=True)

    # Compatibilidad con la version anterior (private.pem / public.pem)
    viejo = os.path.join(KEYS_DIR, "private.pem")
    if os.path.exists(viejo) and not _kids_existentes():
        os.rename(viejo, os.path.join(KEYS_DIR, "auth-key-1.pem"))

    if not _kids_existentes():
        nueva_llave()

    llaves = {}
    for kid in _kids_existentes():
        with open(os.path.join(KEYS_DIR, f"{kid}.pem"), "rb") as f:
            llaves[kid] = serialization.load_pem_private_key(f.read(), password=None)

    return _kids_existentes()[-1], llaves


if __name__ == "__main__":
    # docker compose exec auth-service python keys.py rotar
    if sys.argv[1:] == ["rotar"]:
        print(f"Nueva llave: {nueva_llave()} (reinicien auth-service para firmar con ella)")
    else:
        print("Uso: python keys.py rotar")
