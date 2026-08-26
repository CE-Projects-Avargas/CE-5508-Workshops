const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Usuario = require('../models/Usuario');

// ============================================================
// TALLER DE HOY: completa los dos endpoints de este archivo.
// Usa routes/proyectos.js como referencia del patrón general
// (router.post, try/catch, res.status().json()).
// ============================================================

// POST /auth/register
router.post('/register', async (req, res) => {
  // TODO 1: obtén { email, password, nombre } de req.body

  // TODO 2: hashea el password con bcrypt antes de guardarlo
  //   pista: const hash = await bcrypt.hash(password, 10);
  //   nunca guardes el password original en la base de datos

  // TODO 3: crea el usuario con Usuario.create({ ... })
  //   guarda el hash en el campo "password", no el password original

  // TODO 4: responde con status 201 y el usuario creado
  //   (no devuelvas el password en la respuesta)

  res.status(501).json({ error: 'TODO: implementar /auth/register' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  // TODO 1: obtén { email, password } de req.body

  // TODO 2: busca el usuario por email con Usuario.findOne({ where: { email } })
  //   si no existe, responde 401 con un mensaje de error

  // TODO 3: compara el password recibido contra el hash guardado
  //   pista: const valido = await bcrypt.compare(password, usuario.password);
  //   si no es válido, responde 401

  // TODO 4: si las credenciales son correctas, firma un JWT
  //   pista: jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '2h' })

  // TODO 5: responde con el token: res.json({ token })

  res.status(501).json({ error: 'TODO: implementar /auth/login' });
});

module.exports = router;
