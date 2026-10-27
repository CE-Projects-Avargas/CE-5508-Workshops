import { useEffect, useState } from 'react';
import {
  consultarDispositivo,
  listarDispositivos,
  listarProyectos,
  registrarDispositivo,
  reportarAlerta
} from '../api.js';

const DISPOSITIVO_INICIAL = { serial: '', nombre: '', ownerType: 'user', ownerId: '' };
const ALERTA_INICIAL = { deviceId: '', level: 'warning', message: '' };

// Consume device-service a traves del gateway (la misma URL que proyectos).
// Un dispositivo es del usuario o de uno de sus proyectos. La lista solo trae
// los que el usuario puede ver; "Consultar por id" sirve para probar el 403 con
// un dispositivo ajeno. Cada registro y cada alerta publican un evento en
// RabbitMQ que notification-service registra por su cuenta.
export default function Dispositivos({ usuario }) {
  const [form, setForm] = useState(DISPOSITIVO_INICIAL);
  const [alerta, setAlerta] = useState(ALERTA_INICIAL);
  const [dispositivos, setDispositivos] = useState([]);
  const [misProyectos, setMisProyectos] = useState([]);
  const [idConsulta, setIdConsulta] = useState('');
  const [consultado, setConsultado] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    try {
      const [lista, proyectos] = await Promise.all([listarDispositivos(), listarProyectos()]);
      setDispositivos(lista);
      setMisProyectos(proyectos.filter((p) => p.ownerId === usuario.id));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function actualizarAlerta(e) {
    setAlerta({ ...alerta, [e.target.name]: e.target.value });
  }

  async function registrar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const datos = { serial: form.serial, nombre: form.nombre, ownerType: form.ownerType };
      datos.ownerId = form.ownerType === 'project' ? Number(form.ownerId) : usuario.id;
      const creado = await registrarDispositivo(datos);
      setMensaje({ tipo: 'exito', texto: `Dispositivo ${creado.id} registrado (evento device.registered)` });
      setForm(DISPOSITIVO_INICIAL);
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  async function enviarAlerta(e) {
    e.preventDefault();
    setMensaje(null);
    try {
      const r = await reportarAlerta(alerta.deviceId, { level: alerta.level, message: alerta.message });
      setMensaje({ tipo: 'exito', texto: `Alerta aceptada (evento ${r.eventId})` });
      setAlerta({ ...ALERTA_INICIAL, deviceId: alerta.deviceId });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  async function consultar(e) {
    e.preventDefault();
    setConsultado(null);
    try {
      setConsultado({ ok: true, device: await consultarDispositivo(idConsulta) });
    } catch (err) {
      setConsultado({ ok: false, texto: err.message });
    }
  }

  const dueno = (d) =>
    d.ownerType === 'user'
      ? `usuario ${d.ownerId}${d.ownerId === usuario.id ? ' (tú)' : ''}`
      : `proyecto ${d.ownerId}`;

  return (
    <>
      <h1>Registrar dispositivo</h1>
      <form onSubmit={registrar}>
        <label>
          Serial
          <input name="serial" value={form.serial} onChange={actualizarCampo} required />
        </label>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={actualizarCampo} required />
        </label>
        <label>
          Dueño
          <select name="ownerType" value={form.ownerType} onChange={actualizarCampo}>
            <option value="user">Yo</option>
            <option value="project">Uno de mis proyectos</option>
          </select>
        </label>
        {form.ownerType === 'project' && (
          <label>
            Proyecto
            <select name="ownerId" value={form.ownerId} onChange={actualizarCampo} required>
              <option value="">Elegir...</option>
              {misProyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Registrando...' : 'Registrar'}
        </button>
      </form>

      <h1 style={{ marginTop: '2rem' }}>Reportar anomalía</h1>
      <form onSubmit={enviarAlerta}>
        <label>
          Dispositivo
          <select name="deviceId" value={alerta.deviceId} onChange={actualizarAlerta} required>
            <option value="">Elegir...</option>
            {dispositivos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} · {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nivel
          <select name="level" value={alerta.level} onChange={actualizarAlerta}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label>
          Mensaje
          <input name="message" value={alerta.message} onChange={actualizarAlerta} maxLength={500} required />
        </label>
        <button type="submit">Reportar</button>
      </form>

      <h1 style={{ marginTop: '2rem' }}>Consultar por id</h1>
      <form onSubmit={consultar}>
        <label>
          Id del dispositivo
          <input type="number" min="1" value={idConsulta} onChange={(e) => setIdConsulta(e.target.value)} required />
        </label>
        {consultado && !consultado.ok && <div className="mensaje error">{consultado.texto}</div>}
        {consultado?.ok && (
          <div className="mensaje exito">
            {consultado.device.nombre} (serial {consultado.device.serial}) · dueño: {dueno(consultado.device)}
          </div>
        )}
        <button type="submit">Consultar</button>
      </form>

      <h1 style={{ marginTop: '2rem' }}>Mis dispositivos</h1>
      {dispositivos.length === 0 && <p>No tienes dispositivos todavía.</p>}
      {dispositivos.map((d) => (
        <div className="proyecto-card" key={d.id}>
          <h3>
            {d.id} · {d.nombre}
          </h3>
          <span className="badge">{d.ownerType === 'user' ? 'personal' : 'de proyecto'}</span>
          <small>
            Serial: {d.serial} · Dueño: {dueno(d)}
          </small>
        </div>
      ))}
    </>
  );
}
