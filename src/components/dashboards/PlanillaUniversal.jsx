import React from 'react';

export default function PlanillaUniversal({
  rol = 'espectador', // 'anotador' | 'arbitro' | 'espectador'
  estadoPartido = 'Agendado',
  partidoId = null,
  datosPartido = {},
  jugadoresLocal = [],
  jugadoresVisita = [],
  efectividadJugadores = {},
  estadisticasLanzamientos = {},
  puntosPorManoLocal = Array(20).fill(''),
  puntosPorManoVisita = Array(20).fill(''),
  alHacerClicCelda = () => {},
  alIniciarCronometro = () => {}
}) {
  const manoIndices = Array.from({ length: 20 }, (_, i) => i + 1);

  const tdStyle = { border: '1px solid #000', padding: '4px', textAlign: 'center', height: '28px' };
  const thStyle = { ...tdStyle, background: '#f0f0f0', fontWeight: 'bold' };

  const procesarClic = (jugadorId, manoIndex) => {
    const jugada = efectividadJugadores[jugadorId]?.[manoIndex];

    if (rol === 'anotador') {
      if (!jugada || jugada.estado === 'rechazado') {
        alHacerClicCelda(jugadorId, manoIndex, null);
      }
    } else if (rol === 'arbitro') {
      if (jugada && jugada.estado === 'pendiente') {
        alHacerClicCelda(jugadorId, manoIndex, jugada);
      }
    }
  };

  const RenderTablaEquipo = ({ titulo, capitan, jugadores, puntos }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9em', fontWeight: 'bold' }}>
        <span>Equipo: <span style={{ textDecoration: 'underline' }}>{titulo}</span></span>
        <span>Capitán: <span style={{ textDecoration: 'underline' }}>{capitan || 'Por definir'}</span></span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', fontSize: '0.8em' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '35px' }}>Foto</th>
            <th style={{ ...thStyle, width: '30px' }}>N°</th>
            <th style={{ ...thStyle, width: '200px', textAlign: 'left' }}>Apellidos y Nombres</th>
            <th colSpan={20} style={thStyle}>Control efectividad lanzamientos</th>
            <th style={{ ...thStyle, width: '25px' }}>AL</th>
            <th style={{ ...thStyle, width: '25px' }}>AB</th>
            <th style={{ ...thStyle, width: '25px' }}>BL</th>
            <th style={{ ...thStyle, width: '25px' }}>BB</th>
          </tr>
        </thead>
        <tbody>
          {jugadores.length === 0 ? (
            <tr><td colSpan={27} style={{ ...tdStyle, color: '#666', fontStyle: 'italic' }}>Esperando nómina...</td></tr>
          ) : (
            jugadores.map((j) => {
              const stats = estadisticasLanzamientos[j.id] || { AL: '', AB: '', BL: '', BB: '' };

              return (
                <tr key={j.id}>
                  {/* FOTO DEL JUGADOR */}
                  <td style={{ ...tdStyle, padding: '2px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#CBD5E0', margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {j.foto_url ? (
                        <img src={j.foto_url} alt={j.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '0.6em', color: '#4A5568' }}>📷</span>
                      )}
                    </div>
                  </td>

                  <td style={tdStyle}><strong>{j.numero_dorsal}</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '8px', textTransform: 'uppercase' }}>
                    {j.apellido} {j.nombre}
                  </td>

                  {/* 20 MANOS */}
                  {manoIndices.map((m) => {
                    const manoIndex = m - 1;
                    const jugada = efectividadJugadores[j.id]?.[manoIndex];

                    let bgCelda = '#FFF';
                    if (jugada?.estado === 'pendiente') bgCelda = '#FEFCBF';
                    if (jugada?.estado === 'validado') bgCelda = '#C6F6D5';
                    if (jugada?.estado === 'rechazado') bgCelda = '#FED7D7';

                    const esClickeable =
                      (rol === 'anotador' && (!jugada || jugada.estado === 'rechazado')) ||
                      (rol === 'arbitro' && jugada?.estado === 'pendiente');

                    return (
                      <td
                        key={m}
                        onClick={() => esClickeable && procesarClic(j.id, manoIndex)}
                        style={{
                          ...tdStyle,
                          background: bgCelda,
                          color: '#2B6CB0',
                          fontWeight: 'bold',
                          minWidth: '22px',
                          cursor: esClickeable ? 'pointer' : 'default',
                          userSelect: 'none'
                        }}
                      >
                        {jugada?.valor || ''}
                      </td>
                    );
                  })}

                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{stats.AL}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{stats.AB}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{stats.BL}</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{stats.BB}</td>
                </tr>
              );
            })
          )}

          <tr style={{ background: '#f8f8f8' }}>
            <td colSpan={3} style={{ ...tdStyle, textAlign: 'right', fontSize: '0.85em' }}>Mano N°</td>
            {manoIndices.map((n) => (
              <td key={`h-${n}`} style={{ ...tdStyle, fontSize: '0.75em', background: '#e2e8f0' }}>{n}</td>
            ))}
            <td colSpan={4} style={{ border: '1px solid #000' }}></td>
          </tr>

          <tr>
            <td colSpan={3} style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', paddingRight: '10px' }}>
              Puntuación final
            </td>
            {puntos.map((pts, i) => (
              <td key={`pts-${i}`} style={{ ...tdStyle, fontWeight: 'bold', fontSize: '1.1em', background: '#FFFDF0' }}>
                {pts !== 0 && pts !== '' ? pts : ''}
              </td>
            ))}
            <td colSpan={4} style={{ border: '1px solid #000', background: '#f0f0f0' }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', background: '#FFF', color: '#000', minWidth: '950px' }}>
      
      {/* BARRA SUPERIOR DE CONTROL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#EDF2F7', padding: '10px 15px', borderRadius: '6px' }}>
        <div>
          <strong style={{ textTransform: 'uppercase' }}>Estado: </strong>
          <span style={{ padding: '4px 8px', borderRadius: '4px', background: estadoPartido === 'En Curso' ? '#C6F6D5' : '#FEFCBF', fontWeight: 'bold' }}>
            {estadoPartido}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {(rol === 'anotador' || rol === 'arbitro') && (estadoPartido === 'Agendado' || estadoPartido === 'Programado') && (
            <button
              onClick={alIniciarCronometro}
              style={{ background: '#38A169', color: 'white', padding: '8px 16px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              ▶️ Iniciar Partido
            </button>
          )}

          {/* BOTÓN PROYECTAR PANTALLA PÚBLICA */}
          {partidoId && (
            <button
              onClick={() => window.open(`/?vista=puntajes&partido_id=${partidoId}`, '_blank')}
              style={{ background: '#3182CE', color: 'white', padding: '8px 14px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📺 Proyectar Pantalla de Puntajes
            </button>
          )}
        </div>
      </div>

      {/* ENCABEZADO INSTITUCIONAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ border: '2px solid #000', borderRadius: '50%', width: '65px', height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8em', textAlign: 'center' }}>
          Logo<br/>CVC
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h2 style={{ margin: 0, textTransform: 'uppercase' }}>Bolas Criollas</h2>
          <h3 style={{ margin: '3px 0 0 0', fontWeight: 'normal' }}>Planilla Oficial de Anotación</h3>
        </div>
        <div style={{ width: '65px' }}></div>
      </div>

      {/* INFORMACIÓN GENERAL COMPLETA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '15px', fontSize: '0.85em' }}>
        <div>
          <div><strong>Árbitro:</strong> <span style={{ textDecoration: 'underline' }}>{datosPartido.arbitro || 'Por definir'}</span></div>
          <div style={{ marginTop: '4px' }}><strong>Anotador:</strong> <span style={{ textDecoration: 'underline' }}>{datosPartido.anotador || 'Por definir'}</span></div>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
          <div><strong>Hora de inicio:</strong> <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{datosPartido.horaInicio || '____:____'}</span></div>
          <div><strong>Hora final:</strong> <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{datosPartido.horaFinal || '____:____'}</span></div>
          <div><strong>Fecha:</strong> <span style={{ textDecoration: 'underline' }}>{datosPartido.fecha || new Date().toLocaleDateString('es-VE')}</span></div>
        </div>
      </div>

      <RenderTablaEquipo
        titulo={datosPartido.localNombre || 'Equipo A'}
        capitan={datosPartido.capitanLocal}
        jugadores={jugadoresLocal}
        puntos={puntosPorManoLocal}
      />

      <RenderTablaEquipo
        titulo={datosPartido.visitaNombre || 'Equipo B'}
        capitan={datosPartido.capitanVisita}
        jugadores={jugadoresVisita}
        puntos={puntosPorManoVisita}
      />
    </div>
  );
}