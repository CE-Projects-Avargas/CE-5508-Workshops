import { useEffect, useState } from 'react';
import { 
    listarBombas, 
    listarProductos, 
    crearBomba, 
    editarBomba, 
    programarBomba, 
    iniciarBomba,
    pausarBomba,
    detenerBomba,
    eliminarBomba
} from '../api.js';

export default function Bombas({ proyectoId }) {
    const [bombas, setBombas] = useState([]);
    const [mensaje, setMensaje] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [productos, setProductos] = useState([]);
    const [accion, setAccion] = useState(null);
    const [bombaSeleccionada, setBombaSeleccionada] = useState(null);
    const [guardando, setGuardando] = useState(false);
    
    const [formCrear, setFormCrear] = useState({
        serie: '',
        ubicacion: '',
        productoId: '',
        volumenObjetivoMl: '',
        caudalMlH: ''
    });
    const [formEditar, setFormEditar] = useState({
        ubicacion: '',
        productoId: '',
        volumenObjetivoMl: '',
        caudalMlH: ''
    });
    const [formProgramar, setFormProgramar] = useState({
        programadaPara: '',
        volumenObjetivoMl: '',
        caudalMlH: ''
    });
    const [formIniciar, setFormIniciar] = useState({
        volumenObjetivoMl: '',
        caudalMlH: ''
    });

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

    async function cargarProductos() {
    try {
        const datos = await listarProductos();
        setProductos(datos);
    } catch (err) {
        setMensaje({
        tipo: 'error',
        texto: err.message
        });
    }
    }

    useEffect(() => {
        cargarBombas();
        cargarProductos();
    }, [proyectoId]);

    function abrirCrear() {
        setBombaSeleccionada(null);
        setAccion('crear');
        setMensaje(null);
    }

    function abrirEditar(bomba) {
        setBombaSeleccionada(bomba);
        setFormEditar({
            ubicacion: bomba.ubicacion || '',
            productoId: bomba.productoId || '',
            volumenObjetivoMl: bomba.volumenObjetivoMl || '',
            caudalMlH: bomba.caudalMlH || ''
        });
        setAccion('editar');
        setMensaje(null);
    }

    function abrirProgramar(bomba) {
        setBombaSeleccionada(bomba);
        setFormProgramar({
            programadaPara: '',
            volumenObjetivoMl: bomba.volumenObjetivoMl || '',
            caudalMlH: bomba.caudalMlH || ''
        });
        setAccion('programar');
        setMensaje(null);
    }

    function abrirIniciar(bomba) {
        setBombaSeleccionada(bomba);
        setFormIniciar({
            volumenObjetivoMl: bomba.volumenObjetivoMl || '',
            caudalMlH: bomba.caudalMlH || ''
        });
        setAccion('iniciar');
        setMensaje(null);
    }

    function cerrarFormulario() {
        setAccion(null);
        setBombaSeleccionada(null);
    }

    function actualizarCampoCrear(e) {
        setFormCrear({
            ...formCrear,
            [e.target.name]: e.target.value
        });
    }

    function actualizarCampoEditar(e) {
        setFormEditar({
            ...formEditar,
            [e.target.name]: e.target.value
        });
    }

    function actualizarCampoProgramar(e) {
        setFormProgramar({
            ...formProgramar,
            [e.target.name]: e.target.value
        });
    }

    function actualizarCampoIniciar(e) {
        setFormIniciar({
            ...formIniciar,
            [e.target.name]: e.target.value
        });
    }

    async function enviarCrear(e) {
        e.preventDefault();

        setGuardando(true);
        setMensaje(null);

        try {
            await crearBomba({
                serie: formCrear.serie,
                proyectoId: proyectoId,
                ubicacion: formCrear.ubicacion,
                productoId: Number(formCrear.productoId),
                volumenObjetivoMl: Number(formCrear.volumenObjetivoMl),
                caudalMlH: Number(formCrear.caudalMlH)
            });

            setMensaje({
                tipo: 'exito',
                texto: 'Bomba creada correctamente.'
            });

            setFormCrear({
                serie: '',
                ubicacion: '',
                productoId: '',
                volumenObjetivoMl: '',
                caudalMlH: ''
            });

            cerrarFormulario();
            await cargarBombas();

        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function enviarEditar(e) {
        e.preventDefault();

        setGuardando(true);
        setMensaje(null);

        try {
            await editarBomba(bombaSeleccionada.id, {
            ubicacion: formEditar.ubicacion,
            productoId: Number(formEditar.productoId),
            volumenObjetivoMl: Number(formEditar.volumenObjetivoMl),
            caudalMlH: Number(formEditar.caudalMlH)
            });

            setMensaje({
            tipo: 'exito',
            texto: 'Bomba actualizada correctamente.'
            });

            cerrarFormulario();
            await cargarBombas();

        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function enviarProgramar(e) {
        e.preventDefault();
        setGuardando(true);
        setMensaje(null);
        try {
            await programarBomba(bombaSeleccionada.id, {
                programadaPara: new Date(formProgramar.programadaPara).toISOString(),
                volumenObjetivoMl: Number(formProgramar.volumenObjetivoMl),
                caudalMlH: Number(formProgramar.caudalMlH)
            });
            setMensaje({
                tipo: 'exito',
                texto: 'Bomba programada correctamente.'
            });
            cerrarFormulario();
            await cargarBombas();
        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function enviarIniciar(e) {
        e.preventDefault();
        setGuardando(true);
        setMensaje(null);
        try {
            await iniciarBomba(bombaSeleccionada.id, {
                volumenObjetivoMl: Number(formIniciar.volumenObjetivoMl),
                caudalMlH: Number(formIniciar.caudalMlH)
            });
            setMensaje({
                tipo: 'exito',
                texto: `Bomba #${bombaSeleccionada.id} iniciada correctamente`
            });
            cerrarFormulario();
            await cargarBombas();
        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function manejarPausarBomba(id) {
        setGuardando(true);
        setMensaje(null);

        try {
            await pausarBomba(id);
            setMensaje({
                tipo: 'exito',
                texto: `Bomba #${id} pausada correctamente.`
            });
            await cargarBombas();
        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function manejarPausarBomba(id) {
        setGuardando(true);
        setMensaje(null);
        try {
            await pausarBomba(id);
            setMensaje({
                tipo: 'exito',
                texto: `Bomba #${id} pausada correctamente.`
            });
            await cargarBombas();
        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    async function manejarEliminarBomba(id) {
        const confirmar = window.confirm(
            `¿Está seguro de que desea eliminar la bomba #${id}?`
        );

        if (!confirmar) {
            return;
        }

        setGuardando(true);
        setMensaje(null);

        try {
            await eliminarBomba(id);

            setMensaje({
                tipo: 'exito',
                texto: `Bomba #${id} eliminada correctamente.`
            });

            await cargarBombas();

        } catch (err) {
            setMensaje({
                tipo: 'error',
                texto: err.message
            });
        } finally {
            setGuardando(false);
        }
    }

    if (cargando) {
        return <p>Cargando bombas...</p>;
    }

    return (
        <section className="bombas">
            <div className="bombas-header"> 
                <h4>Bombas</h4> 
                <button type="button" onClick={abrirCrear}> 
                    + Crear bomba 
                </button> 
            </div>

            {mensaje && ( 
                <div className={`mensaje ${mensaje.tipo}`}> 
                    {mensaje.texto} 
                </div> 
            )}

            {bombas.length === 0 && (
                <p>No hay bombas asociadas a este proyecto.</p>
            )}

            <div className="bombas-grid">
                {bombas.map((bomba) => (
                    <div className="proyecto-card bomba-card" key={bomba.id}>
                        <h3>Bomba #{bomba.id}</h3>
                        <span className="badge">{bomba.estado}</span>
                        <p><strong>Serie:</strong>{bomba.serie}</p>
                        <p><strong>Producto:</strong>{' '}{bomba.producto?.nombre || bomba.productoId}</p>
                        <p><strong>Ubicación:</strong> {bomba.ubicacion}</p>
                        <p><strong>Caudal:</strong> {bomba.caudalMlH} ml/h</p>
                        <p><strong>Volumen objetivo:</strong>{' '}{bomba.volumenObjetivoMl} ml</p>
                        <p><strong>Volumen entregado:</strong>{' '}{bomba.volumenEntregadoMl} ml</p>
                        {bomba.programadaPara && (
                            <small>Programada para: {bomba.programadaPara}</small>
                        )}
                        <div className="bomba-acciones"> 
                            <button type="button" onClick={() => abrirEditar(bomba)} > Editar </button> 
                            <button type="button" onClick={() => abrirProgramar(bomba)} > Programar </button> 
                            <button type="button" onClick={() => abrirIniciar(bomba)} > Iniciar </button> 
                            {bomba.estado === 'infundiendo' && (
                                <button
                                    type="button"
                                    onClick={() => manejarPausarBomba(bomba.id)}
                                    disabled={guardando}
                                >
                                    Pausar
                                </button>
                            )}
                            {bomba.estado !== 'detenida' && (
                                <button
                                    type="button"
                                    onClick={() => manejarDetenerBomba(bomba.id)}
                                    disabled={guardando}
                                >
                                    Detener
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => manejarEliminarBomba(bomba.id)}
                                disabled={guardando}
                            >
                                Eliminar
                            </button>
                        </div>

                    </div>
                ))}
            </div>

            {accion === 'crear' && (
                <div className="bomba-formulario">
                    <h4>Crear bomba</h4>
                    <form onSubmit={enviarCrear}>
                    <label>
                        Serie
                        <input
                        name="serie"
                        value={formCrear.serie}
                        onChange={actualizarCampoCrear}
                        required
                        />
                    </label>
                    <label>
                        Ubicación
                        <input
                        name="ubicacion"
                        value={formCrear.ubicacion}
                        onChange={actualizarCampoCrear}
                        required
                        />
                    </label>
                    <label>
                        Producto
                        <select
                        name="productoId"
                        value={formCrear.productoId}
                        onChange={actualizarCampoCrear}
                        required
                        >
                        <option value="">
                            Seleccione un producto
                        </option>
                        {productos.map((producto) => (
                            <option
                            key={producto.id}
                            value={producto.id}
                            >
                            {producto.nombre}
                            </option>
                        ))}
                        </select>
                    </label>
                    <label>
                        Volumen objetivo (ml)
                        <input
                        type="number"
                        name="volumenObjetivoMl"
                        value={formCrear.volumenObjetivoMl}
                        onChange={actualizarCampoCrear}
                        min="1"
                        required
                        />
                    </label>
                    <label>
                        Caudal (ml/h)
                        <input
                        type="number"
                        name="caudalMlH"
                        value={formCrear.caudalMlH}
                        onChange={actualizarCampoCrear}
                        min="1"
                        required
                        />
                    </label>
                    <div className="bomba-formulario-acciones">
                        <button type="submit" disabled={guardando}>
                        {guardando ? 'Creando...' : 'Crear bomba'}
                        </button>
                        <button
                        type="button"
                        onClick={cerrarFormulario}
                        disabled={guardando}
                        >
                        Cancelar
                        </button>
                    </div>
                    </form>
                </div>
            )}

            {accion === 'editar' && bombaSeleccionada && (
                <div className="bomba-formulario">
                    <h4>Editar bomba #{bombaSeleccionada.id}</h4>
                    <form onSubmit={enviarEditar}>
                    <label>
                        Serie
                        <input
                        type="text"
                        value={bombaSeleccionada.serie}
                        disabled
                        />
                    </label>
                    <label>
                        Ubicación
                        <input
                        name="ubicacion"
                        value={formEditar.ubicacion}
                        onChange={actualizarCampoEditar}
                        required
                        />
                    </label>
                    <label>
                        Producto
                        <select
                        name="productoId"
                        value={formEditar.productoId}
                        onChange={actualizarCampoEditar}
                        required
                        >
                        <option value="">
                            Seleccione un producto
                        </option>
                        {productos.map((producto) => (
                            <option
                            key={producto.id}
                            value={producto.id}
                            >
                            {producto.nombre}
                            </option>
                        ))}
                        </select>
                    </label>
                    <label>
                        Volumen objetivo (ml)
                        <input
                        type="number"
                        name="volumenObjetivoMl"
                        value={formEditar.volumenObjetivoMl}
                        onChange={actualizarCampoEditar}
                        min="1"
                        required
                        />
                    </label>
                    <label>
                        Caudal (ml/h)
                        <input
                        type="number"
                        name="caudalMlH"
                        value={formEditar.caudalMlH}
                        onChange={actualizarCampoEditar}
                        min="1"
                        required
                        />
                    </label>
                    <div className="bomba-formulario-acciones">
                        <button type="submit" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                        type="button"
                        onClick={cerrarFormulario}
                        disabled={guardando}
                        >
                        Cancelar
                        </button>
                    </div>
                    </form>
                </div>
            )}

            {accion === 'programar' && bombaSeleccionada && (
                <div className="bomba-formulario">
                    <h4>Programar bomba #{bombaSeleccionada.id}</h4>
                    <form onSubmit={enviarProgramar}>
                    <label>
                        Serie
                        <input
                        type="text"
                        value={bombaSeleccionada.serie}
                        disabled
                        />
                    </label>
                    <label>
                        Producto
                        <input
                        type="text"
                        value={
                            bombaSeleccionada.producto?.nombre ||
                            bombaSeleccionada.productoId
                        }
                        disabled
                        />
                    </label>
                    <label>
                        Fecha y hora
                        <input
                        type="datetime-local"
                        name="programadaPara"
                        value={formProgramar.programadaPara}
                        onChange={actualizarCampoProgramar}
                        required
                        />
                    </label>
                    <label>
                        Volumen objetivo (ml)
                        <input
                        type="number"
                        name="volumenObjetivoMl"
                        value={formProgramar.volumenObjetivoMl}
                        onChange={actualizarCampoProgramar}
                        min="1"
                        required
                        />
                    </label>
                    <label>
                        Caudal (ml/h)
                        <input
                        type="number"
                        name="caudalMlH"
                        value={formProgramar.caudalMlH}
                        onChange={actualizarCampoProgramar}
                        min="1"
                        required
                        />
                    </label>
                    <div className="bomba-formulario-acciones">
                        <button type="submit" disabled={guardando}>
                        {guardando ? 'Programando...' : 'Programar bomba'}
                        </button>
                        <button
                        type="button"
                        onClick={cerrarFormulario}
                        disabled={guardando}
                        >
                        Cancelar
                        </button>
                    </div>
                    </form>
                </div>
            )}

            {accion === 'iniciar' && bombaSeleccionada && (
                <div className="bomba-formulario">
                    <h4>Iniciar bomba #{bombaSeleccionada.id}</h4>
                    <form onSubmit={enviarIniciar}>
                    <label>
                        Serie
                        <input
                        type="text"
                        value={bombaSeleccionada.serie}
                        disabled
                        />
                    </label>
                    <label>
                        Producto
                        <input
                        type="text"
                        value={
                            bombaSeleccionada.producto?.nombre ||
                            bombaSeleccionada.productoId
                        }
                        disabled
                        />
                    </label>
                    <label>
                        Volumen objetivo (ml)
                        <input
                        type="number"
                        name="volumenObjetivoMl"
                        value={formIniciar.volumenObjetivoMl}
                        onChange={actualizarCampoIniciar}
                        min="1"
                        required
                        />
                    </label>
                    <label>
                        Caudal (ml/h)
                        <input
                        type="number"
                        name="caudalMlH"
                        value={formIniciar.caudalMlH}
                        onChange={actualizarCampoIniciar}
                        min="1"
                        required
                        />
                    </label>
                    <div className="bomba-formulario-acciones">
                        <button type="submit" disabled={guardando}>
                        {guardando ? 'Iniciando...' : 'Iniciar bomba'}
                        </button>
                        <button
                        type="button"
                        onClick={cerrarFormulario}
                        disabled={guardando}
                        >
                        Cancelar
                        </button>
                    </div>
                    </form>
                </div>
            )}
        </section>
    );
}