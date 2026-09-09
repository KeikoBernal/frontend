import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// Importación de los componentes individuales por rol
import SuperadminDashboard from './components/dashboards/SuperadminDashboard';
import AdminLigaDashboard from './components/dashboards/AdminLigaDashboard';
import ArbitroDashboard from './components/dashboards/ArbitroDashboard';
import DelegadoDashboard from './components/dashboards/DelegadoDashboard';
import AnotadorDashboard from './components/dashboards/AnotadorDashboard';
import PantallaPuntajes from './components/dashboards/PantallaPuntajes'; // 👈 Importación de PantallaPuntajes

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function App() {
  // 👇 Verificación temprana de la URL para mostrar la Pantalla de Puntajes en una pestaña limpia
  const params = new URLSearchParams(window.location.search);
  if (params.get('vista') === 'puntajes') {
    return <PantallaPuntajes />;
  }

  const [vista, setVista] = useState('inicio'); // 'inicio', 'login', 'dashboard'
  const [paso, setPaso] = useState(1);         // 1: Credenciales, 2: OTP (Superadmin)
  const [partidos, setPartidos] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [rolUsuario, setRolUsuario] = useState('');
  const [cargando, setCargando] = useState(true);

  const enProcesoLoginRef = useRef(false);

  // 1. Cargar partidos activos para la Landing Page pública
  useEffect(() => {
    if (vista === 'inicio') {
      fetch(`${API_URL}/partidos-activos`)
        .then((res) => res.json())
        .then((data) => setPartidos(Array.isArray(data) ? data : []))
        .catch((err) => console.error('Error cargando partidos desde Express:', err));
    }
  }, [vista]);

  // 2. Consulta de rol en PostgreSQL (public.usuarios)
  const obtenerRolBD = async (userId) => {
    try {
      const { data: datosBD, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error leyendo rol en BD:', error);
        return 'Usuario';
      }
      return datosBD?.rol || 'Usuario';
    } catch (err) {
      console.error('Excepción leyendo rol:', err);
      return 'Usuario';
    }
  };

  // 3. Persistencia de Sesión
  useEffect(() => {
    const verificarSesionExistente = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user && !enProcesoLoginRef.current) {
        const rolBD = await obtenerRolBD(session.user.id);
        setRolUsuario(rolBD);
        setUsuario(session.user);
        setVista('dashboard');
      }
      setCargando(false);
    };

    verificarSesionExistente();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (enProcesoLoginRef.current) return;

        if (event === 'SIGNED_IN' && session?.user) {
          const rolBD = await obtenerRolBD(session.user.id);
          setRolUsuario(rolBD);
          setUsuario(session.user);
          setVista('dashboard');
        } else if (event === 'SIGNED_OUT') {
          setUsuario(null);
          setRolUsuario('');
          setVista('inicio');
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 4. Manejo de Login condicional
  const manejarLogin = async (e) => {
    e.preventDefault();
    setMensaje('');

    const emailLimpio = email.trim().toLowerCase();

    // PASO 1: Validar credenciales
    if (paso === 1) {
      setMensaje('Validando credenciales...');
      enProcesoLoginRef.current = true;

      const { data, error: errorPassword } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password,
      });

      if (errorPassword) {
        enProcesoLoginRef.current = false;
        setMensaje(`Credenciales incorrectas: ${errorPassword.message}`);
        return;
      }

      setMensaje('Consultando rol en la base de datos...');
      const rolBD = await obtenerRolBD(data.user.id);
      setRolUsuario(rolBD);

      if (rolBD.toLowerCase() === 'superadmin') {
        await supabase.auth.signOut();

        setMensaje('Superadmin detectado. Enviando código a tu correo...');
        const { error: errorOtp } = await supabase.auth.signInWithOtp({
          email: emailLimpio,
          options: { shouldCreateUser: false },
        });

        if (errorOtp) {
          enProcesoLoginRef.current = false;
          setMensaje(`Error al enviar el código: ${errorOtp.message}`);
        } else {
          setMensaje('Código de 6 dígitos enviado a tu correo.');
          setPaso(2);
        }
      } else {
        enProcesoLoginRef.current = false;
        setUsuario(data.user);
        setVista('dashboard');
        setMensaje('¡Bienvenido/a! Sesión iniciada.');
      }
      return;
    }

    // PASO 2: OTP exclusivo para Superadmin
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
        enProcesoLoginRef.current = false;
        const rolBD = await obtenerRolBD(data.user.id);

        setRolUsuario(rolBD);
        setUsuario(data.user);
        setVista('dashboard');
        setMensaje('¡Autenticación completada!');
      }
    }
  };

  // Petición auxiliar para enviar el evento de Login a public.audit_logs
  const registrarLoginAudit = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch(`${API_URL}/superadmin/log-evento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ accion: 'LOGIN_EXITOSO', tabla: 'auth' })
      }).catch(() => {});
    }
  };

  const cerrarSesion = async () => {
    enProcesoLoginRef.current = false;
    await supabase.auth.signOut();
    setUsuario(null);
    setRolUsuario('');
    setPaso(1);
    setCodigoOtp('');
    setPassword('');
    setVista('inicio');
    setMensaje('');
  };

  // Selector dinámico del componente Dashboard
  const renderizarDashboard = () => {
    const rol = rolUsuario?.toLowerCase();

    switch (rol) {
      case 'superadmin':
        return <SuperadminDashboard usuario={usuario} cerrarSesion={cerrarSesion} />;
      case 'administrador de liga':
        return <AdminLigaDashboard usuario={usuario} cerrarSesion={cerrarSesion} />;
      case 'arbitro':
      case 'árbitro':
      case 'arbitro/anotador':
      case 'árbitro / anotador':
        return <ArbitroDashboard usuario={usuario} cerrarSesion={cerrarSesion} />;
      case 'anotador':
        return <AnotadorDashboard usuario={usuario} cerrarSesion={cerrarSesion} />;
      case 'delegado de equipo':
        return <DelegadoDashboard usuario={usuario} cerrarSesion={cerrarSesion} />;
      default:
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <h3>Bienvenido/a al Panel General</h3>
            <p>Usuario: {usuario?.email}</p>
            <p>Rol: {rolUsuario || 'Sin rol asignado'}</p>
            <button onClick={cerrarSesion}>Cerrar Sesión</button>
          </div>
        );
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h3>🥎 Cargando sistema de Bolas Criollas...</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      {/* Barra de navegación pública */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
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

      {/* Landing Page (Pública) */}
      {vista === 'inicio' && (
        <div>
          <h3>Partidos en Vivo y Resultados</h3>
          {partidos.length === 0 ? (
            <p>No hay partidos en curso en este momento.</p>
          ) : (
            <ul>
              {partidos.map((p) => (
                <li key={p.id}>Partido #{p.id} - Sede: {p.sede_id}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Formulario de Inicio de Sesión */}
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
                  Ingresa el código enviado a <strong>{email}</strong>
                </p>
                <input
                  type="text"
                  placeholder="Código de 6 dígitos"
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value)}
                  maxLength={6}
                  required
                />
                <button type="submit">Validar e Iniciar Sesión</button>
                <button 
                  type="button" 
                  onClick={() => {
                    enProcesoLoginRef.current = false;
                    setPaso(1);
                    setMensaje('');
                  }} 
                  style={{ background: '#eee', color: '#333' }}
                >
                  Volver
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

      {/* Vista de Dashboard Específica según Rol */}
      {vista === 'dashboard' && renderizarDashboard()}
    </div>
  );
}

export default App;