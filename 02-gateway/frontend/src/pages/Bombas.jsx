import { useEffect, useState } from 'react';
import { listarBombas } from '../api.js';

export default function Bombas({ proyectoId }) {
  const [bombas, setBombas] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(true);

  async function cargarBombas() {
    setCargando(true);
    setMensaje(null);

    try {
      const datos = await listarBombas(proyectoId);
      setBombas(datos);
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.message
      });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarBombas();
  }, [proyectoId]);

  if (cargando) {
    return <p>Cargando bombas...</p>;
  }

  if (mensaje) {
    return (
      <div className={`mensaje ${mensaje.tipo}`}>
        {mensaje.texto}
      </div>
    );
  }

  return (
    <section className="bombas">
        <h4>Bombas</h4>

        {bombas.length === 0 && (
        <p>No hay bombas asociadas a este proyecto.</p>
        )}

        <div className="bombas-grid">
        {bombas.map((bomba) => (
            <div className="proyecto-card bomba-card" key={bomba.id}>
            <h3>Bomba #{bomba.id}</h3>

            <span className="badge">{bomba.estado}</span>

            <p>
                <strong>Serie:</strong> {bomba.serie}
            </p>

            <p>
                <strong>Producto:</strong>{' '}
                {bomba.producto?.nombre || bomba.productoId}
            </p>

            <p>
                <strong>Ubicación:</strong> {bomba.ubicacion}
            </p>

            <p>
                <strong>Caudal:</strong> {bomba.caudalMlH} ml/h
            </p>

            <p>
                <strong>Volumen objetivo:</strong>{' '}
                {bomba.volumenObjetivoMl} ml
            </p>

            <p>
                <strong>Volumen entregado:</strong>{' '}
                {bomba.volumenEntregadoMl} ml
            </p>

            {bomba.programadaPara && (
                <small>
                Programada para: {bomba.programadaPara}
                </small>
            )}
            </div>
        ))}
        </div>
    </section>
    );
}