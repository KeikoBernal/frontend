export default function ArbitroDashboard({ usuario, cerrarSesion }) {
  return (
    <div style={{ border: '1px solid #D69E2E', padding: '20px', borderRadius: '8px' }}>
      <h2>📋 Panel de Árbitro / Anotador</h2>
      <p>Sesión activa: <strong>{usuario?.email}</strong></p>
      <hr />
      <h3>Planilla Digital de Partido</h3>
      <ul>
        <li>Seleccionar Partido Asignado</li>
        <li>Registrar puntos, boches y arrastres en tiempo real</li>
        <li>Cierre y firma digital de acta del partido</li>
      </ul>
      <button onClick={cerrarSesion}>Cerrar Sesión</button>
    </div>
  );
}