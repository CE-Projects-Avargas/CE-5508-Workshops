const jwt = require('jsonwebtoken');

// ============================================================
// TALLER: completa este middleware una vez que /auth/login
// esté generando tokens correctamente. Todavía no lo conectes
// a routes/proyectos.js — eso lo harán en una sesión futura.
// ============================================================

module.exports = function verificarToken(req, res, next) {
  // TODO 1: lee el header Authorization de la petición
  //   pista: const header = req.headers.authorization;
  //   si no existe, responde 401 con un mensaje de error

  // TODO 2: extrae el token del header
  //   el formato es "Bearer <token>", el token es la segunda parte
  //   pista: const token = header.split(' ')[1];

  // TODO 3: verifica el token con jwt.verify(token, process.env.JWT_SECRET)
  //   envuélvelo en try/catch: si falla, responde 401 "Token invalido o expirado"

  // TODO 4: si el token es válido, guarda el payload en req.usuario
  //   y llama a next() para continuar con la petición

  res.status(501).json({ error: 'TODO: implementar middleware de verificacion de token' });
};
