import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function App() {
  const [vista, setVista] = useState('inicio');
  const [paso, setPaso] = useState(1);
  const [partidos, setPartidos] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('');

  useEffect(() => {
    if (vista === 'inicio') {
      fetch(`${API_URL}/partidos-activos`)
        .then((res) => res.json())
        .then((data) => setPartidos(Array.isArray(data) ? data : []))
        .catch((err) => console.error('Error cargando partidos desde Express:', err));
    }
  }, [vista]);

  const manejarLogin = async (e) => {
    e.preventDefault();
    setMensaje('');

    const emailLimpio = email.trim().toLowerCase();

    // PASO 1: Validar credenciales y consultar la tabla public.usuarios en PostgreSQL
    if (paso === 1) {
      setMensaje('Validando credenciales...');

      const { data, error: errorPassword } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password,
      });

      if (errorPassword) {
        setMensaje(`Credenciales incorrectas: ${errorPassword.message}`);
        return;
      }

      setMensaje('Consultando rol en la base de datos...');

      // Consulta directa a la tabla public.usuarios
      const { data: datosBD, error: errorBD } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', data.user.id)
        .single();

      if (errorBD) {
        setMensaje(`Error al leer rol en la base de datos: ${errorBD.message}`);
        return;
      }

      const rolBD = datosBD?.rol || 'Usuario';
      setRolUsuario(rolBD);

      // Evaluación del rol
      if (rolBD.toLowerCase() === 'superadmin') {
        await supabase.auth.signOut();

        setMensaje('Superadmin detectado. Enviando código a tu correo...');
        const { error: errorOtp } = await supabase.auth.signInWithOtp({
          email: emailLimpio,
          options: { shouldCreateUser: false },
        });

        if (errorOtp) {
          setMensaje(`Error al enviar el código: ${errorOtp.message}`);
        } else {
          setMensaje('Código de 6 dígitos enviado a tu correo.');
          setPaso(2);
        }
      } else {
        // Roles regulares ingresan directamente
        setUsuario(data.user);
        setVista('dashboard');
        setMensaje('¡Bienvenido/a! Sesión iniciada.');
      }
      return;
    }

    // PASO 2: Verificación OTP exclusiva para Superadmin
    if (paso === 2) {
      setMensaje('Verificando código...');

      const { data, error } = await supabase.auth.verifyOtp({
        email: emailLimpio,
        token: codigoOtp.trim(),
        type: 'email',
      });

      if (error) {
        setMensaje(`Código inválido o expirado: ${error.message}`);
      } else {
        const { data: datosBD } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', data.user.id)
          .single();

        setRolUsuario(datosBD?.rol || 'Superadmin');
        setUsuario(data.user);
        setVista('dashboard');
        setMensaje('¡Autenticación de Superadmin completada!');
      }
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setRolUsuario('');
    setPaso(1);
    setCodigoOtp('');
    setPassword('');
    setVista('inicio');
    setMensaje('');
  };

  const obtenerEtiquetaRol = (rol) => {
    switch (rol?.toLowerCase()) {
      case 'superadmin':
        return '🛡️ Superadministrador Global';
      case 'administrador de liga':
        return '🏆 Administrador de Liga';
      case 'arbitro/anotador':
      case 'árbitro / anotador':
        return '📋 Árbitro / Anotador';
      case 'delegado de equipo':
        return '⚽ Delegado de Equipo';
      default:
        return `👤 ${rol || 'Usuario'}`;
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h2>🥎 Bolas Criollas</h2>
        {vista !== 'dashboard' && (
          <button onClick={() => {
            setVista(vista === 'inicio' ? 'login' : 'inicio');
            setPaso(1);
            setMensaje('');
          }}>
            {vista === 'inicio' ? 'Iniciar Sesión' : 'Volver al Inicio'}
          </button>
        )}
      </nav>

      {/* Vista de Inicio */}
      {vista === 'inicio' && (
        <div>
          <h3>Partidos Activos</h3>
          {partidos.length === 0 ? (
            <p>No hay partidos en vivo en este momento.</p>
          ) : (
            <ul>
              {partidos.map((p) => (
                <li key={p.id}>Partido #{p.id} - Sede: {p.sede_id}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Vista de Login */}
      {vista === 'login' && (
        <div style={{ maxWidth: '350px', margin: '0 auto' }}>
          <h3>
            {paso === 1 ? 'Acceso al Sistema' : 'Verificación de Seguridad (Superadmin)'}
          </h3>

          <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paso === 1 && (
              <>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit">Entrar</button>
              </>
            )}

            {paso === 2 && (
              <>
                <p style={{ fontSize: '0.85em', color: '#555', margin: 0 }}>
                  Ingresa el código de 6 dígitos enviado a <strong>{email}</strong>
                </p>
                <input
                  type="text"
                  placeholder="Código de 6 dígitos"
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value)}
                  maxLength={6}
                  required
                />
                <button type="submit">Validar Código e Iniciar Sesión</button>
                <button 
                  type="button" 
                  onClick={() => setPaso(1)} 
                  style={{ background: '#eee', color: '#333' }}
                >
                  Volver a credenciales
                </button>
              </>
            )}
          </form>

          {mensaje && (
            <p style={{ marginTop: '15px', color: mensaje.toLowerCase().includes('error') || mensaje.toLowerCase().includes('incorrectas') || mensaje.toLowerCase().includes('inválido') ? 'red' : 'green' }}>
              {mensaje}
            </p>
          )}
        </div>
      )}

      {/* Vista de Dashboard Protegida */}
      {vista === 'dashboard' && (
        <div>
          <h3>Bienvenido/a al Panel de Control</h3>
          <p>Sesión activa: <strong>{usuario?.email}</strong></p>
          <p>Rol (Base de Datos): <strong>{obtenerEtiquetaRol(rolUsuario)}</strong></p>
          <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
          <button onClick={cerrarSesion}>Cerrar Sesión</button>
        </div>
      )}
    </div>
  );
}

export default App;