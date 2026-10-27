const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Notificacion = sequelize.define('Notificacion', {
  eventId: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  type: { type: DataTypes.STRING(100), allowNull: false },
  deviceId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  ownerType: { type: DataTypes.ENUM('user', 'project'), allowNull: true },
  ownerId: { type: DataTypes.INTEGER, allowNull: true },
  mensaje: { type: DataTypes.STRING(700), allowNull: false },
  payload: { type: DataTypes.TEXT, allowNull: false },
  occurredAt: { type: DataTypes.DATE(3), allowNull: false }
}, { tableName: 'Notificaciones', updatedAt: false });   // una notificacion no se modifica

module.exports = Notificacion;
