const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Alert = sequelize.define('Alert', {
  deviceId: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.ENUM('info', 'warning', 'critical'), allowNull: false },
  message: { type: DataTypes.STRING(500), allowNull: false }
}, { tableName: 'Alerts', updatedAt: false });   // una alerta no se modifica

module.exports = Alert;