import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export default function PlanillaPublica({ partidoId, equipoLocalNombre = 'Equipo Local', equipoVisitaNombre = 'Equipo Visitante' }) {
  // Matriz de jugadas: [jugadorId][manoNumero] = 'A' (Arrime bueno), 'a' (Arrime malo), 'B' (Boche bueno), 'b' (Boche malo)
  const [efectividadJugadores, setEfectividadJugadores] = useState({});
  const [jugadoresLista, setJugadoresLista] = useState([]);
  const [puntosPorManoLocal, setPuntosPorManoLocal] = useState(Array(20).fill(0));
  const [puntosPorManoVisita, setPuntosPorManoVisita] = useState(Array(20).fill(0));

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.emit('unirse_espectador', partidoId);

    // Escuchar la planilla oficial actualizada y validada en tiempo real
    socket.on('actualizar_planilla_publica', (data) => {
      if (data.jugadores) setJugadoresLista(data.jugadores);
      if (data.efectividad) setEfectividadJugadores(data.efectividad);
      if (data.tantosLocal) setPuntosPorManoLocal(data.tantosLocal);
      if (data.tantosVisita) setPuntosPorManoVisita(data.tantosVisita);
    });

    return () => socket.disconnect();
  }, [partidoId]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', background: '#FDFCF0', color: '#000', border: '2px solid #000', borderRadius: '4px', overflowX: 'auto' }}>
      
      {/* ENCABEZADO DE LA PLANILLA */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', marginBottom: '15px', paddingBottom: '5px' }}>
        <h2 style={{ margin: 0 }}>PLANILLA OFICIAL DE ANOTACIÓN - BOLAS CRIOLLAS</h2>
        <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
          <strong>Encuentro:</strong> {equipoLocalNombre} vs {equipoVisitaNombre}
        </p>
      </div>

      {/* TABLA MATRICIAL ESTILO PAPEL */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', minWidth: '900px', fontSize: '0.85em' }}>
        <thead>
          <tr style={{ background: '#E2E8F0' }}>
            <th style={{ border: '1px solid #000', padding: '4px', width: '35px' }}>N°</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '220px' }}>Apellidos y Nombres</th>
            <th style={{ border: '1px solid #000', padding: '4px' }}>Control de Efectividad de Lanzamientos (Manos 1 al 20)</th>
          </tr>
        </thead>
        <tbody>
          {jugadoresLista.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '20px', border: '1px solid #000' }}>
                Cargando estructura de la planilla o esperando datos del servidor...
              </td>
            </tr>
          ) : (
            jugadoresLista.map((j) => (
              <tr key={j.id}>
                <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{j.numero_dorsal}</td>
                <td style={{ border: '1px solid #000', paddingLeft: '6px' }}>{j.nombre} {j.apellido}</td>
                <td style={{ border: '1px solid #000', padding: 0 }}>
                  {/* Cuadrícula interna de 20 columnas (Manos) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', height: '100%', minHeight: '26px', alignItems: 'center' }}>
                    {Array.from({ length: 20 }).map((_, manoIndex) => (
                      <div key={manoIndex} style={{ borderRight: '1px solid #cbd5e0', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9em', color: '#2B6CB0' }}>
                        {efectividadJugadores[j.id]?.[manoIndex] || ''}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))
          )}

          {/* FILA DE PUNTUACIÓN FINAL LOCAL */}
          <tr style={{ background: '#FFF5F5', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '10px', color: '#C53030' }}>
              {equipoLocalNombre} - Puntos por Mano
            </td>
            <td style={{ border: '1px solid #000', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', minHeight: '26px', alignItems: 'center' }}>
                {puntosPorManoLocal.map((pts, i) => (
                  <div key={i} style={{ borderRight: '1px solid #cbd5e0', textAlign: 'center', color: '#C53030' }}>
                    {pts > 0 ? pts : ''}
                  </div>
                ))}
              </div>
            </td>
          </tr>

          {/* FILA DE PUNTUACIÓN FINAL VISITA */}
          <tr style={{ background: '#FFFAF0', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ border: '1px solid #000', textAlign: 'right', paddingRight: '10px', color: '#DD6B20' }}>
              {equipoVisitaNombre} - Puntos por Mano
            </td>
            <td style={{ border: '1px solid #000', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', minHeight: '26px', alignItems: 'center' }}>
                {puntosPorManoVisita.map((pts, i) => (
                  <div key={i} style={{ borderRight: '1px solid #cbd5e0', textAlign: 'center', color: '#DD6B20' }}>
                    {pts > 0 ? pts : ''}
                  </div>
                ))}
              </div>
            </td>
          </tr>

        </tbody>
      </table>

      {/* LEYENDA INFORMATIVA */}
      <div style={{ marginTop: '10px', fontSize: '0.8em', display: 'flex', gap: '20px', color: '#4A5568' }}>
        <span><strong>A:</strong> Arrime Válido</span>
        <span><strong>a:</strong> Arrime Nulo</span>
        <span><strong>B:</strong> Boche Válido</span>
        <span><strong>b:</strong> Boche Nulo</span>
      </div>
    </div>
  );
}