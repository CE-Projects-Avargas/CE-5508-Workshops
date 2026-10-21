const { pool } = require('../db');

// Crea un dispositivo nuevo.
async function crearDevice({
  serial,
  nombre,
  ownerType,
  ownerId
}) {
  const [resultado] = await pool.execute(
    `
      INSERT INTO Devices (
        serial,
        nombre,
        owner_type,
        owner_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      serial,
      nombre,
      ownerType,
      ownerId
    ]
  );

  return {
    id: resultado.insertId,
    serial,
    nombre,
    ownerType,
    ownerId
  };
}

// Busca un dispositivo por su id.
async function obtenerDevicePorId(id) {
  const [filas] = await pool.execute(
    `
      SELECT
        id,
        serial,
        nombre,
        owner_type AS ownerType,
        owner_id AS ownerId
      FROM Devices
      WHERE id = ?
    `,
    [id]
  );

  return filas[0] || null;
}

module.exports = {
  crearDevice,
  obtenerDevicePorId
};