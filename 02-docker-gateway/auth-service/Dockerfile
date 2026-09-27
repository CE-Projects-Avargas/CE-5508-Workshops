FROM python:3.12-slim

WORKDIR /auth

COPY requirements.txt .

#Instala las dependencias necesarias para la API de autenticación
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

#Inicia la API Flask dentro del contenedor
CMD ["python", "auth.py"]