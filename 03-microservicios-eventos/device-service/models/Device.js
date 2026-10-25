const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Device = sequelize.define('Device', {
  serial: { type: DataTypes.STRING, allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  ownerType: { type: DataTypes.ENUM('user', 'project'), allowNull: false, defaultValue: 'user' },
  ownerId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'Devices' });

module.exports = Device;