import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function AnotadorDashboard({ usuario, cerrarSesion }) {
  const [partidos, setPartidos] = useState([]);
  const [partidoActivo, setPartidoActivo] = useState(null);
  
  const [debeCambiarPass, setDebeCambiarPass] = useState(false);
  const [nuevaClave, setNuevaClave] = useState('');

  const [marcadorLocal, setMarcadorLocal] = useState(0);
  const [marcadorVisita, setMarcadorVisita] = useState(0);
  const [manoActual, setManoActual] = useState(1);
  const [logIncidencias, setLogIncidencias] = useState([]);
  
  const [tiempoJuego, setTiempoJuego] = useState(0);
  const [cronometroActivo, setCronometroActivo] = useState(false);
  
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

  useEffect(() => {
    let intervalo = null;
    if (cronometroActivo) {
      intervalo = setInterval(() => setTiempoJuego(t => t + 1), 1000);
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [cronometroActivo]);

  const formatoTiempo = (segundos) => {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = (segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const cargarPartidosAsignados = async () => {
    const res = await fetchConToken('/mis-partidos');
    if (res.ok) setPartidos(await res.json());
  };

  const seleccionarPartido = (partido) => {
    setPartidoActivo(partido);
    
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('unirse_partido', partido.id);

    socketRef.current.on('partido_suspendido', (data) => {
      setCronometroActivo(false);
      alert(`⚠️ El Árbitro ha SUSPENDIDO el partido. Motivo: ${data.motivo}`);
      setPartidoActivo(null);
      cargarPartidosAsignados();
    });

    socketRef.current.on('bola_jugada_notificacion', (data) => {
      agregarLog(`Jugador #${data.numero_dorsal} ${data.nombre_jugador} ejecutó un ${data.tipo_destreza.toUpperCase()} (${data.efectividad ? 'Válido 🎯' : 'Nulo 🚫'})`);
    });

    socketRef.current.on('tarjeta_notificacion', (data) => {
      agregarLog(`⚠️ Tarjeta ${data.color.toUpperCase()} aplicada a ${data.nombre_jugador}`);
    });
  };

  const agregarLog = (mensaje) => {
    setLogIncidencias(prev => [`[${new Date().toLocaleTimeString()}] ${mensaje}`, ...prev]);
  };

  const registrarTantos = (equipoId, esLocal, puntos) => {
    const nuevosPuntosLocal = esLocal ? marcadorLocal + puntos : marcadorLocal;
    const nuevosPuntosVisita = !esLocal ? marcadorVisita + puntos : marcadorVisita;
    
    setMarcadorLocal(nuevosPuntosLocal);
    setMarcadorVisita(nuevosPuntosVisita);
    setManoActual(m => m + 1);
    agregarLog(`Fin de Mano: ${puntos} tantos asignados al equipo ${esLocal ? 'Local' : 'Visitante'}.`);

    socketRef.current.emit('tantos_asignados', {
      partido_id: partidoActivo.id, mano_id: manoActual, equipo_ganador_id: equipoId,
      tantos_anotados: puntos, nuevo_marcador_local: nuevosPuntosLocal, nuevo_marcador_visita: nuevosPuntosVisita
    });
  };

  const finalizarPartido = async () => {
    if (!window.confirm('¿Estás seguro de finalizar y cerrar el acta oficial?')) return;
    socketRef.current.emit('partido_finalizado', {
      partido_id: partidoActivo.id, marcador_local: marcadorLocal, marcador_visita: marcadorVisita
    });
    alert('Partido finalizado.');
    setPartidoActivo(null);
    cargarPartidosAsignados();
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
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
        <h2>📝 Panel de Anotador Oficial</h2>
        <button onClick={cerrarSesion}>Cerrar Sesión</button>
      </div>

      {!partidoActivo ? (
        <div>
          <h3>Mis Partidos Asignados</h3>
          {partidos.map(p => (
            <button key={p.id} onClick={() => seleccionarPartido(p)} style={{ padding: '15px', width: '100%', textAlign: 'left', background: '#F0FFF4', border: '1px solid #38A169', marginBottom: '10px', cursor: 'pointer', borderRadius: '4px' }}>
              <strong>{p.local_nombre} vs {p.visita_nombre}</strong> <br/>
              Torneo: {p.torneo_nombre} | Sede: {p.sede_nombre}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <div style={{ background: '#FFF', border: '1px solid #CBD5E0', padding: '20px', borderRadius: '6px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h1 style={{ fontSize: '3em', margin: '10px 0' }}>{formatoTiempo(tiempoJuego)}</h1>
              <button onClick={() => setCronometroActivo(!cronometroActivo)} style={{ background: cronometroActivo ? '#E53E3E' : '#38A169', color: '#FFF', padding: '8px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {cronometroActivo ? '⏸ Pausar Cronómetro' : '▶️ Iniciar Cronómetro'}
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#2D3748', color: '#FFF', padding: '20px', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <h3>(L) {partidoActivo.local_nombre}</h3>
                <span style={{ fontSize: '4em', fontWeight: 'bold' }}>{marcadorLocal}</span>
              </div>
              <div style={{ fontSize: '2em', fontWeight: 'bold' }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <h3>(V) {partidoActivo.visita_nombre}</h3>
                <span style={{ fontSize: '4em', fontWeight: 'bold' }}>{marcadorVisita}</span>
              </div>
            </div>

            <h4 style={{ marginTop: '20px' }}>Registrar Cierre de Mano (Tiro #{manoActual})</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select id="puntosSelect" style={{ padding: '10px', flex: 1 }}>
                {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} Tantos</option>)}
              </select>
              <button onClick={() => registrarTantos(partidoActivo.equipo_local_id, true, parseInt(document.getElementById('puntosSelect').value))} style={{ background: '#3182CE', color: '#FFF', border: 'none', cursor: 'pointer', padding: '8px' }}>Sumar Local</button>
              <button onClick={() => registrarTantos(partidoActivo.equipo_visita_id, false, parseInt(document.getElementById('puntosSelect').value))} style={{ background: '#D69E2E', color: '#FFF', border: 'none', cursor: 'pointer', padding: '8px' }}>Sumar Visita</button>
            </div>

            <button onClick={finalizarPartido} style={{ width: '100%', padding: '15px', background: '#E53E3E', color: '#FFF', marginTop: '20px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>🏁 Finalizar Partido y Cerrar Acta</button>

            {/* BOTÓN PARA ABRIR PANTALLA DE PUNTAJES EN VIVO */}
            <button 
              onClick={() => window.open(`/?vista=puntajes&partido_id=${partidoActivo.id}`, '_blank')} 
              style={{ width: '100%', padding: '12px', background: '#3182CE', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}
            >
              📺 Proyectar Pantalla de Puntajes (Nueva Pest.)
            </button>
          </div>

          <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '15px', borderRadius: '6px', maxHeight: '600px', overflowY: 'auto' }}>
            <h4>📡 Bitácora en Vivo (Árbitro)</h4>
            <div style={{ fontSize: '0.85em', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logIncidencias.length === 0 ? <p style={{ fontStyle: 'italic' }}>Esperando jugadas...</p> : logIncidencias.map((log, idx) => <div key={idx} style={{ background: '#FFF', padding: '8px', borderLeft: '3px solid #3182CE', borderRadius: '3px' }}>{log}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}