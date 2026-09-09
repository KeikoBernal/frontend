import { useState, useEffect } from 'react';
import PlanillaPublica from './PlanillaPublica';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function PantallaPuntajes() {
  const [partidosEnVivo, setPartidosEnVivo] = useState([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const partidoIdUrl = params.get('partido_id');

    if (partidoIdUrl) {
      // 1. Si se abrió directamente desde el panel con un ID específico
      fetch(`${API_URL}/partidos/${partidoIdUrl}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setPartidoSeleccionado(data);
          }
          setCargando(false);
        })
        .catch(err => {
          console.error('Error cargando el partido específico:', err);
          setCargando(false);
        });
    } else {
      // 2. Si se abrió de forma general, cargamos la lista de partidos
      fetch(`${API_URL}/partidos-activos`)
        .then(res => res.json())
        .then(data => {
          setPartidosEnVivo(Array.isArray(data) ? data : []);
          setCargando(false);
        })
        .catch(err => {
          console.error('Error cargando partidos:', err);
          setCargando(false);
        });
    }
  }, []);

  if (cargando) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#FFF', background: '#1A202C', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h3>🔄 Sintonizando planilla del partido en vivo...</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: '#1A202C', color: '#FFF', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>📺 Pantalla Oficial de Resultados en Vivo</h2>

      {!partidoSeleccionado ? (
        <div>
          <h3>Selecciona un partido para ver su planilla en vivo:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {partidosEnVivo.length === 0 ? (
              <p style={{ color: '#A0AEC0' }}>No hay partidos activos en este momento.</p>
            ) : (
              partidosEnVivo.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => setPartidoSeleccionado(p)} 
                  style={{ padding: '20px', background: '#2D3748', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <strong>{p.local_nombre || 'Local'} vs {p.visita_nombre || 'Visita'}</strong>
                  <br/><small style={{ color: '#CBD5E0' }}>Torneo: {p.torneo_nombre}</small>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div>
          <button 
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              if (params.get('partido_id')) {
                window.location.href = '/?vista=puntajes'; // Limpia la URL si desea ver el listado general
              } else {
                setPartidoSeleccionado(null);
              }
            }} 
            style={{ marginBottom: '15px', padding: '8px 15px', background: '#4A5568', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ⬅️ Volver al listado de partidos
          </button>

          {/* Renderiza la planilla oficial matricial en tiempo real */}
          <PlanillaPublica 
            partidoId={partidoSeleccionado.id} 
            equipoLocalNombre={partidoSeleccionado.local_nombre}
            equipoVisitaNombre={partidoSeleccionado.visita_nombre}
          />
        </div>
      )}
    </div>
  );
}