FROM python:3.12-slim

WORKDIR /auth

COPY requirements.txt .

#Instala las dependencias necesarias para la API de autenticación
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

#Para la API de autenticación, se ejecuta el archivo auth.py que contiene la lógica de registro y login de usuarios
CMD ["python", "auth.py"]