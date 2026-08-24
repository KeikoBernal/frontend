import { useState, useEffect } from 'react';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [token, setToken] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const tokenGuardado = localStorage.getItem('token');
    if (tokenGuardado) setToken(tokenGuardado);
  }, []);

  // AQUÍ ESTÁ EL 'async' NECESARIO:
  const procesarFormulario = async (endpoint) => {
    setMensaje('Enviando...');
    try {
      const res = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error en la solicitud');

      setMensaje(data.mensaje);
      if (endpoint === 'login' && data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
    } catch (err) {
      setMensaje(err.message);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    setToken(null);
    setEmail('');
    setPassword('');
    setMensaje('Sesión cerrada');
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Inicio de Sesión (PERN)</h2>
      {mensaje && <p style={{ color: 'blue', fontWeight: 'bold' }}>{mensaje}</p>}

      {!token ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ padding: '8px' }}
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ padding: '8px' }}
          />
          <button onClick={() => procesarFormulario('registro')} style={{ padding: '8px', cursor: 'pointer' }}>
            Registrarse
          </button>
          <button onClick={() => procesarFormulario('login')} style={{ padding: '8px', cursor: 'pointer', backgroundColor: '#0056b3', color: 'white', border: 'none' }}>
            Iniciar Sesión
          </button>
        </div>
      ) : (
        <div>
          <h3>¡Bienvenido! Sesión Activa.</h3>
          <p style={{ wordBreak: 'break-all', fontSize: '11px', color: '#555' }}><strong>Token JWT:</strong> {token}</p>
          <button onClick={cerrarSesion} style={{ padding: '8px', backgroundColor: '#d9534f', color: 'white', border: 'none', cursor: 'pointer' }}>
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default App;