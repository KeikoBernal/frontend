import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { io } from 'socket.io-client';
import PlanillaUniversal from './PlanillaUniversal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function AnotadorDashboard({ usuario, cerrarSesion }) {
  const [partidos, setPartidos] = useState([]);
  const [partidoActivo, setPartidoActivo] = useState(null);
  const [jugadoresLocal, setJugadoresLocal] = useState([]);
  const [jugadoresVisita, setJugadoresVisita] = useState([]);

  const [efectividadJugadores, setEfectividadJugadores] = useState({});
  const [puntosPorManoLocal, setPuntosPorManoLocal] = useState(Array(20).fill(''));
  const [puntosPorManoVisita, setPuntosPorManoVisita] = useState(Array(20).fill(''));
  
  // Controles de Anotador
  const [manoActual, setManoActual] = useState(1);
  const [modalRegistro, setModalRegistro] = useState(null); // { jId, mIdx }
  
  // Cronómetro
  const [tiempo, setTiempo] = useState(0);
  const [cronometroActivo, setCronometroActivo] = useState(false);

  const socketRef = useRef(null);

  const fetchConToken = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return await fetch(`${API_URL}/operativo${endpoint}`, {
      ...options, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
  };

  useEffect(() => { cargarPartidosAsignados(); return () => socketRef.current?.disconnect(); }, []);

  // Lógica del Cronómetro
  useEffect(() => {
    let interval;
    if (cronometroActivo) interval = setInterval(() => setTiempo(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [cronometroActivo]);

  const formatoTiempo = () => {
    const m = Math.floor(tiempo / 60).toString().padStart(2, '0');
    const s = (tiempo % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cargarPartidosAsignados = async () => {
    const res = await fetchConToken('/mis-partidos');
    if (res.ok) setPartidos(await res.json());
  };

  const seleccionarPartido = async (partido) => {
    setPartidoActivo(partido);
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('unirse_partido', partido.id);

    socketRef.current.on('actualizar_planilla', (data) => {
      if (data.efectividad) setEfectividadJugadores(data.efectividad);
      if (data.tantosLocal) setPuntosPorManoLocal(data.tantosLocal);
      if (data.tantosVisita) setPuntosPorManoVisita(data.tantosVisita);
      if (data.estadoPartido) setPartidoActivo(prev => ({ ...prev, estado: data.estadoPartido }));
      if (data.hora_inicio) setPartidoActivo(prev => ({ ...prev, hora_inicio: data.hora_inicio }));
      if (data.hora_final) setPartidoActivo(prev => ({ ...prev, hora_final: data.hora_final }));
    });

    const res = await fetchConToken(`/partidos/${partido.id}/nomina`);
    if (res.ok) {
      const todos = await res.json();
      setJugadoresLocal(todos.filter(j => j.equipo_id === partido.equipo_local_id));
      setJugadoresVisita(todos.filter(j => j.equipo_id === partido.equipo_visita_id));
    }
  };

  const handleIniciarPartido = async () => {
    const horaDispositivo = new Date().toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    try {
      const res = await fetchConToken(`/partidos/${partidoActivo.id}/iniciar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hora_inicio: horaDispositivo })
      });

      const data = await res.json();

      if (res.ok) {
        const horaMarcada = data.hora_inicio || horaDispositivo;
        setPartidoActivo(prev => ({ ...prev, estado: 'En Curso', hora_inicio: horaMarcada }));
        socketRef.current?.emit('partido_iniciado', { partidoId: partidoActivo.id, hora_inicio: horaMarcada });
      } else {
        alert(data.error || 'Error al iniciar partido.');
      }
    } catch (e) {
      console.error('Error de red al iniciar:', e);
    }
  };

  const finalizarPartido = async () => {
    if (!window.confirm('¿Cerrar acta y registrar hora final?')) return;
    const horaDispositivo = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
    const res = await fetchConToken(`/partidos/${partidoActivo.id}/finalizar`, {
      method: 'PUT', body: JSON.stringify({ hora_final: horaDispositivo })
    });
    const data = await res.json();
    if (res.ok) {
      setPartidoActivo(prev => ({ ...prev, estado: 'Finalizado', hora_final: data.hora_final || horaDispositivo }));
      setCronometroActivo(false);
      socketRef.current?.emit('partido_finalizado', { partidoId: partidoActivo.id, hora_final: data.hora_final });
      alert('Acta de Partido Finalizada.');
    }
  };

  // Enviar jugada desde los botones grandes del modal
  const registrarLanzamiento = (valor) => {
    socketRef.current?.emit('proponer_jugada', {
      partido_id: partidoActivo.id, jugador_id: modalRegistro.jId, mano_index: modalRegistro.mIdx, valor
    });
    setModalRegistro(null);
  };

  // Registrar puntos por mano desde el panel del anotador
  const anotarPuntos = (esLocal, puntos) => {
    let nuevoLocal = [...puntosPorManoLocal];
    let nuevoVisita = [...puntosPorManoVisita];
    const idx = manoActual - 1;

    if (esLocal) { nuevoLocal[idx] = puntos; nuevoVisita[idx] = 0; } 
    else { nuevoVisita[idx] = puntos; nuevoLocal[idx] = 0; }

    setPuntosPorManoLocal(nuevoLocal);
    setPuntosPorManoVisita(nuevoVisita);
    
    socketRef.current?.emit('tantos_asignados', {
      partido_id: partidoActivo.id, mano_index: idx, tantosLocal: nuevoLocal, tantosVisita: nuevoVisita
    });
    if (manoActual < 20) setManoActual(m => m + 1);
  };

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '15px' }}>
      
      {/* Modal Simplificado para Registrar Jugada */}
      {modalRegistro && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div style={{ background: '#FFF', padding: '25px', borderRadius: '8px', maxWidth: '350px', textAlign: 'center' }}>
            <h3>Mano #{modalRegistro.mIdx + 1} - Elegir Acción</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '20px 0' }}>
              <button onClick={() => registrarLanzamiento('A')} style={{ padding: '15px', background: '#3182CE', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '1.2em' }}>A (Válido)</button>
              <button onClick={() => registrarLanzamiento('a')} style={{ padding: '15px', background: '#E53E3E', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '1.2em' }}>a (Nulo)</button>
              <button onClick={() => registrarLanzamiento('B')} style={{ padding: '15px', background: '#38A169', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '1.2em' }}>B (Válido)</button>
              <button onClick={() => registrarLanzamiento('b')} style={{ padding: '15px', background: '#E53E3E', color: '#FFF', border: 'none', borderRadius: '4px', fontSize: '1.2em' }}>b (Nulo)</button>
              <button onClick={() => registrarLanzamiento('AL')} style={{ padding: '15px', background: '#EDF2F7', border: '1px solid #CBD5E0', borderRadius: '4px', fontWeight: 'bold' }}>AL</button>
              <button onClick={() => registrarLanzamiento('AB')} style={{ padding: '15px', background: '#EDF2F7', border: '1px solid #CBD5E0', borderRadius: '4px', fontWeight: 'bold' }}>AB</button>
              <button onClick={() => registrarLanzamiento('BL')} style={{ padding: '15px', background: '#EDF2F7', border: '1px solid #CBD5E0', borderRadius: '4px', fontWeight: 'bold' }}>BL</button>
              <button onClick={() => registrarLanzamiento('BB')} style={{ padding: '15px', background: '#EDF2F7', border: '1px solid #CBD5E0', borderRadius: '4px', fontWeight: 'bold' }}>BB</button>
            </div>
            <button onClick={() => setModalRegistro(null)} style={{ width: '100%', padding: '10px', border: 'none' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>📝 Oficial de Mesa (Anotador)</h2>
        <button onClick={cerrarSesion}>Cerrar Sesión</button>
      </div>

      {!partidoActivo ? (
        <div>
          <h3>Mis Partidos Asignados</h3>
          {partidos.map(p => (
            <button key={p.id} onClick={() => seleccionarPartido(p)} style={{ padding: '12px', width: '100%', textAlign: 'left', marginBottom: '8px', background: '#F0FFF4', border: '1px solid #38A169' }}>
              <strong>{p.local_nombre} vs {p.visita_nombre}</strong> - Sede: {p.sede_nombre}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button onClick={() => setPartidoActivo(null)}>⬅️ Volver</button>
            {partidoActivo.estado === 'En Curso' && (
              <button onClick={finalizarPartido} style={{ background: '#E53E3E', color: 'white', padding: '8px 14px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>🏁 Finalizar Acta</button>
            )}
          </div>

          {/* PANEL DE CONTROL EXCLUSIVO DEL ANOTADOR */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            
            {/* Cronómetro */}
            <div style={{ flex: '1', background: '#2D3748', color: 'white', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>⏱️ Cronómetro Oficial</h3>
              <div style={{ fontSize: '2.5em', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatoTiempo()}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                <button onClick={() => setCronometroActivo(!cronometroActivo)} style={{ padding: '8px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{cronometroActivo ? '⏸ Pausar' : '▶️ Reanudar'}</button>
                <button onClick={() => { setTiempo(0); setCronometroActivo(false); }} style={{ padding: '8px 15px', background: '#E53E3E', color: 'white', border: 'none', borderRadius: '4px' }}>Reset</button>
              </div>
            </div>

            {/* Marcador Rápido por Mano */}
            <div style={{ flex: '2', background: '#EDF2F7', padding: '15px', borderRadius: '6px', border: '1px solid #CBD5E0' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Tantos - Mano #{manoActual}</h3>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div>
                  <strong>{partidoActivo.local_nombre}</strong>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                    {[1,2,3,4,5,6].map(p => <button key={p} onClick={() => anotarPuntos(true, p)} style={{ background: '#3182CE', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>+{p}</button>)}
                  </div>
                </div>
                <div>
                  <strong>{partidoActivo.visita_nombre}</strong>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                    {[1,2,3,4,5,6].map(p => <button key={p} onClick={() => anotarPuntos(false, p)} style={{ background: '#D69E2E', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>+{p}</button>)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <PlanillaUniversal
            rol="anotador"
            partidoId={partidoActivo.id}
            estadoPartido={partidoActivo.estado}
            datosPartido={{
              arbitro: partidoActivo.arbitro_nombre, anotador: partidoActivo.anotador_nombre,
              capitanLocal: partidoActivo.capitan_local_nombre, capitanVisita: partidoActivo.capitan_visita_nombre,
              horaInicio: partidoActivo.hora_inicio, horaFinal: partidoActivo.hora_final,
              localNombre: partidoActivo.local_nombre, visitaNombre: partidoActivo.visita_nombre,
              fecha: partidoActivo.fecha_hora ? new Date(partidoActivo.fecha_hora).toLocaleDateString('es-VE') : ''
            }}
            jugadoresLocal={jugadoresLocal} jugadoresVisita={jugadoresVisita}
            efectividadJugadores={efectividadJugadores}
            puntosPorManoLocal={puntosPorManoLocal} puntosPorManoVisita={puntosPorManoVisita}
            alHacerClicCelda={(jId, mIdx) => setModalRegistro({ jId, mIdx })}
            alIniciarCronometro={handleIniciarPartido}
          />
        </div>
      )}
    </div>
  );
}