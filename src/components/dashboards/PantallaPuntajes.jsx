import { useState, useEffect } from 'react';
import PlanillaPublica from './PlanillaPublica';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function PantallaPuntajes() {
  const [partidosEnVivo, setPartidosEnVivo] = useState([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState(null);

  const seleccionarPartidoPantalla = (p) => {
    setPartidoSeleccionado(p);
  };

  useEffect(() => {
    fetch(`${API_URL}/partidos-activos`)
      .then(res => res.json())
      .then(data => {
        const lista = Array.isArray(data) ? data : [];
        setPartidosEnVivo(lista);

        // Auto-seleccionar partido si viene por URL (ej: /pantalla-puntajes?partido_id=5)
        const params = new URLSearchParams(window.location.search);
        const partidoIdUrl = params.get('partido_id');
        if (partidoIdUrl && lista.length > 0) {
          const partidoEncontrado = lista.find(p => p.id.toString() === partidoIdUrl);
          if (partidoEncontrado) {
            seleccionarPartidoPantalla(partidoEncontrado);
          }
        }
      })
      .catch(err => console.error('Error cargando partidos:', err));
  }, []);

  return (
    <div style={{ padding: '20px', background: '#1A202C', color: '#FFF', minHeight: '100vh' }}>
      <h2 style={{ textAlign: 'center' }}>📺 Pantalla Oficial de Resultados</h2>

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
                  onClick={() => seleccionarPartidoPantalla(p)} 
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
            onClick={() => setPartidoSeleccionado(null)} 
            style={{ marginBottom: '15px', padding: '8px 15px', background: '#4A5568', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ⬅️ Volver al listado
          </button>

          {/* Componente de la planilla oficial matricial */}
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