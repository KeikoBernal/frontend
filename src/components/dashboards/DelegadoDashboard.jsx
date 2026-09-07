export default function DelegadoDashboard({ usuario, cerrarSesion }) {
  return (
    <div style={{ border: '1px solid #2F855A', padding: '20px', borderRadius: '8px' }}>
      <h2>⚽ Panel de Delegado de Equipo</h2>
      <p>Sesión activa: <strong>{usuario?.email}</strong></p>
      <hr />
      <h3>Gestión de Equipo</h3>
      <ul>
        <li>Inscribir Jugadores</li>
        <li>Consultar Estadísticas e Historial</li>
        <li>Ver Calendario de Partidos de la Temporada</li>
      </ul>
      <button onClick={cerrarSesion}>Cerrar Sesión</button>
    </div>
  );
}