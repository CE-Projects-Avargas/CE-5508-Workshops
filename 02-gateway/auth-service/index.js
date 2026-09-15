const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const pool = require('./db');
const { inicializarClaves, obtenerClaveActual, construirJWKS, rotarClave } = require('./keys');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4001;
const ISS = process.env.JWT_ISS || 'auth-service';
const AUD = process.env.JWT_AUD || 'ce5508-taller2';
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_HORAS = Number(process.env.REFRESH_TOKEN_TTL_HOURS || 8);

inicializarClaves();

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'CE5508 - Auth Service (Taller 2)' });
});

// Publico, sin token. Cualquier servicio puede consultarlo para
// verificar firmas sin conocer la llave privada.
app.get('/auth/jwks', (req, res) => {
  res.json(construirJWKS());
});

// Endpoint interno de conveniencia para rotar la llave de firma en
// caliente sin tumbar el servicio.
app.post('/auth/rotar-clave', (req, res) => {
  const kid = rotarClave();
  res.json({ mensaje: 'Llave rotada', kid });
});

app.post('/auth/register', async (req, res) => {
  const nombre = req.body.nombre?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son obligatorios' });
  }

  try {
    const [existentes] = await pool.execute('SELECT id FROM Usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);
    const [resultado] = await pool.execute(
      'INSERT INTO Usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre, email, passwordHasheado]
    );

    return res.status(201).json({
      id: resultado.insertId,
      email,
      nombre
    });
  } catch (error) {
    console.error('Error al registrar:', error);
    return res.status(500).json({ error: 'No se pudo registrar el usuario' });
  }
});

// Firma un access token corto y genera un refresh opaco (no-JWT),
// guardando solo su hash en la base, si la base se filtra, el
// hash no sirve para autenticarse.
async function emitirPar(usuario) {
  const { kid, privateKey } = obtenerClaveActual();

  const accessToken = jwt.sign(
    { email: usuario.email, nombre: usuario.nombre },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: kid,
      subject: String(usuario.id),
      issuer: ISS,
      audience: AUD,
      expiresIn: ACCESS_TTL
    }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiraEn = new Date(Date.now() + REFRESH_TTL_HORAS * 60 * 60 * 1000);

  await pool.execute(
    'INSERT INTO RefreshTokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [usuario.id, refreshHash, expiraEn]
  );

  // expiresIn en segundos, como es convencion en OAuth2/JWT
  const decodificado = jwt.decode(accessToken);
  const expiresIn = decodificado.exp - decodificado.iat;

  return { accessToken, refreshToken, expiresIn };
}

app.post('/auth/login', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password son obligatorios' });
  }

  try {
    const [usuarios] = await pool.execute(
      'SELECT id, nombre, email, password FROM Usuarios WHERE email = ?',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = usuarios[0];
    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const par = await emitirPar(usuario);
    return res.status(200).json(par);
  } catch (error) {
    console.error('Error al iniciar sesion:', error);
    return res.status(500).json({ error: 'No se pudo iniciar sesion' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: 'refreshToken requerido' });
  }

  try {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [filas] = await pool.execute(
      `SELECT rt.id, rt.usuario_id, rt.expires_at, rt.revoked_at, u.nombre, u.email
       FROM RefreshTokens rt
       JOIN Usuarios u ON u.id = rt.usuario_id
       WHERE rt.token_hash = ?`,
      [hash]
    );

    if (filas.length === 0) {
      return res.status(401).json({ error: 'Refresh token invalido' });
    }

    const fila = filas[0];
    const vencido = new Date(fila.expires_at) < new Date();

    if (fila.revoked_at || vencido) {
      return res.status(401).json({ error: 'Refresh token vencido o ya usado' });
    }

    // Rotacion donde el refresh usado queda invalidado de inmediato,
    // aunque no haya expirado en un solo uso por token.
    await pool.execute('UPDATE RefreshTokens SET revoked_at = NOW() WHERE id = ?', [fila.id]);

    const par = await emitirPar({ id: fila.usuario_id, nombre: fila.nombre, email: fila.email });
    return res.status(200).json(par);
  } catch (error) {
    console.error('Error al refrescar sesion:', error);
    return res.status(500).json({ error: 'No se pudo refrescar la sesion' });
  }
});

app.listen(PORT, () => {
  console.log(`auth-service corriendo en http://localhost:${PORT}`);
});
