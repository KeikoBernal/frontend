import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function SuperadminDashboard({ usuario, cerrarSesion }) {
  const [pestana, setPestana] = useState('metricas');
  const [mensaje, setMensaje] = useState('');

  // Datos
  const [metricas, setMetricas] = useState(null);
  const [ligas, setLigas] = useState([]);
  const [usuariosList, setUsuariosList] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [bitacora, setBitacora] = useState([]);

  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');

  // Modales y Ediciones
  const [ligaEditando, setLigaEditando] = useState(null);
  const [userEditando, setUserEditando] = useState(null);

  // Modal de Eliminación Segura
  const [itemEliminar, setItemEliminar] = useState(null); // { tipo: 'liga' | 'usuario', id: string, nombre: string }
  const [claveConfirmacion, setClaveConfirmacion] = useState('');

  // Formularios
  const [formLiga, setFormLiga] = useState({ nombre: '', responsable_nombre: '', responsable_telefono: '', responsable_email: '' });
  const [formUser, setFormUser] = useState({ nombre: '', apellido: '', cedula: '', email: '', rol: 'administrador de liga', organizacion_id: '' });
  const [formNotif, setFormNotif] = useState({
    tipo_destino: 'todos',
    organizacion_id: '',
    rol_destino: 'administrador de liga',
    titulo: '',
    mensaje: ''
  });

  // Filtros y Búsquedas
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [busquedaBitacora, setBusquedaBitacora] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroUsuarioId, setFiltroUsuarioId] = useState('');

  const fetchConToken = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return await fetch(`${API_URL}/superadmin${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        ...options.headers,
      },
    });
  };

  const cargarDatosPestana = async () => {
    setMensaje('');
    try {
      if (pestana === 'metricas') {
        const res = await fetchConToken('/metricas');
        if (res.ok) setMetricas(await res.json());
      } else if (pestana === 'ligas') {
        const res = await fetchConToken('/ligas');
        if (res.ok) setLigas(await res.json());
      } else if (pestana === 'usuarios') {
        const resLigas = await fetchConToken('/ligas');
        if (resLigas.ok) setLigas(await resLigas.json());
        const resUsers = await fetchConToken('/usuarios');
        if (resUsers.ok) setUsuariosList(await resUsers.json());
      } else if (pestana === 'notificaciones') {
        const resLigas = await fetchConToken('/ligas');
        if (resLigas.ok) setLigas(await resLigas.json());
        const resNotif = await fetchConToken('/notificaciones');
        if (resNotif.ok) setNotificaciones(await resNotif.json());
      } else if (pestana === 'bitacora') {
        const resUsers = await fetchConToken('/usuarios');
        if (resUsers.ok) setUsuariosList(await resUsers.json());
        
        let query = `/bitacora?rol=${filtroRol}&usuario_id=${filtroUsuarioId}&busqueda=${encodeURIComponent(busquedaBitacora)}`;
        const res = await fetchConToken(query);
        if (res.ok) setBitacora(await res.json());
      }
    } catch (err) {
      setMensaje('Error conectando con el servidor.');
    }
  };

  useEffect(() => {
    cargarDatosPestana();
  }, [pestana, filtroRol, filtroUsuarioId, busquedaBitacora]);

  const usuariosFiltrados = usuariosList.filter((u) => {
    const termino = busquedaUsuario.trim().toLowerCase();
    if (!termino) return true;

    const coincidenciaCorreo = u.email?.toLowerCase().includes(termino);
    const coincidenciaCedula = u.cedula?.toLowerCase().includes(termino);
    const coincidenciaNombre = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase().includes(termino);

    return coincidenciaCorreo || coincidenciaCedula || coincidenciaNombre;
  });

  const partidosAgendadosFiltrados = () => {
    if (!metricas?.partidos_agendados) return [];
    if (filtroPeriodo === 'todos') return metricas.partidos_agendados;

    const ahora = new Date();
    return metricas.partidos_agendados.filter((p) => {
      const fechaP = new Date(p.fecha_partido);
      if (filtroPeriodo === 'hoy') {
        return fechaP.toDateString() === ahora.toDateString();
      } else if (filtroPeriodo === 'semana') {
        const unaSemana = new Date();
        unaSemana.setDate(ahora.getDate() + 7);
        return fechaP >= ahora && fechaP <= unaSemana;
      } else if (filtroPeriodo === 'mes') {
        return fechaP.getMonth() === ahora.getMonth() && fechaP.getFullYear() === ahora.getFullYear();
      }
      return true;
    });
  };

  // Operaciones Ligas
  const guardarLiga = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/ligas', { method: 'POST', body: JSON.stringify(formLiga) });
    if (res.ok) {
      setMensaje('Liga creada con éxito.');
      setFormLiga({ nombre: '', responsable_nombre: '', responsable_telefono: '', responsable_email: '' });
      cargarDatosPestana();
    }
  };

  const actualizarLiga = async (e) => {
    e.preventDefault();
    const res = await fetchConToken(`/ligas/${ligaEditando.id}`, { method: 'PUT', body: JSON.stringify(ligaEditando) });
    if (res.ok) {
      setMensaje('Liga actualizada.');
      setLigaEditando(null);
      cargarDatosPestana();
    }
  };

  // Operaciones Usuarios
  const guardarUsuario = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/usuarios', { method: 'POST', body: JSON.stringify(formUser) });
    const data = await res.json();
    if (res.ok) {
      setMensaje(data.mensaje);
      setFormUser({ nombre: '', apellido: '', cedula: '', email: '', rol: 'administrador de liga', organizacion_id: '' });
      cargarDatosPestana();
    } else {
      setMensaje(`Error: ${data.error}`);
    }
  };

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    const res = await fetchConToken(`/usuarios/${userEditando.id}`, { method: 'PUT', body: JSON.stringify(userEditando) });
    if (res.ok) {
      setMensaje('Datos de usuario actualizados.');
      setUserEditando(null);
      cargarDatosPestana();
    }
  };

  const resetearPasswordAccion = async (user) => {
    const primerNombre = user.nombre ? user.nombre.trim().split(' ')[0] : 'User';
    const cincoDigitos = user.cedula ? user.cedula.trim().substring(0, 5) : '00000';

    if (!window.confirm(`¿Seguro que deseas restablecer la contraseña de ${user.nombre || user.email}? La nueva clave temporal será: ${primerNombre}${cincoDigitos}!`)) {
      return;
    }

    const res = await fetchConToken(`/usuarios/${user.id}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setMensaje(data.mensaje);
      cargarDatosPestana();
    } else {
      setMensaje(`Error: ${data.error}`);
    }
  };

  // Confirmar y Ejecutar Eliminación Segura
  const ejecutarEliminacion = async (e) => {
    e.preventDefault();
    if (!itemEliminar || !claveConfirmacion) return;

    const endpoint = itemEliminar.tipo === 'liga' ? `/ligas/${itemEliminar.id}` : `/usuarios/${itemEliminar.id}`;
    
    const res = await fetchConToken(endpoint, {
      method: 'DELETE',
      body: JSON.stringify({ password: claveConfirmacion })
    });

    const data = await res.json();

    if (res.ok) {
      setMensaje(data.mensaje);
      setItemEliminar(null);
      setClaveConfirmacion('');
      cargarDatosPestana();
    } else {
      setMensaje(`Error al eliminar: ${data.error}`);
    }
  };

  const enviarNotificacion = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/notificaciones', { method: 'POST', body: JSON.stringify(formNotif) });
    const data = await res.json();
    if (res.ok) {
      setMensaje(data.mensaje);
      setFormNotif({ tipo_destino: 'todos', organizacion_id: '', rol_destino: 'administrador de liga', titulo: '', mensaje: '' });
      cargarDatosPestana();
    } else {
      setMensaje(`Error: ${data.error}`);
    }
  };

  const ejecutarCerrarSesion = async () => {
    try {
      await fetchConToken('/log-evento', {
        method: 'POST',
        body: JSON.stringify({ accion: 'CERRAR_SESION', tabla: 'auth', detalles: { email: usuario?.email } })
      });
    } catch (e) {}
    cerrarSesion();
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>🛡️ Control General - Superadmin</h2>
        <button onClick={ejecutarCerrarSesion}>Cerrar Sesión</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
        {['metricas', 'ligas', 'usuarios', 'notificaciones', 'bitacora'].map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            style={{
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: pestana === p ? 'bold' : 'normal',
              borderBottom: pestana === p ? '3px solid #2B6CB0' : 'none',
              background: pestana === p ? '#EBF8FF' : 'transparent'
            }}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {mensaje && (
        <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: mensaje.includes('Error') ? '#FED7D7' : '#C6F6D5', color: mensaje.includes('Error') ? '#9B2C2C' : '#22543D' }}>
          {mensaje}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN CON CONTRASEÑA */}
      {itemEliminar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', maxWidth: '400px', width: '90%', color: '#333' }}>
            <h3 style={{ marginTop: 0, color: '#C53030' }}>⚠️ Confirmar Eliminación</h3>
            <p>
              Estás a punto de eliminar {itemEliminar.tipo === 'liga' ? 'la liga' : 'al usuario'}: <strong>{itemEliminar.nombre}</strong>.
            </p>
            <p style={{ fontSize: '0.85em', color: '#666' }}>
              Esta acción no se puede deshacer. Ingresa tu contraseña de Superadmin para autorizar la operación.
            </p>

            <form onSubmit={ejecutarEliminacion} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
              <input
                type="password"
                placeholder="Tu contraseña de Superadmin"
                value={claveConfirmacion}
                onChange={(e) => setClaveConfirmacion(e.target.value)}
                required
                autoFocus
                style={{ padding: '8px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => { setItemEliminar(null); setClaveConfirmacion(''); }}
                  style={{ background: '#E2E8F0', color: '#2D3748', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ background: '#E53E3E', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Eliminar Definitivamente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MÉTRICAS */}
      {pestana === 'metricas' && metricas && (
        <div>
          <h3>📊 Métricas Globales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
            <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Ligas Registradas</h4>
              <p style={{ fontSize: '2em', margin: 0 }}>{metricas.total_ligas}</p>
              <small>({metricas.ligas_activas} activas)</small>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Total Usuarios</h4>
              <p style={{ fontSize: '2em', margin: 0 }}>{metricas.total_usuarios}</p>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Usuarios por Rol</h4>
              {metricas.usuarios_por_rol.map(u => (
                <div key={u.rol} style={{ fontSize: '0.85em' }}>{u.rol}: {u.cantidad}</div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#2B6CB0' }}>🟢 Partidos en Vivo / Activos</h3>
            {metricas.partidos_activos.length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>No hay partidos en vivo en este momento.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                  <tr style={{ background: '#EBF8FF' }}>
                    <th style={{ border: '1px solid #bee3f8', padding: '8px' }}>ID</th>
                    <th style={{ border: '1px solid #bee3f8', padding: '8px' }}>Liga</th>
                    <th style={{ border: '1px solid #bee3f8', padding: '8px' }}>Fecha y Hora</th>
                    <th style={{ border: '1px solid #bee3f8', padding: '8px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.partidos_activos.map((p) => (
                    <tr key={p.id}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>#{p.id}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.liga_nombre || 'General'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(p.fecha_partido).toLocaleString()}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>🔴 {p.estado}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>📅 Partidos Agendados</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85em' }}>Filtrar Período:</label>
                <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
                  <option value="todos">Todos los Agendados</option>
                  <option value="hoy">Programados para Hoy</option>
                  <option value="semana">Esta Semana</option>
                  <option value="mes">Este Mes</option>
                </select>
              </div>
            </div>

            {partidosAgendadosFiltrados().length === 0 ? (
              <p style={{ fontStyle: 'italic', color: '#666' }}>No hay partidos agendados para este período.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                  <tr style={{ background: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>ID</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Liga</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fecha y Hora</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {partidosAgendadosFiltrados().map((p) => (
                    <tr key={p.id}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>#{p.id}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.liga_nombre || 'General'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(p.fecha_partido).toLocaleString()}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>⏳ Agendado</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* LIGAS CON ELIMINACIÓN */}
      {pestana === 'ligas' && (
        <div>
          <h3>{ligaEditando ? '✏️ Editar Liga' : '🏆 Registrar Nueva Liga'}</h3>
          <form onSubmit={ligaEditando ? actualizarLiga : guardarLiga} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <input type="text" placeholder="Nombre Liga" value={ligaEditando ? ligaEditando.nombre : formLiga.nombre} onChange={(e) => ligaEditando ? setLigaEditando({...ligaEditando, nombre: e.target.value}) : setFormLiga({...formLiga, nombre: e.target.value})} required />
            <input type="text" placeholder="Responsable" value={ligaEditando ? ligaEditando.responsable_nombre : formLiga.responsable_nombre} onChange={(e) => ligaEditando ? setLigaEditando({...ligaEditando, responsable_nombre: e.target.value}) : setFormLiga({...formLiga, responsable_nombre: e.target.value})} required />
            <input type="text" placeholder="Teléfono" value={ligaEditando ? ligaEditando.responsable_telefono : formLiga.responsable_telefono} onChange={(e) => ligaEditando ? setLigaEditando({...ligaEditando, responsable_telefono: e.target.value}) : setFormLiga({...formLiga, responsable_telefono: e.target.value})} required />
            <input type="email" placeholder="Correo" value={ligaEditando ? ligaEditando.responsable_email : formLiga.responsable_email} onChange={(e) => ligaEditando ? setLigaEditando({...ligaEditando, responsable_email: e.target.value}) : setFormLiga({...formLiga, responsable_email: e.target.value})} required />
            
            {ligaEditando && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={ligaEditando.estado_activa} onChange={(e) => setLigaEditando({...ligaEditando, estado_activa: e.target.checked})} />
                Liga Activa
              </label>
            )}

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
              <button type="submit">{ligaEditando ? 'Guardar Cambios' : 'Registrar Liga'}</button>
              {ligaEditando && <button type="button" onClick={() => setLigaEditando(null)}>Cancelar</button>}
            </div>
          </form>

          <h3>Ligas Registradas</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Nombre</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Responsable</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Estado</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ligas.map((l) => (
                <tr key={l.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{l.nombre}</strong></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{l.responsable_nombre} <br /><small>{l.responsable_email}</small></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{l.estado_activa ? '🟢 Activa' : '🔴 Inactiva'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', display: 'flex', gap: '5px' }}>
                    <button onClick={() => setLigaEditando(l)}>Editar</button>
                    <button 
                      onClick={() => setItemEliminar({ tipo: 'liga', id: l.id, nombre: l.nombre })}
                      style={{ background: '#E53E3E', color: '#fff', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer' }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* USUARIOS CON ELIMINACIÓN */}
      {pestana === 'usuarios' && (
        <div>
          <h3>{userEditando ? '✏️ Editar Usuario' : '👤 Crear Usuario / Credencial'}</h3>
          {userEditando ? (
            <form onSubmit={actualizarUsuario} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <input type="text" placeholder="Nombre" value={userEditando.nombre || ''} onChange={(e) => setUserEditando({...userEditando, nombre: e.target.value})} required />
              <input type="text" placeholder="Apellido" value={userEditando.apellido || ''} onChange={(e) => setUserEditando({...userEditando, apellido: e.target.value})} required />
              <input type="text" placeholder="Cédula (5 a 8 dígitos numéricos)" pattern="\d{5,8}" title="Debe ser exclusivamente numérica de 5 a 8 dígitos" value={userEditando.cedula || ''} onChange={(e) => setUserEditando({...userEditando, cedula: e.target.value})} required />
              <select value={userEditando.rol} onChange={(e) => setUserEditando({...userEditando, rol: e.target.value})}>
                <option value="administrador de liga">Administrador de Liga</option>
                <option value="arbitro/anotador">Árbitro / Anotador</option>
                <option value="delegado de equipo">Delegado de Equipo</option>
                <option value="Superadmin">Superadmin</option>
              </select>
              <select value={userEditando.organizacion_id || ''} onChange={(e) => setUserEditando({...userEditando, organizacion_id: e.target.value})}>
                <option value="">-- Sin Liga --</option>
                {ligas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
                <button type="submit">Actualizar Datos</button>
                <button type="button" onClick={() => setUserEditando(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <form onSubmit={guardarUsuario} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '600px', marginBottom: '20px' }}>
              <input type="text" placeholder="Nombre" value={formUser.nombre} onChange={(e) => setFormUser({...formUser, nombre: e.target.value})} required />
              <input type="text" placeholder="Apellido" value={formUser.apellido} onChange={(e) => setFormUser({...formUser, apellido: e.target.value})} required />
              <input type="text" placeholder="Cédula (5 a 8 dígitos numéricos)" pattern="\d{5,8}" title="Debe ser exclusivamente numérica de 5 a 8 dígitos" value={formUser.cedula} onChange={(e) => setFormUser({...formUser, cedula: e.target.value})} required />
              <input type="email" placeholder="Correo Electrónico" value={formUser.email} onChange={(e) => setFormUser({...formUser, email: e.target.value})} required />
              
              <select value={formUser.rol} onChange={(e) => setFormUser({...formUser, rol: e.target.value})}>
                <option value="administrador de liga">Administrador de Liga</option>
                <option value="arbitro/anotador">Árbitro / Anotador</option>
                <option value="delegado de equipo">Delegado de Equipo</option>
                <option value="Superadmin">Superadmin</option>
              </select>
              
              <select value={formUser.organizacion_id} onChange={(e) => setFormUser({...formUser, organizacion_id: e.target.value})}>
                <option value="">-- Asignar Liga --</option>
                {ligas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>

              <p style={{ gridColumn: 'span 2', margin: 0, fontSize: '0.8em', color: '#666' }}>
                ℹ️ <em>La contraseña inicial corresponderá al primer nombre, los primeros 5 dígitos de la cédula y un signo de exclamación (Ej. Juan30001!).</em>
              </p>

              <button type="submit" style={{ gridColumn: 'span 2' }}>Crear Usuario</button>
            </form>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3>Usuarios del Sistema ({usuariosFiltrados.length})</h3>
            <div style={{ width: '300px' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por Cédula, Correo o Nombre..."
                value={busquedaUsuario}
                onChange={(e) => setBusquedaUsuario(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '0.9em' }}
              />
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Usuario</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Cédula</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Email</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Rol</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Liga</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Cambio Clave</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '15px', color: '#666' }}>
                    No se encontraron usuarios que coincidan con "{busquedaUsuario}".
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{u.nombre} {u.apellido}</strong></td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.cedula || 'N/R'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.email}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.rol}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.organizacion_nombre || 'General'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                      {u.debe_cambiar_password ? '⚠️ Pendiente' : '✅ Al día'}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', display: 'flex', gap: '5px' }}>
                      <button onClick={() => setUserEditando(u)}>Editar</button>
                      <button onClick={() => resetearPasswordAccion(u)}>Reset Clave</button>
                      <button 
                        onClick={() => setItemEliminar({ tipo: 'usuario', id: u.id, nombre: `${u.nombre || ''} (${u.email})` })}
                        style={{ background: '#E53E3E', color: '#fff', border: 'none', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* NOTIFICACIONES */}
      {pestana === 'notificaciones' && (
        <div>
          <h3>📢 Enviar Comunicado Oficial</h3>
          <form onSubmit={enviarNotificacion} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '550px', marginBottom: '20px' }}>
            <label style={{ fontSize: '0.9em' }}><strong>Destinatarios:</strong></label>
            <select value={formNotif.tipo_destino} onChange={(e) => setFormNotif({...formNotif, tipo_destino: e.target.value})}>
              <option value="todos">Todos los usuarios del sistema</option>
              <option value="liga_especifica">Todos los miembros de una Liga específica</option>
              <option value="por_rol">Por Rol Global (ej: Todos los Árbitros)</option>
              <option value="admin_liga_especifica">Solo el Administrador de una Liga específica</option>
            </select>

            {(formNotif.tipo_destino === 'liga_especifica' || formNotif.tipo_destino === 'admin_liga_especifica') && (
              <select value={formNotif.organizacion_id} onChange={(e) => setFormNotif({...formNotif, organizacion_id: e.target.value})} required>
                <option value="">-- Selecciona la Liga --</option>
                {ligas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            )}

            {formNotif.tipo_destino === 'por_rol' && (
              <select value={formNotif.rol_destino} onChange={(e) => setFormNotif({...formNotif, rol_destino: e.target.value})}>
                <option value="administrador de liga">Administradores de Liga</option>
                <option value="arbitro/anotador">Árbitros / Anotadores</option>
                <option value="delegado de equipo">Delegados de Equipo</option>
              </select>
            )}

            <input type="text" placeholder="Título del Comunicado" value={formNotif.titulo} onChange={(e) => setFormNotif({...formNotif, titulo: e.target.value})} required />
            <textarea placeholder="Redactar mensaje..." value={formNotif.mensaje} onChange={(e) => setFormNotif({...formNotif, mensaje: e.target.value})} rows={4} required />
            <button type="submit">Enviar Notificación</button>
          </form>

          <h3>Historial Reciente</h3>
          <ul>
            {notificaciones.map((n) => (
              <li key={n.id} style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                <strong>{n.titulo}</strong> <small>({new Date(n.hora_envio).toLocaleString()})</small>
                <br /><small>Para: {n.destinatario_email || 'General'} ({n.organizacion_nombre || 'Todas'})</small>
                <p style={{ margin: '5px 0' }}>{n.mensaje}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* BITÁCORA */}
      {pestana === 'bitacora' && (
        <div>
          <h3>🔍 Bitácora de Auditoría (Todas las Acciones)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px', background: '#f8f8f8', padding: '12px', borderRadius: '6px' }}>
            <div>
              <label style={{ fontSize: '0.85em', display: 'block', fontWeight: 'bold' }}>Buscar por Cédula o Correo:</label>
              <input
                type="text"
                placeholder="Escribe Cédula o Correo..."
                value={busquedaBitacora}
                onChange={(e) => setBusquedaBitacora(e.target.value)}
                style={{ width: '100%', padding: '6px', fontSize: '0.9em' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85em', display: 'block', fontWeight: 'bold' }}>Filtrar por Rol:</label>
              <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                <option value="">-- Todos los Roles --</option>
                <option value="Superadmin">Superadmin</option>
                <option value="administrador de liga">Administrador de Liga</option>
                <option value="arbitro/anotador">Árbitro / Anotador</option>
                <option value="delegado de equipo">Delegado de Equipo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85em', display: 'block', fontWeight: 'bold' }}>Filtrar por Usuario Específico:</label>
              <select value={filtroUsuarioId} onChange={(e) => setFiltroUsuarioId(e.target.value)} style={{ width: '100%', padding: '6px' }}>
                <option value="">-- Todos los Usuarios --</option>
                {usuariosList.map(u => <option key={u.id} value={u.id}>{u.email} ({u.cedula || 'Sin cédula'})</option>)}
              </select>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Fecha y Hora</th>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Usuario</th>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Cédula</th>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Rol</th>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Acción</th>
                <th style={{ border: '1px solid #ddd', padding: '6px' }}>Módulo / Tabla</th>
              </tr>
            </thead>
            <tbody>
              {bitacora.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '15px', color: '#666' }}>
                    No se encontraron registros de auditoría para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                bitacora.map((b) => (
                  <tr key={b.id}>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{new Date(b.fecha).toLocaleString()}</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{b.usuario_email || 'Sistema'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{b.usuario_cedula || '-'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{b.usuario_rol || '-'}</td>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}><strong>{b.accion}</strong></td>
                    <td style={{ border: '1px solid #ddd', padding: '6px' }}>{b.tabla}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}