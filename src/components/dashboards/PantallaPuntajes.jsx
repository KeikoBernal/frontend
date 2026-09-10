import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import PlanillaPublica from './PlanillaPublica';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function PantallaPuntajes() {
  const [partidosEnVivo, setPartidosEnVivo] = useState([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState(null);
  
  // Estados para la nómina y planilla en vivo
  const [jugadoresLocal, setJugadoresLocal] = useState([]);
  const [jugadoresVisita, setJugadoresVisita] = useState([]);
  const [efectividadJugadores, setEfectividadJugadores] = useState({});
  const [puntosPorManoLocal, setPuntosPorManoLocal] = useState(Array(20).fill(''));
  const [puntosPorManoVisita, setPuntosPorManoVisita] = useState(Array(20).fill(''));

  const [cargando, setCargando] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const partidoIdUrl = params.get('partido_id');

    if (partidoIdUrl) {
      cargarPartidoEspecifico(partidoIdUrl);
    } else {
      fetch(`${API_URL}/partidos-activos`)
        .then(res => res.json())
        .then(data => {
          setPartidosEnVivo(Array.isArray(data) ? data : []);
          setCargando(false);
        });
    }

    return () => socketRef.current?.disconnect();
  }, []);

  const cargarPartidoEspecifico = (id) => {
    setCargando(true);
    
    // Conectar WebSocket como Espectador
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('unirse_partido', id);
    
    socketRef.current.on('actualizar_planilla', (data) => {
      if (data.efectividad) setEfectividadJugadores(data.efectividad);
      if (data.tantosLocal) setPuntosPorManoLocal(data.tantosLocal);
      if (data.tantosVisita) setPuntosPorManoVisita(data.tantosVisita);
      if (data.hora_inicio) setPartidoSeleccionado(prev => prev ? { ...prev, hora_inicio: data.hora_inicio } : null);
    });

    // 1. Cargar Metadatos del Partido (Se puede usar un endpoint público existente o la misma consulta)
    fetch(`${API_URL}/partidos/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setPartidoSeleccionado(data);
        
        // 2. Cargar Nómina Pública
        return fetch(`${API_URL}/partidos/${id}/nomina-publica`);
      })
      .then(res => res.json())
      .then(nomina => {
        if (nomina && partidoSeleccionado) {
          setJugadoresLocal(nomina.filter(j => j.equipo_id === partidoSeleccionado.equipo_local_id));
          setJugadoresVisita(nomina.filter(j => j.equipo_id === partidoSeleccionado.equipo_visita_id));
        }
        setCargando(false);
      })
      .catch(err => {
        console.error('Error cargando partido público:', err);
        setCargando(false);
      });
  };

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center', color: '#FFF', background: '#1A202C', minHeight: '100vh' }}><h3>🔄 Sintonizando en vivo...</h3></div>;

  return (
    <div style={{ padding: '20px', background: '#1A202C', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>📺 Pantalla Oficial de Resultados en Vivo</h2>

      {!partidoSeleccionado ? (
        <div>
          <h3>Partidos Activos:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {partidosEnVivo.map(p => (
              <button key={p.id} onClick={() => cargarPartidoEspecifico(p.id)} style={{ padding: '20px', background: '#2D3748', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                <strong>{p.local_nombre} vs {p.visita_nombre}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: '#FFF', color: '#000', borderRadius: '8px', overflow: 'hidden' }}>
          
          <PlanillaPublica 
            estadoPartido={partidoSeleccionado.estado}
            datosPartido={{
              localNombre: partidoSeleccionado.local_nombre, visitaNombre: partidoSeleccionado.visita_nombre,
              horaInicio: partidoSeleccionado.hora_inicio, fecha: partidoSeleccionado.fecha_hora ? new Date(partidoSeleccionado.fecha_hora).toLocaleDateString() : ''
            }}
            jugadoresLocal={jugadoresLocal}
            jugadoresVisita={jugadoresVisita}
            efectividadJugadores={efectividadJugadores}
            puntosPorManoLocal={puntosPorManoLocal}
            puntosPorManoVisita={puntosPorManoVisita}
          />
        </div>
      )}
    </div>
  );
}