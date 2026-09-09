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

  // Estructura digital de la planilla para entrada de datos (20 manos)
  const [manoSeleccionada, setManoSeleccionada] = useState(1); // Mano activa a registrar (1 al 20)
  const [puntosLocalManos, setPuntosLocalManos] = useState(Array(20).fill(0));
  const [puntosVisitaManos, setPuntosVisitaManos] = useState(Array(20).fill(0));
  
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

  // Registrar puntos en la planilla digital interactiva para una mano específica
  const registrarPuntosMano = (esLocal, puntos) => {
    const indexMano = manoSeleccionada - 1;

    let nuevoLocalArray = [...puntosLocalManos];
    let nuevoVisitaArray = [...puntosVisitaManos];

    if (esLocal) {
      nuevoLocalArray[indexMano] = puntos;
      nuevoVisitaArray[indexMano] = 0; // En una mano solo anota un equipo
    } else {
      nuevoVisitaArray[indexMano] = puntos;
      nuevoLocalArray[indexMano] = 0;
    }

    setPuntosLocalManos(nuevoLocalArray);
    setPuntosVisitaManos(nuevoVisitaArray);

    const totalLocal = nuevoLocalArray.reduce((a, b) => a + b, 0);
    const totalVisita = nuevoVisitaArray.reduce((a, b) => a + b, 0);

    agregarLog(`Mano #${manoActual}: ${puntos} tantos para el equipo ${esLocal ? 'Local' : 'Visitante'}.`);

    // Emitir por WebSocket para actualizar la planilla pública y visualización en tiempo real
    socketRef.current.emit('tantos_asignados', {
      partido_id: partidoActivo.id,
      mano_id: manoActual,
      tantos_anotados: puntos,
      tantosLocal: nuevoLocalArray,
      tantosVisita: nuevoVisitaArray,
      nuevo_marcador_local: totalLocal,
      nuevo_marcador_visita: totalVisita
    });

    // Avanzar automáticamente a la siguiente mano si es menor a 20
    if (manoActual < 20) {
      setManoActual(m => m + 1);
      setManoSeleccionada(m => m + 1);
    }
  };

  const totalPuntosLocal = puntosLocalManos.reduce((a, b) => a + b, 0);
  const totalPuntosVisita = puntosVisitaManos.reduce((a, b) => a + b, 0);

  const finalizarPartido = async () => {
    if (!window.confirm('¿Estás seguro de finalizar y cerrar el acta oficial?')) return;
    socketRef.current.emit('partido_finalizado', {
      partido_id: partidoActivo.id, marcador_local: totalPuntosLocal, marcador_visita: totalPuntosVisita
    });
    alert('Partido finalizado.');
    setPartidoActivo(null);
    cargarPartidosAsignados();
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '15px', fontFamily: 'sans-serif' }}>
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
        <h2>📝 Panel de Anotador Oficial (Planilla Digital Interactiva)</h2>
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
            
            {/* CRONÓMETRO Y ESTADO */}
            <div style={{ textAlign: 'center', marginBottom: '15px', background: '#F7FAFC', padding: '10px', borderRadius: '6px' }}>
              <h2 style={{ margin: '5px 0' }}>{formatoTiempo(tiempoJuego)}</h2>
              <button onClick={() => setCronometroActivo(!cronometroActivo)} style={{ background: cronometroActivo ? '#E53E3E' : '#38A169', color: '#FFF', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {cronometroActivo ? '⏸ Pausar Cronómetro' : '▶️ Iniciar Cronómetro'}
              </button>
            </div>
            
            {/* MARCADOR GENERAL ACUMULADO */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#2D3748', color: '#FFF', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: 0 }}>{partidoActivo.local_nombre}</h4>
                <span style={{ fontSize: '3em', fontWeight: 'bold' }}>{totalPuntosLocal}</span>
              </div>
              <div style={{ fontSize: '1.8em', fontWeight: 'bold' }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: 0 }}>{partidoActivo.visita_nombre}</h4>
                <span style={{ fontSize: '3em', fontWeight: 'bold' }}>{totalPuntosVisita}</span>
              </div>
            </div>

            {/* PLANILLA DIGITAL INTERACTIVA (MATRIZ DE ENTRADA 20 MANOS) */}
            <div style={{ marginBottom: '20px', background: '#FDFCF0', border: '2px solid #000', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
              <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#000' }}>📋 Planilla de Puntuación por Manos (1 al 20)</h4>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.8em' }}>
                <thead>
                  <tr style={{ background: '#E2E8F0', color: '#000' }}>
                    <th style={{ border: '1px solid #000', padding: '4px', width: '120px' }}>Equipo / Mano</th>
                    {Array.from({ length: 20 }).map((_, i) => (
                      <th key={i} style={{ border: '1px solid #000', padding: '2px', width: '25px', textAlign: 'center' }}>
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Fila Puntos Local */}
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', color: '#C53030' }}>
                      {partidoActivo.local_nombre}
                    </td>
                    {puntosLocalManos.map((pts, i) => (
                      <td key={i} onClick={() => { setManoSeleccionada(i + 1); setManoActual(i + 1); }} style={{ border: '1px solid #000', textAlign: 'center', background: manoSeleccionada === i + 1 ? '#FEFCBF' : '#FFF', color: '#C53030', fontWeight: 'bold', cursor: 'pointer' }}>
                        {pts > 0 ? pts : ''}
                      </td>
                    ))}
                  </tr>
                  {/* Fila Puntos Visita */}
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', color: '#DD6B20' }}>
                      {partidoActivo.visita_nombre}
                    </td>
                    {puntosVisitaManos.map((pts, i) => (
                      <td key={i} onClick={() => { setManoSeleccionada(i + 1); setManoActual(i + 1); }} style={{ border: '1px solid #000', textAlign: 'center', background: manoSeleccionada === i + 1 ? '#FEFCBF' : '#FFF', color: '#DD6B20', fontWeight: 'bold', cursor: 'pointer' }}>
                        {pts > 0 ? pts : ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE ASIGNACIÓN PARA LA MANO SELECCIONADA */}
            <div style={{ background: '#EDF2F7', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>✍️ Registrar Tantos en <strong>Mano #{manoSeleccionada}</strong></h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Puntos para Local:</label>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5, 6].map(pts => (
                      <button key={pts} onClick={() => registrarPuntosMano(true, pts)} style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        +{pts}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85em', fontWeight: 'bold' }}>Puntos para Visitante:</label>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 4, 5, 6].map(pts => (
                      <button key={pts} onClick={() => registrarPuntosMano(false, pts)} style={{ background: '#D69E2E', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        +{pts}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={finalizarPartido} style={{ width: '100%', padding: '12px', background: '#E53E3E', color: '#FFF', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>
              🏁 Finalizar Partido y Cerrar Acta Oficial
            </button>

            {/* BOTÓN PARA ABRIR PANTALLA DE PUNTAJES EN VIVO */}
            <button 
              onClick={() => window.open(`/?vista=puntajes&partido_id=${partidoActivo.id}`, '_blank')} 
              style={{ width: '100%', padding: '12px', background: '#3182CE', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}
            >
              📺 Proyectar Pantalla de Resultados en Vivo (Nueva Pest.)
            </button>
          </div>

          <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '15px', borderRadius: '6px', maxHeight: '650px', overflowY: 'auto' }}>
            <h4>📡 Bitácora en Vivo (Árbitro & Anotador)</h4>
            <div style={{ fontSize: '0.85em', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logIncidencias.length === 0 ? <p style={{ fontStyle: 'italic' }}>Esperando jugadas...</p> : logIncidencias.map((log, idx) => <div key={idx} style={{ background: '#FFF', padding: '8px', borderLeft: '3px solid #3182CE', borderRadius: '3px' }}>{log}</div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}