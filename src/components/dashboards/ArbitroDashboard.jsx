import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { io } from 'socket.io-client';
import PlanillaUniversal from './PlanillaUniversal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function ArbitroDashboard({ usuario, cerrarSesion }) {
  const [partidos, setPartidos] = useState([]);
  const [partidoActivo, setPartidoActivo] = useState(null);
  const [jugadoresLocal, setJugadoresLocal] = useState([]);
  const [jugadoresVisita, setJugadoresVisita] = useState([]);

  const [efectividadJugadores, setEfectividadJugadores] = useState({});
  const [puntosPorManoLocal, setPuntosPorManoLocal] = useState(Array(20).fill(''));
  const [puntosPorManoVisita, setPuntosPorManoVisita] = useState(Array(20).fill(''));
  const [jugadaPendienteSel, setJugadaPendienteSel] = useState(null);
  
  // Controles del Árbitro
  const [jugadorSancionId, setJugadorSancionId] = useState('');
  const [sorteoInfo, setSorteoInfo] = useState('');

  const socketRef = useRef(null);

  const fetchConToken = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return await fetch(`${API_URL}/operativo${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, ...options.headers },
    });
  };

  useEffect(() => { cargarPartidosAsignados(); return () => socketRef.current?.disconnect(); }, []);

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

  const suspenderPartido = async () => {
    if (!window.confirm('¿Estás seguro de SUSPENDER el partido por fuerza mayor?')) return;
    const res = await fetchConToken(`/partidos/${partidoActivo.id}/suspender`, { method: 'PUT' });
    if (res.ok) {
      setPartidoActivo(prev => ({ ...prev, estado: 'Suspendido' }));
      socketRef.current?.emit('partido_suspendido', { partidoId: partidoActivo.id, motivo: 'Fuerza Mayor / Decisión Arbitral' });
      alert('Partido Suspendido.');
    }
  };

  const emitirTarjeta = (color) => {
    if (!jugadorSancionId) return alert('Selecciona un jugador.');
    const j = [...jugadoresLocal, ...jugadoresVisita].find(x => x.id === parseInt(jugadorSancionId));
    if (!window.confirm(`¿Amonestar con tarjeta ${color.toUpperCase()} a ${j.nombre} ${j.apellido}?`)) return;
    socketRef.current?.emit('tarjeta_emitida', { partido_id: partidoActivo.id, jugador_id: j.id, nombre: `${j.nombre}`, color });
    setJugadorSancionId('');
    alert(`Tarjeta ${color} registrada en acta.`);
  };

  const resolverJugada = (aprobada) => {
    socketRef.current?.emit('resolver_jugada', {
      partido_id: partidoActivo.id,
      jugador_id: jugadaPendienteSel.jId,
      mano_index: jugadaPendienteSel.mIdx,
      aprobada
    });
    setJugadaPendienteSel(null);
  };

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', padding: '15px' }}>
      
      {/* Modal de Validación Arbitral */}
      {jugadaPendienteSel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div style={{ background: '#FFF', padding: '25px', borderRadius: '8px', textAlign: 'center' }}>
            <h3>⚖️ Validar Anotación Propuesta</h3>
            <p>El anotador registró: <strong>{jugadaPendienteSel.jug?.valor}</strong> en la mano #{jugadaPendienteSel.mIdx + 1}.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => resolverJugada(true)} style={{ flex: 1, padding: '10px', background: '#38A169', color: 'white', border: 'none', borderRadius: '4px' }}>✅ Aprobar</button>
              <button onClick={() => resolverJugada(false)} style={{ flex: 1, padding: '10px', background: '#E53E3E', color: 'white', border: 'none', borderRadius: '4px' }}>❌ Nula / Rechazar</button>
            </div>
            <button onClick={() => setJugadaPendienteSel(null)} style={{ marginTop: '10px', background: 'transparent', border: 'none' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>⚖️ Autoridad de Campo (Árbitro)</h2>
        <button onClick={cerrarSesion}>Cerrar Sesión</button>
      </div>

      {!partidoActivo ? (
        <div>
          <h3>Mis Partidos Asignados</h3>
          {partidos.map(p => (
            <button key={p.id} onClick={() => seleccionarPartido(p)} style={{ padding: '12px', width: '100%', textAlign: 'left', marginBottom: '8px', background: '#EBF8FF', border: '1px solid #3182CE' }}>
              <strong>{p.local_nombre} vs {p.visita_nombre}</strong> - Sede: {p.sede_nombre}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setPartidoActivo(null)} style={{ marginBottom: '10px' }}>⬅️ Volver</button>
          
          {/* PANEL DE CONTROL EXCLUSIVO DEL ÁRBITRO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px', background: '#F7FAFC', padding: '15px', borderRadius: '6px', border: '1px solid #CBD5E0' }}>
            <div>
              <h4 style={{ margin: '0 0 10px 0' }}>🪙 Sorteo Inicial</h4>
              <input type="text" placeholder="Ej: Local gana mingo, Visita escoge rojo..." value={sorteoInfo} onChange={e => setSorteoInfo(e.target.value)} style={{ width: '100%', padding: '6px' }} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px 0' }}>⚠️ Sanciones (Tarjetas)</h4>
              <div style={{ display: 'flex', gap: '5px' }}>
                <select value={jugadorSancionId} onChange={e => setJugadorSancionId(e.target.value)} style={{ flex: 1, padding: '6px' }}>
                  <option value="">Seleccione infractor...</option>
                  {[...jugadoresLocal, ...jugadoresVisita].map(j => <option key={j.id} value={j.id}>#{j.numero_dorsal} {j.apellido}</option>)}
                </select>
                <button onClick={() => emitirTarjeta('Amarilla')} style={{ background: '#D69E2E', color: 'white', border: 'none', padding: '6px' }}>🟨</button>
                <button onClick={() => emitirTarjeta('Roja')} style={{ background: '#E53E3E', color: 'white', border: 'none', padding: '6px' }}>🟥</button>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>🛑 Control de Juego</h4>
              <button onClick={suspenderPartido} style={{ background: '#E53E3E', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Suspender Partido</button>
            </div>
          </div>

          <PlanillaUniversal
            rol="arbitro"
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
            alHacerClicCelda={(jId, mIdx, jug) => setJugadaPendienteSel({ jId, mIdx, jug })}
            alIniciarCronometro={handleIniciarPartido}
          />
        </div>
      )}
    </div>
  );
}