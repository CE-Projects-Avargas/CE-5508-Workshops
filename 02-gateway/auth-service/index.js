const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    servicio: 'Servicio de autenticación'
  });
});

app.post('/register', async (req, res) => {
  const nombre = req.body.nombre?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!nombre || !email || !password) {
    return res.status(400).json({
      error: 'Nombre, email y password son obligatorios'
    });
  }

  try {
    const [usuariosExistentes] = await pool.execute(
      'SELECT id FROM Usuarios WHERE email = ?',
      [email]
    );

    if (usuariosExistentes.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un usuario con ese email'
      });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);

    const [resultado] = await pool.execute(
      'INSERT INTO Usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre, email, passwordHasheado]
    );

    return res.status(201).json({
      mensaje: 'Usuario registrado correctamente',
      usuario: {
        id: resultado.insertId,
        nombre,
        email
      }
    });
  } catch (error) {
    console.error('Error al registrar:', error);

    return res.status(500).json({
      error: 'No se pudo registrar el usuario'
    });
  }
});

app.post('/login', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email y password son obligatorios'
    });
  }

  try {
    const [usuarios] = await pool.execute(
      'SELECT id, nombre, email, password FROM Usuarios WHERE email = ?',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      });
    }

    const usuario = usuarios[0];

    const passwordCorrecto = await bcrypt.compare(
      password,
      usuario.password
    );

    if (!passwordCorrecto) {
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      });
    }

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);

    return res.status(500).json({
      error: 'No se pudo iniciar sesión'
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Auth-service corriendo en http://localhost:${PORT}`);
});