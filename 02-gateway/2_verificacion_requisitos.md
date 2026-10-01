# 2. Verificación de los requisitos

## Objetivo

La verificación se realizó de forma progresiva, levantando primero la
infraestructura y después comprobando los servicios y las rutas
involucradas. Se utilizaron principalmente Docker Compose, la terminal y
Docker Desktop.

## 2.1 Levantamiento del sistema

Primero se levantó el proyecto mediante Docker Compose:

``` bash
docker compose up --build
```

Con esto se comprobó que los servicios definidos en el
`docker-compose.yml` pudieran construir sus imágenes y arrancar.

Posteriormente se revisó el estado de los servicios con:

``` bash
docker compose ps
```

Esto permitió comprobar qué contenedores estaban activos y cuáles habían
tenido algún problema al iniciar.

## 2.2 Comprobación de imágenes y contenedores

También se revisaron las imágenes creadas por Docker:

``` bash
docker images
```

y los contenedores que se encontraban ejecutándose:

``` bash
docker ps
```

Estas comprobaciones permitieron verificar que los componentes del
sistema estaban siendo ejecutados mediante contenedores y que Docker
estaba utilizando las imágenes correspondientes.

Además, se utilizó Docker Desktop para revisar visualmente los
contenedores, su estado y los servicios que estaban levantados.

## 2.3 Comprobación por etapas

Las pruebas se realizaron por etapas para poder identificar problemas de
infraestructura antes de probar el flujo completo:

1.  Se levantó Docker Compose.
2.  Se comprobó el estado de los contenedores.
3.  Se revisaron las imágenes generadas.
4.  Se verificó desde Docker Desktop que los contenedores estuvieran
    activos.
5.  Se comprobó el acceso al gateway mediante el puerto configurado.
6.  Cuando fue necesario, se revisaron los logs de los servicios para
    identificar errores de configuración o comunicación.

Para revisar los logs de un servicio se puede utilizar:

``` bash
docker compose logs <servicio>
```

Por ejemplo:

``` bash
docker compose logs gateway
```

También se utilizó la opción de mostrar las últimas líneas para
facilitar el diagnóstico:

``` bash
docker compose logs gateway --tail=100
```

## 2.4 Comprobación de las rutas

El acceso a la aplicación y a las APIs se comprobó utilizando las
direcciones expuestas por Docker y el gateway.

Se tuvo en cuenta la diferencia entre acceder a la interfaz principal y
acceder directamente a una ruta de API. Por ejemplo:

``` text
http://localhost:8080/
```

corresponde al acceso al sistema mediante el gateway, mientras que:

``` text
http://localhost:8080/api
```

corresponde a una ruta de API y su respuesta depende de las rutas
configuradas en Nginx.

## 2.5 Comprobaciones de seguridad

Para la parte de autenticación se consideraron las pruebas definidas
para el taller, incluyendo solicitudes con y sin token y el
comportamiento esperado ante credenciales o tokens inválidos.

La comprobación se realizó de forma incremental, primero verificando que
los servicios levantaran correctamente y después comprobando el
comportamiento de las rutas protegidas.
