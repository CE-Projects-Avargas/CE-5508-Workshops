const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Proyecto = sequelize.define('Proyecto', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  encargado: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tipoDispositivo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  criticidad: {
    type: DataTypes.ENUM('bajo', 'medio', 'alto', 'critico'),
    defaultValue: 'medio'
  },
  estado: {
    type: DataTypes.ENUM('planificacion', 'desarrollo', 'pruebas', 'produccion'),
    defaultValue: 'planificacion'
  }
});

module.exports = Proyecto;
