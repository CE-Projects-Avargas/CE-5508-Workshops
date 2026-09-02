// Arranque del servicio — ya funciona. No hace falta tocarlo.
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');
const { arrancarBucle } = require('./bucle');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) =>
  res.json({ status: 'ok', servicio: 'pump-service', taller: 2 }));

app.use('/bombas', require('./routes/bombas'));

const PORT = process.env.PORT || 4002;

async function start() {
  for (let i = 1; i <= 10; i++) {
    try { await pool.query('SELECT 1'); console.log('Conexion a MariaDB establecida'); break; }
    catch { console.log(`BD no lista (${i}/10), reintento en 3s...`); await new Promise(r => setTimeout(r, 3000)); }
  }
  arrancarBucle();                       // el avance de las bombas
  app.listen(PORT, () => console.log(`pump-service en http://localhost:${PORT}`));
}
start();
