import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm


# Directorio persistente donde se almacenan las claves.
KEYS_DIR = Path(
    os.getenv(
        "JWT_KEYS_DIR",
        "/var/lib/auth-keys"
    )
)

# Archivo que indica cuál de todas las claves es la activa.
ACTIVE_KEY_FILE = KEYS_DIR / "active.json"


def _crear_directorio():

    KEYS_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


def _generar_kid():
    #Genera un identificador único para cada clave RSA.
    
    fecha = datetime.now(
        timezone.utc
    ).strftime("%Y%m%d%H%M%S")

    aleatorio = secrets.token_hex(4)

    return f"auth-rsa-{fecha}-{aleatorio}"


def _ruta_clave(kid):
    #Devuelve la ruta del archivo privado asociado a un kid.

    return KEYS_DIR / f"{kid}.pem"


def _guardar_clave_privada(kid, private_key):
    #Guarda una clave RSA privada en formato PEM.

    ruta = _ruta_clave(kid)

    contenido = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    ruta.write_bytes(contenido)

    # Limita los permisos del archivo dentro de sistemas Unix/Linux.
    try:
        os.chmod(ruta, 0o600)
    except OSError:
        pass


def _guardar_clave_activa(kid):
    #Guarda cuál es el kid que debe utilizarse para firmar los nuevos access tokens.
    

    temporal = KEYS_DIR / "active.tmp"

    temporal.write_text(
        json.dumps({
            "activeKid": kid
        }),
        encoding="utf-8"
    )

    # Reemplazo atómico para evitar dejar active.json incompleto.
    os.replace(
        temporal,
        ACTIVE_KEY_FILE
    )


def _leer_clave_activa():
    #Obtiene el kid de la clave RSA actualmente activa.

    if not ACTIVE_KEY_FILE.exists():
        return None

    try:

        datos = json.loads(
            ACTIVE_KEY_FILE.read_text(
                encoding="utf-8"
            )
        )

        return datos.get("activeKid")

    except (
        json.JSONDecodeError,
        OSError
    ):
        return None


def _cargar_clave_privada(kid):
    #Carga desde disco la clave privada correspondiente al kid.

    ruta = _ruta_clave(kid)

    if not ruta.exists():
        raise RuntimeError(
            f"No existe la clave privada para el kid {kid}"
        )

    return serialization.load_pem_private_key(
        ruta.read_bytes(),
        password=None
    )


def _crear_nueva_clave():
    #Genera una nueva clave RSA de 2048 bits y la guarda.

    kid = _generar_kid()

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    _guardar_clave_privada(
        kid,
        private_key
    )

    return kid, private_key


def ensure_keyring():
    #Garantiza que exista al menos una clave RSA.


    _crear_directorio()

    kid_activo = _leer_clave_activa()

    # Caso normal: existe active.json y su clave también existe.
    if (
        kid_activo
        and _ruta_clave(kid_activo).exists()
    ):
        return

    # Si existen claves pero falta active.json, recupera la más reciente como activa.
    claves_existentes = sorted(
        KEYS_DIR.glob("auth-rsa-*.pem"),
        key=lambda ruta: ruta.stat().st_mtime,
        reverse=True
    )

    if claves_existentes:

        kid = claves_existentes[0].stem

        _guardar_clave_activa(kid)

        return

    # Primer arranque: no existe ninguna clave.
    kid, _ = _crear_nueva_clave()

    _guardar_clave_activa(kid)

    print(
        f"Primera clave RSA generada: {kid}"
    )


def get_active_signing_key():
   # Devuelve el kid y la clave privada activa.


    ensure_keyring()

    kid = _leer_clave_activa()

    if not kid:
        raise RuntimeError(
            "No fue posible determinar la clave activa"
        )

    private_key = _cargar_clave_privada(kid)

    return kid, private_key


def get_public_jwks():
    #Devuelve las claves públicas de todas las claves conservadas.

    ensure_keyring()

    keys = []

    for ruta in sorted(
        KEYS_DIR.glob("auth-rsa-*.pem")
    ):

        kid = ruta.stem

        private_key = serialization.load_pem_private_key(
            ruta.read_bytes(),
            password=None
        )

        public_key = private_key.public_key()

        jwk = RSAAlgorithm.to_jwk(
            public_key,
            as_dict=True
        )

        jwk["kid"] = kid
        jwk["use"] = "sig"
        jwk["alg"] = "RS256"
        jwk["key_ops"] = ["verify"]

        keys.append(jwk)

    return {
        "keys": keys
    }


def rotate_key():
    #Genera una nueva clave RSA y la convierte en la activa.
    ensure_keyring()

    kid_anterior = _leer_clave_activa()

    nuevo_kid, _ = _crear_nueva_clave()

    _guardar_clave_activa(
        nuevo_kid
    )

    return {
        "previousKid": kid_anterior,
        "activeKid": nuevo_kid
    }


def list_keys():

    ensure_keyring()

    activa = _leer_clave_activa()

    claves = []

    for ruta in sorted(
        KEYS_DIR.glob("auth-rsa-*.pem")
    ):

        claves.append({
            "kid": ruta.stem,
            "active": ruta.stem == activa
        })

    return {
        "activeKid": activa,
        "keys": claves
    }


def main():

    import sys

    comando = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "list"
    )

    if comando == "rotate":

        resultado = rotate_key()

        print("Rotacion completada.")
        print(
            "Clave anterior:",
            resultado["previousKid"]
        )
        print(
            "Nueva clave activa:",
            resultado["activeKid"]
        )

    elif comando == "list":

        resultado = list_keys()

        print(
            "Clave activa:",
            resultado["activeKid"]
        )

        print("\nClaves publicadas:")

        for clave in resultado["keys"]:

            indicador = (
                "*"
                if clave["active"]
                else "-"
            )

            print(
                indicador,
                clave["kid"]
            )

    elif comando == "init":

        ensure_keyring()

        print(
            "Llavero inicializado correctamente."
        )

    else:

        print(
            "Uso: python jwt_keys.py "
            "[init|list|rotate]"
        )

        raise SystemExit(1)


if __name__ == "__main__":
    main()