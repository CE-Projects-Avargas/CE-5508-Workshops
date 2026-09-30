"""Agrega una clave RSA nueva (rotacion).

Uso:
    docker compose exec auth-service python rotar_clave.py
    docker compose restart auth-service

Despues: los tokens nuevos usan el kid nuevo, el JWKS publica las DOS claves,
y los tokens firmados con la vieja siguen siendo aceptados por backend.
"""
from claves import generar_clave

if __name__ == "__main__":
    kid = generar_clave()
    print(f"Listo. Reinicia auth-service para que empiece a firmar con kid={kid}")