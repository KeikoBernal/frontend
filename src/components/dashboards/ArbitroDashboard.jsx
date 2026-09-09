import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function ArbitroDashboard({ usuario, cerrarSesion }) {
  const [partidos, setPartidos] = useState([]);
  const [partidoActivo, setPartidoActivo] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [jugadorSeleccionadoId, setJugadorSeleccionadoId] = useState('');
  const [manoActual, setManoActual] = useState(1);
  const [validaciones, setValidaciones] = useState([]);
  
  const [debeCambiarPass, setDebeCambiarPass] = useState(false);
  const [nuevaClave, setNuevaClave] = useState('');
  
  const socketRef = useRef(null);

  const fetchConToken = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return await fetch(`${API_URL}/operativo${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, ...options.headers },
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.debe_cambiar_password) setDebeCambiarPass(true);
    });
    cargarPartidosAsignados();
    cargarValidaciones();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const cambiarClaveObligatoria = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/cambiar-password-obligatorio', { 
      method: 'POST', 
      body: JSON.stringify({ nueva_password: nuevaClave }) 
    });
    const data = await res.json();
    if (res.ok) { alert('Contraseña actualizada con éxito.'); setDebeCambiarPass(false); }
    else { alert(data.error || 'Error al actualizar la contraseña.'); }
  };

  const cargarPartidosAsignados = async () => {
    const res = await fetchConToken('/mis-partidos');
    if (res.ok) setPartidos(await res.json());
  };

  const cargarValidaciones = async () => {
    const res = await fetchConToken('/mis-validaciones');
    if (res.ok) setValidaciones(await res.json());
  };

  const seleccionarPartido = async (partido) => {
    setPartidoActivo(partido);
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('unirse_partido', partido.id);

    const res = await fetchConToken(`/partidos/${partido.id}/nomina`);
    if (res.ok) setJugadores(await res.json());
  };

  const jugadorObj = jugadores.find(j => j.id === parseInt(jugadorSeleccionadoId));

  const declararJugada = (tipoDestreza, efectividad) => {
    if (!jugadorSeleccionadoId) return alert('Selecciona un jugador primero.');
    socketRef.current.emit('decision_arbitro', {
      partido_id: partidoActivo.id, 
      mano_id: manoActual, 
      jugador_id: jugadorSeleccionadoId,
      nombre_jugador: `${jugadorObj?.nombre} ${jugadorObj?.apellido}`,
      numero_dorsal: jugadorObj?.numero_dorsal,
      tipo_destreza: tipoDestreza, 
      efectividad: efectividad, 
      minuto_registro: new Date().toISOString()
    });
    alert(`Acción registrada: ${tipoDestreza.toUpperCase()} - ${efectividad ? 'VÁLIDA' : 'NULA'}`);
  };

  const emitirTarjeta = (color) => {
    if (!jugadorSeleccionadoId) return alert('Selecciona un jugador primero.');
    if (!window.confirm(`¿Confirmas emitir tarjeta ${color.toUpperCase()} a #${jugadorObj?.numero_dorsal} ${jugadorObj?.nombre}?`)) return;
    
    socketRef.current.emit('tarjeta_emitida', {
      partido_id: partidoActivo.id, 
      jugador_id: jugadorSeleccionadoId, 
      nombre_jugador: `${jugadorObj?.nombre} ${jugadorObj?.apellido}`,
      color: color, 
      minuto_registro: new Date().toISOString()
    });
  };

  const suspenderPartido = () => {
    const motivo = prompt('Indique el motivo de la suspensión:');
    if (!motivo) return;
    socketRef.current.emit('suspender_partido', { partido_id: partidoActivo.id, motivo });
    alert('Partido Suspendido.');
    setPartidoActivo(null);
    cargarPartidosAsignados();
  };

  const resolverValidacion = async (partidoId, aprobado) => {
    const res = await fetchConToken(`/validar-cambio/${partidoId}`, { 
      method: 'POST', 
      body: JSON.stringify({ aprobado }) 
    });
    const data = await res.json();
    alert(data.mensaje);
    cargarValidaciones();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
      {debeCambiarPass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <h3>🔒 Cambio Obligatorio de Contraseña</h3>
            <form onSubmit={cambiarClaveObligatoria} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="password" placeholder="Nueva Contraseña (mín 6 chars)" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)} required minLength={6} />
              <button type="submit" style={{ background: '#3182CE', color: 'white', padding: '10px', border: 'none', borderRadius: '4px' }}>Actualizar Contraseña</button>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>⚖️ Panel de Árbitro</h2>
        <button onClick={cerrarSesion}>Cerrar Sesión</button>
      </div>

      {!partidoActivo ? (
        <div>
          {validaciones.length > 0 && (
            <div style={{ background: '#FFF5F5', padding: '15px', border: '1px solid #E53E3E', marginBottom: '20px', borderRadius: '6px' }}>
              <h3 style={{ color: '#E53E3E', marginTop: 0 }}>⚠️ Solicitudes Administrativas</h3>
              {validaciones.map(v => (
                <div key={v.partido_id} style={{ background: '#FFF', padding: '10px', margin: '5px 0', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <p>Administración solicita dar a <strong>{v.nuevo_ganador_nombre}</strong> como ganador en <strong>{v.local} vs {v.visita}</strong>.</p>
                  <div style={{ marginTop: '10px' }}>
                    <button onClick={() => resolverValidacion(v.partido_id, true)} style={{ background: '#38A169', color: 'white', marginRight: '10px', padding: '8px 12px', border: 'none', cursor: 'pointer' }}>Aprobar Cambio</button>
                    <button onClick={() => resolverValidacion(v.partido_id, false)} style={{ background: '#718096', color: 'white', padding: '8px 12px', border: 'none', cursor: 'pointer' }}>Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3>Mis Partidos Asignados</h3>
          {partidos.length === 0 ? <p>No tienes partidos programados.</p> : (
            partidos.map(p => (
              <button key={p.id} onClick={() => seleccionarPartido(p)} style={{ padding: '15px', width: '100%', textAlign: 'left', background: '#EBF8FF', border: '1px solid #3182CE', marginBottom: '10px', cursor: 'pointer', borderRadius: '4px' }}>
                <strong>{p.local_nombre} vs {p.visita_nombre}</strong><br/>
                Sede: {p.sede_nombre} | Hora: {new Date(p.fecha_hora).toLocaleTimeString()}
              </button>
            ))
          )}
        </div>
      ) : (
        <div style={{ background: '#FFF', border: '1px solid #CBD5E0', padding: '20px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{partidoActivo.local_nombre} vs {partidoActivo.visita_nombre}</h3>
            <button onClick={() => setPartidoActivo(null)}>Volver</button>
          </div>

          <div style={{ margin: '15px 0', padding: '10px', background: '#EDF2F7', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Mano Actual: {manoActual}</strong>
            <button onClick={() => setManoActual(m => m + 1)}>Avanzar Mano +1</button>
          </div>

          {/* SELECCIÓN DE JUGADOR CON FOTO */}
          <h4 style={{ marginBottom: '8px' }}>👤 Seleccionar Jugador en Turno</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <select value={jugadorSeleccionadoId} onChange={(e) => setJugadorSeleccionadoId(e.target.value)} style={{ flex: 1, padding: '10px' }}>
              <option value="">-- Seleccionar Jugador --</option>
              {jugadores.map(j => (
                <option key={j.id} value={j.id}>
                  #{j.numero_dorsal} - {j.nombre} {j.apellido} ({j.equipo})
                </option>
              ))}
            </select>

            <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: '#CBD5E0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #2B6CB0' }}>
              {jugadorObj?.foto_url ? (
                <img src={jugadorObj.foto_url} alt="Jugador" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '0.65em', color: '#4A5568', textAlign: 'center' }}>Sin Foto</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => declararJugada('arrime', true)} style={{ padding: '15px', background: '#38A169', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🎯 Arrime Válido</button>
            <button onClick={() => declararJugada('boche', true)} style={{ padding: '15px', background: '#2B6CB0', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>💥 Boche Válido</button>
            <button onClick={() => declararJugada('arrime', false)} style={{ padding: '15px', background: '#718096', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🚫 Arrime Nulo</button>
            <button onClick={() => declararJugada('boche', false)} style={{ padding: '15px', background: '#718096', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🚫 Boche Nulo</button>
          </div>

          <h4>⚠️ Sanciones Disciplinarias</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => emitirTarjeta('amarilla')} style={{ flex: 1, padding: '10px', background: '#D69E2E', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🟨 Tarjeta Amarilla</button>
            <button onClick={() => emitirTarjeta('roja')} style={{ flex: 1, padding: '10px', background: '#E53E3E', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🟥 Tarjeta Roja</button>
          </div>

          {/* BOTÓN PARA ABRIR PANTALLA DE PUNTAJES EN VIVO */}
          <button 
            onClick={() => window.open(`/?vista=puntajes&partido_id=${partidoActivo.id}`, '_blank')} 
            style={{ width: '100%', padding: '12px', background: '#3182CE', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}
          >
            📺 Proyectar Pantalla de Puntajes (Nueva Pest.)
          </button>

          <button onClick={suspenderPartido} style={{ width: '100%', padding: '10px', background: '#E53E3E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ⏸ Suspender Partido
          </button>
        </div>
      )}
    </div>
  );
}