import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function AdminLigaDashboard({ usuario, cerrarSesion }) {
  const [pestana, setPestana] = useState('equipos');
  const [mensaje, setMensaje] = useState('');
  const [debeCambiarPass, setDebeCambiarPass] = useState(false);
  const [nuevaClave, setNuevaClave] = useState('');

  // Estados Globales
  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [plantillasReglas, setPlantillasReglas] = useState([]);
  const [recursosTorneo, setRecursosTorneo] = useState({ sedes: [], arbitros: [], equipos: [] });
  const [usuariosOperativos, setUsuariosOperativos] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [partidos, setPartidos] = useState([]);

  // Estados para edición de jugador
  const [jugadorEditandoId, setJugadorEditandoId] = useState(null);

  // Formularios
  const [formSede, setFormSede] = useState({ nombre: '', direccion: '' });
  const [formEquipo, setFormEquipo] = useState({ nombre: '', categoria: 'Adulto 22+', tipo_genero: 'Mixto', logo_url: '' });
  const [formJugador, setFormJugador] = useState({ cedula: '', nombre: '', apellido: '', fecha_nacimiento: '', correo: '', telefono: '', numero_dorsal: '', foto_url: '', es_capitan: false });
  const [formCredencial, setFormCredencial] = useState({ nombre: '', apellido: '', cedula: '', email: '', rol: 'arbitro/anotador', equipo_id: '' });
  const [formReglas, setFormReglas] = useState({ nombre: '', descripcion: '', limite_jugadores: 8, meta_puntos: 15, tiempo_minutos: 60, tarjetas_suspension: 2, politica_clasificacion: 'ganador_vs_ganador' });
  
  // Torneo
  const [formTorneo, setFormTorneo] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '', plantilla_id: '' });
  const [partidosIniciales, setPartidosIniciales] = useState([]);
  const [nuevoPartido, setNuevoPartido] = useState({ local_id: '', visita_id: '', sede_id: '', arbitro_id: '', anotador_id: '', fecha_hora: '', fase: 'Eliminatoria' });

  const fetchConToken = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    return await fetch(`${API_URL}/admin-liga${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, ...options.headers },
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.debe_cambiar_password) setDebeCambiarPass(true);
    });
  }, []);

  const cargarDatos = async () => {
    setMensaje('');
    try {
      if (pestana === 'equipos' || pestana === 'credenciales') {
        const res = await fetchConToken('/equipos');
        if (res.ok) setEquipos(await res.json());
        const resOp = await fetchConToken('/usuarios-operativos');
        if (resOp.ok) setUsuariosOperativos(await resOp.json());
      } else if (pestana === 'sedes') {
        const res = await fetchConToken('/sedes');
        if (res.ok) setSedes(await res.json());
      } else if (pestana === 'reglas') {
        const res = await fetchConToken('/plantillas-reglas');
        if (res.ok) setPlantillasReglas(await res.json());
      } else if (pestana === 'torneos') {
        const resEq = await fetchConToken('/equipos');
        if (resEq.ok) setEquipos(await resEq.json());
        const resReg = await fetchConToken('/plantillas-reglas');
        if (resReg.ok) setPlantillasReglas(await resReg.json());
        const resRec = await fetchConToken('/torneos/recursos');
        if (resRec.ok) setRecursosTorneo(await resRec.json());
      } else if (pestana === 'estadisticas') {
        const res = await fetchConToken('/estadisticas');
        if (res.ok) setEstadisticas(await res.json());
      } else if (pestana === 'historial') {
        const res = await fetchConToken('/partidos-finalizados');
        if (res.ok) setPartidos(await res.json());
      }
    } catch (e) { setMensaje('Error cargando datos del servidor.'); }
  };

  useEffect(() => { cargarDatos(); }, [pestana]);

  const seleccionarEquipoModal = async (equipo) => {
    setEquipoSeleccionado(equipo);
    setJugadorEditandoId(null);
    setFormJugador({ cedula: '', nombre: '', apellido: '', fecha_nacimiento: '', correo: '', telefono: '', numero_dorsal: '', foto_url: '', es_capitan: false });
    const res = await fetchConToken(`/equipos/${equipo.id}/jugadores`);
    if (res.ok) setJugadores(await res.json());
  };

  const guardarSede = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/sedes', { method: 'POST', body: JSON.stringify(formSede) });
    if (res.ok) { setMensaje('Sede registrada con éxito.'); setFormSede({ nombre: '', direccion: '' }); cargarDatos(); }
  };

  const eliminarSede = async (id) => {
    if (!window.confirm('¿Eliminar esta sede?')) return;
    const res = await fetchConToken(`/sedes/${id}`, { method: 'DELETE' });
    if (res.ok) cargarDatos();
  };

  const guardarEquipo = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/equipos', { method: 'POST', body: JSON.stringify(formEquipo) });
    if (res.ok) { setMensaje('Equipo registrado.'); setFormEquipo({ nombre: '', categoria: 'Adulto 22+', tipo_genero: 'Mixto', logo_url: '' }); cargarDatos(); }
  };

  const guardarJugador = async (e) => {
    e.preventDefault();
    const endpoint = jugadorEditandoId ? `/jugadores/${jugadorEditandoId}` : `/jugadores`;
    const metodo = jugadorEditandoId ? 'PUT' : 'POST';

    const res = await fetchConToken(endpoint, { 
      method: metodo, 
      body: JSON.stringify({ ...formJugador, equipo_id: equipoSeleccionado.id }) 
    });
    const data = await res.json();
    if (res.ok) {
      setMensaje(jugadorEditandoId ? 'Jugador actualizado con éxito.' : 'Jugador agregado.');
      setFormJugador({ cedula: '', nombre: '', apellido: '', fecha_nacimiento: '', correo: '', telefono: '', numero_dorsal: '', foto_url: '', es_capitan: false });
      setJugadorEditandoId(null);
      seleccionarEquipoModal(equipoSeleccionado);
    } else { alert(data.error); }
  };

  const iniciarEdicionJugador = (j) => {
    setJugadorEditandoId(j.id);
    setFormJugador({
      cedula: j.cedula || '',
      nombre: j.nombre || '',
      apellido: j.apellido || '',
      fecha_nacimiento: j.fecha_nacimiento ? j.fecha_nacimiento.split('T')[0] : '',
      correo: j.correo || '',
      telefono: j.telefono || '',
      numero_dorsal: j.numero_dorsal || '',
      foto_url: j.foto_url || '',
      es_capitan: equipoSeleccionado?.capitan_id === j.id
    });
  };

  const desactivarJugador = async (id) => {
    if (!window.confirm('¿Desactivar este jugador?')) return;
    const res = await fetchConToken(`/jugadores/${id}`, { method: 'DELETE' });
    if (res.ok) seleccionarEquipoModal(equipoSeleccionado);
  };

  const guardarCredencial = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/crear-credencial', { method: 'POST', body: JSON.stringify(formCredencial) });
    const data = await res.json();
    if (res.ok) { 
      setMensaje(data.mensaje); 
      setFormCredencial({ nombre: '', apellido: '', cedula: '', email: '', rol: 'arbitro/anotador', equipo_id: '' }); 
      cargarDatos();
    } else { alert(data.error); }
  };

  const resetearPasswordOperativo = async (userId, cedula, nombre) => {
    const primerNombre = nombre ? nombre.trim().split(' ')[0] : 'User';
    if (!window.confirm(`¿Restablecer contraseña para ${nombre}? Nueva clave: ${primerNombre}${cedula.substring(0,5)}!`)) return;
    const res = await fetchConToken(`/usuarios/${userId}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) alert(data.mensaje); else alert(data.error);
  };

  const reasignarDelegado = async (equipoId, delegadoId) => {
    const res = await fetchConToken(`/equipos/${equipoId}/delegado`, { method: 'PUT', body: JSON.stringify({ delegado_id: delegadoId }) });
    if (res.ok) { setMensaje('Delegado reasignado.'); cargarDatos(); }
  };

  const guardarReglas = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/plantillas-reglas', { 
      method: 'POST', 
      body: JSON.stringify({ nombre: formReglas.nombre, descripcion: formReglas.descripcion, reglas: formReglas }) 
    });
    if (res.ok) { 
      setMensaje('Plantilla de reglas guardada.'); 
      setFormReglas({ nombre: '', descripcion: '', limite_jugadores: 8, meta_puntos: 15, tiempo_minutos: 60, tarjetas_suspension: 2, politica_clasificacion: 'ganador_vs_ganador' }); 
      cargarDatos(); 
    }
  };

  const guardarTorneo = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/torneos', { method: 'POST', body: JSON.stringify({ ...formTorneo, partidos_iniciales: partidosIniciales }) });
    const data = await res.json();
    if (res.ok) { setMensaje('Torneo creado con éxito.'); setPartidosIniciales([]); cargarDatos(); }
    else { alert(data.error); }
  };

  const cambiarClaveObligatoria = async (e) => {
    e.preventDefault();
    const res = await fetchConToken('/cambiar-password-obligatorio', { method: 'POST', body: JSON.stringify({ nueva_password: nuevaClave }) });
    if (res.ok) { alert('Contraseña actualizada.'); setDebeCambiarPass(false); }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '1050px', margin: '0 auto', padding: '10px' }}>
      {debeCambiarPass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '400px', width: '90%' }}>
            <h3>🔒 Cambio Obligatorio de Contraseña</h3>
            <form onSubmit={cambiarClaveObligatoria} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="password" placeholder="Nueva Contraseña (mín 6 chars)" value={nuevaClave} onChange={e => setNuevaClave(e.target.value)} required minLength={6} />
              <button type="submit">Actualizar Contraseña</button>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>🏆 Panel de Administrador de Liga</h2>
        <button onClick={cerrarSesion}>Cerrar Sesión</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
        {['equipos', 'sedes', 'credenciales', 'reglas', 'torneos', 'estadisticas', 'historial'].map((p) => (
          <button key={p} onClick={() => setPestana(p)} style={{ padding: '8px 14px', cursor: 'pointer', fontWeight: pestana === p ? 'bold' : 'normal', borderBottom: pestana === p ? '3px solid #2B6CB0' : 'none', background: pestana === p ? '#EBF8FF' : 'transparent' }}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {mensaje && <div style={{ padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: '#EBF8FF', color: '#2B6CB0' }}>{mensaje}</div>}

      {/* SECCIÓN DE SEDES */}
      {pestana === 'sedes' && (
        <div>
          <h3>🏟️ Registrar Nueva Sede</h3>
          <form onSubmit={guardarSede} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <input type="text" placeholder="Nombre de la Sede" value={formSede.nombre} onChange={e => setFormSede({...formSede, nombre: e.target.value})} required />
            <input type="text" placeholder="Dirección / Ubicación" value={formSede.direccion} onChange={e => setFormSede({...formSede, direccion: e.target.value})} />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Guardar Sede</button>
          </form>

          <h3>Listado de Sedes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ padding: '8px' }}>Sede</th>
                <th style={{ padding: '8px' }}>Dirección</th>
                <th style={{ padding: '8px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map(s => (
                <tr key={s.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{s.nombre}</strong></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{s.direccion || 'Sin dirección'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <button onClick={() => eliminarSede(s.id)} style={{ background: '#E53E3E', color: 'white', border: 'none', padding: '4px 8px' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EQUIPOS Y JUGADORES */}
      {pestana === 'equipos' && (
        <div>
          <h3>🛡️ Registrar Nuevo Equipo</h3>
          <form onSubmit={guardarEquipo} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <input type="text" placeholder="Nombre Equipo" value={formEquipo.nombre} onChange={e => setFormEquipo({...formEquipo, nombre: e.target.value})} required />
            <select value={formEquipo.categoria} onChange={e => setFormEquipo({...formEquipo, categoria: e.target.value})}>
              <option value="Pre-Infantil (<8)">Pre-Infantil (&lt;8)</option>
              <option value="Infantil (8-13)">Infantil (8-13)</option>
              <option value="Adulto 22+">Adulto 22+</option>
              <option value="Libre">Libre / Ejecutivos</option>
            </select>
            <select value={formEquipo.tipo_genero} onChange={e => setFormEquipo({...formEquipo, tipo_genero: e.target.value})}>
              <option value="Mixto">Mixto</option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
            </select>
            <button type="submit" style={{ gridColumn: 'span 3' }}>Guardar Equipo</button>
          </form>

          <h3>Listado de Equipos</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ padding: '8px' }}>Equipo</th>
                <th style={{ padding: '8px' }}>Categoría / Género</th>
                <th style={{ padding: '8px' }}>Delegado Actual</th>
                <th style={{ padding: '8px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map(e => (
                <tr key={e.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{e.nombre}</strong></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{e.categoria} - {e.tipo_genero}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <select value={e.delegado_id_usuario || ''} onChange={ev => reasignarDelegado(e.id, ev.target.value)}>
                      <option value="">-- Sin Delegado --</option>
                      {usuariosOperativos.filter(u => u.rol?.toLowerCase().includes('delegado')).map(u => (
                        <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <button onClick={() => seleccionarEquipoModal(e)}>👥 Nómina ({e.total_jugadores})</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {equipoSeleccionado && (
            <div style={{ marginTop: '30px', border: '1px solid #2B6CB0', padding: '15px', borderRadius: '6px', background: '#F7FAFC' }}>
              <h4>{jugadorEditandoId ? '✏️ Modificar Jugador' : `Nómina de: ${equipoSeleccionado.nombre}`}</h4>
              <form onSubmit={guardarJugador} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '15px', marginBottom: '15px' }}>
                <input type="text" placeholder="Cédula (5-8 dígitos)" pattern="\d{5,8}" value={formJugador.cedula} onChange={e => setFormJugador({...formJugador, cedula: e.target.value})} required />
                <input type="text" placeholder="Nombre" value={formJugador.nombre} onChange={e => setFormJugador({...formJugador, nombre: e.target.value})} required />
                <input type="text" placeholder="Apellido" value={formJugador.apellido} onChange={e => setFormJugador({...formJugador, apellido: e.target.value})} required />
                <input type="date" value={formJugador.fecha_nacimiento} onChange={e => setFormJugador({...formJugador, fecha_nacimiento: e.target.value})} required />
                <input type="email" placeholder="Correo Obligatorio" value={formJugador.correo} onChange={e => setFormJugador({...formJugador, correo: e.target.value})} required />
                <input type="text" placeholder="Teléfono Obligatorio" value={formJugador.telefono} onChange={e => setFormJugador({...formJugador, telefono: e.target.value})} required />
                <input type="number" min="1" placeholder="Dorsal Positivo" value={formJugador.numero_dorsal} onChange={e => setFormJugador({...formJugador, numero_dorsal: e.target.value})} required />
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="checkbox" checked={formJugador.es_capitan} onChange={e => setFormJugador({...formJugador, es_capitan: e.target.checked})} /> Capitán
                </label>
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '5px' }}>
                  <button type="submit" style={{ flex: 1 }}>{jugadorEditandoId ? 'Actualizar Jugador' : 'Registrar Jugador'}</button>
                  {jugadorEditandoId && <button type="button" onClick={() => { setJugadorEditandoId(null); setFormJugador({ cedula: '', nombre: '', apellido: '', fecha_nacimiento: '', correo: '', telefono: '', numero_dorsal: '', foto_url: '', es_capitan: false }); }}>Cancelar</button>}
                </div>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                <thead>
                  <tr style={{ background: '#E2E8F0' }}>
                    <th style={{ padding: '6px' }}>Dorsal</th>
                    <th style={{ padding: '6px' }}>Jugador</th>
                    <th style={{ padding: '6px' }}>Cédula</th>
                    <th style={{ padding: '6px' }}>Contacto</th>
                    <th style={{ padding: '6px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map(j => (
                    <tr key={j.id}>
                      <td style={{ padding: '6px', textAlign: 'center' }}><strong>#{j.numero_dorsal}</strong></td>
                      <td style={{ padding: '6px' }}>{j.nombre} {j.apellido} {equipoSeleccionado.capitan_id === j.id && '⭐'}</td>
                      <td style={{ padding: '6px' }}>{j.cedula}</td>
                      <td style={{ padding: '6px' }}>{j.correo} / {j.telefono}</td>
                      <td style={{ padding: '6px', display: 'flex', gap: '4px' }}>
                        <button onClick={() => iniciarEdicionJugador(j)} style={{ background: '#3182CE', color: 'white', border: 'none', padding: '3px 6px' }}>Editar</button>
                        <button onClick={() => desactivarJugador(j.id)} style={{ background: '#E53E3E', color: 'white', border: 'none', padding: '3px 6px' }}>Desactivar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREDENCIALES */}
      {pestana === 'credenciales' && (
        <div>
          <h3>👤 Crear Credencial y Gestión de Usuarios Operativos</h3>
          <form onSubmit={guardarCredencial} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '500px', marginBottom: '30px' }}>
            <select value={formCredencial.rol} onChange={e => setFormCredencial({...formCredencial, rol: e.target.value, equipo_id: ''})}>
              <option value="arbitro/anotador">Árbitro / Anotador</option>
              <option value="delegado de equipo">Delegado de Equipo</option>
            </select>

            {formCredencial.rol === 'delegado de equipo' && (
              <select 
                value={formCredencial.equipo_id} 
                onChange={e => {
                  const eqId = e.target.value;
                  const eq = equipos.find(x => x.id === parseInt(eqId));
                  if (eq && eq.capitan_nombre) {
                    setFormCredencial({
                      ...formCredencial,
                      equipo_id: eqId,
                      nombre: eq.capitan_nombre,
                      apellido: eq.capitan_apellido || '',
                      cedula: eq.capitan_cedula || '',
                      email: eq.capitan_correo || ''
                    });
                  } else { setFormCredencial({...formCredencial, equipo_id: eqId}); }
                }}
              >
                <option value="">-- Seleccionar Equipo para auto-llenar Capitán --</option>
                {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre} (Capitán: {eq.capitan_nombre || 'N/R'})</option>)}
              </select>
            )}

            <input type="text" placeholder="Nombre" value={formCredencial.nombre} onChange={e => setFormCredencial({...formCredencial, nombre: e.target.value})} required />
            <input type="text" placeholder="Apellido" value={formCredencial.apellido} onChange={e => setFormCredencial({...formCredencial, apellido: e.target.value})} required />
            <input type="text" placeholder="Cédula (5-8 dígitos)" pattern="\d{5,8}" value={formCredencial.cedula} onChange={e => setFormCredencial({...formCredencial, cedula: e.target.value})} required />
            <input type="email" placeholder="Correo Electrónico" value={formCredencial.email} onChange={e => setFormCredencial({...formCredencial, email: e.target.value})} required />

            <button type="submit">Generar Credencial</button>
          </form>

          <h3>Listado de Usuarios Operativos Registrados en la Liga</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ padding: '8px' }}>Usuario</th>
                <th style={{ padding: '8px' }}>Rol</th>
                <th style={{ padding: '8px' }}>Cédula</th>
                <th style={{ padding: '8px' }}>Correo</th>
                <th style={{ padding: '8px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuariosOperativos.map(u => (
                <tr key={u.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{u.nombre} {u.apellido}</strong></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.rol}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.cedula}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{u.email}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    <button onClick={() => resetearPasswordOperativo(u.id, u.cedula, u.nombre)}>Reset Clave</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* REGLAS */}
      {pestana === 'reglas' && (
        <div>
          <h3>📋 Plantillas de Reglas Parametrizables</h3>
          <form onSubmit={guardarReglas} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '600px', marginBottom: '20px' }}>
            <input type="text" placeholder="Nombre Plantilla" value={formReglas.nombre} onChange={e => setFormReglas({...formReglas, nombre: e.target.value})} required />
            <input type="text" placeholder="Descripción" value={formReglas.descripcion} onChange={e => setFormReglas({...formReglas, descripcion: e.target.value})} />
            
            <label>Límite Jugadores: <input type="number" min="1" value={formReglas.limite_jugadores} onChange={e => setFormReglas({...formReglas, limite_jugadores: parseInt(e.target.value)})} required /></label>
            <label>Meta Tantos: <input type="number" min="1" value={formReglas.meta_puntos} onChange={e => setFormReglas({...formReglas, meta_puntos: parseInt(e.target.value)})} required /></label>
            <label>Tiempo (Min): <input type="number" min="1" value={formReglas.tiempo_minutos} onChange={e => setFormReglas({...formReglas, tiempo_minutos: parseInt(e.target.value)})} required /></label>
            <label>Tarjetas Suspensión: <input type="number" min="0" value={formReglas.tarjetas_suspension} onChange={e => setFormReglas({...formReglas, tarjetas_suspension: parseInt(e.target.value)})} required /></label>

            <label style={{ gridColumn: 'span 2' }}>Política de Clasificación:
              <select value={formReglas.politica_clasificacion} onChange={e => setFormReglas({...formReglas, politica_clasificacion: e.target.value})} style={{ width: '100%', marginTop: '5px' }}>
                <option value="ganador_vs_ganador">Ganador vs Ganador</option>
                <option value="perdedor_vs_perdedor">Perdedor vs Perdedor (Consolación)</option>
                <option value="cruzado">Cruce Olímpico</option>
              </select>
            </label>

            <button type="submit" style={{ gridColumn: 'span 2' }}>Guardar Plantilla de Reglas</button>
          </form>

          <h3>Plantillas Guardadas</h3>
          <ul>
            {plantillasReglas.map(p => (
              <li key={p.id} style={{ marginBottom: '10px' }}>
                <strong>{p.nombre}</strong> - <small>{p.descripcion}</small> <br />
                <small>Meta: {p.reglas?.meta_puntos} pts | Tiempo: {p.reglas?.tiempo_minutos} min | Clasificación: <strong>{p.reglas?.politica_clasificacion}</strong></small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TORNEOS */}
      {pestana === 'torneos' && (
        <div>
          <h3>🏆 Estructurar Torneo y Partidos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '6px' }}>
              <h4>1. Datos Generales</h4>
              <input type="text" placeholder="Nombre Torneo" value={formTorneo.nombre} onChange={e => setFormTorneo({...formTorneo, nombre: e.target.value})} style={{ width: '100%', marginBottom: '10px' }} required />
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input type="date" value={formTorneo.fecha_inicio} onChange={e => setFormTorneo({...formTorneo, fecha_inicio: e.target.value})} required />
                <input type="date" value={formTorneo.fecha_fin} onChange={e => setFormTorneo({...formTorneo, fecha_fin: e.target.value})} required />
              </div>
              <select value={formTorneo.plantilla_id} onChange={e => setFormTorneo({...formTorneo, plantilla_id: e.target.value})} style={{ width: '100%' }} required>
                <option value="">-- Selecciona Plantilla de Reglas --</option>
                {plantillasReglas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div style={{ border: '1px solid #2B6CB0', padding: '15px', borderRadius: '6px', background: '#F7FAFC' }}>
              <h4>2. Agendar Partido (Misma Categoría)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={nuevoPartido.local_id} onChange={e => setNuevoPartido({...nuevoPartido, local_id: e.target.value})}>
                  <option value="">-- Local --</option>
                  {recursosTorneo.equipos.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.categoria})</option>)}
                </select>
                <select value={nuevoPartido.visita_id} onChange={e => setNuevoPartido({...nuevoPartido, visita_id: e.target.value})}>
                  <option value="">-- Visita --</option>
                  {recursosTorneo.equipos.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.categoria})</option>)}
                </select>
                <select value={nuevoPartido.arbitro_id} onChange={e => setNuevoPartido({...nuevoPartido, arbitro_id: e.target.value})}>
                  <option value="">-- Árbitro --</option>
                  {recursosTorneo.arbitros.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                </select>
                <select value={nuevoPartido.anotador_id} onChange={e => setNuevoPartido({...nuevoPartido, anotador_id: e.target.value})}>
                  <option value="">-- Anotador --</option>
                  {recursosTorneo.arbitros.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>)}
                </select>
                <select value={nuevoPartido.sede_id} onChange={e => setNuevoPartido({...nuevoPartido, sede_id: e.target.value})}>
                  <option value="">-- Sede --</option>
                  {recursosTorneo.sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <input type="datetime-local" value={nuevoPartido.fecha_hora} onChange={e => setNuevoPartido({...nuevoPartido, fecha_hora: e.target.value})} />
                <button type="button" onClick={() => { setPartidosIniciales([...partidosIniciales, nuevoPartido]); setNuevoPartido({ local_id: '', visita_id: '', sede_id: '', arbitro_id: '', anotador_id: '', fecha_hora: '', fase: 'Eliminatoria' }); }} style={{ gridColumn: 'span 2' }}>➕ Añadir Partido</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h4>Partidos Agendados ({partidosIniciales.length})</h4>
            <button onClick={guardarTorneo} style={{ background: '#2B6CB0', color: 'white', padding: '10px 20px', marginTop: '10px' }}>Guardar Torneo Completo</button>
          </div>
        </div>
      )}

      {/* ESTADÍSTICAS */}
      {pestana === 'estadisticas' && estadisticas && (
        <div>
          <h3>📊 Métricas y Estadísticas de la Liga</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ border: '1px solid #ccc', padding: '15px', textAlign: 'center', borderRadius: '6px' }}><h4>Partidos Jugados</h4><p style={{ fontSize: '2em', margin: 0 }}>{estadisticas.partidos_jugados}</p></div>
            <div style={{ border: '1px solid #ccc', padding: '15px', textAlign: 'center', borderRadius: '6px' }}><h4>Torneos Totales</h4><p style={{ fontSize: '2em', margin: 0 }}>{estadisticas.total_torneos}</p></div>
            <div style={{ border: '1px solid #ccc', padding: '15px', textAlign: 'center', borderRadius: '6px' }}><h4>Equipos Inscritos</h4><p style={{ fontSize: '2em', margin: 0 }}>{estadisticas.total_equipos}</p></div>
            <div style={{ border: '1px solid #ccc', padding: '15px', textAlign: 'center', borderRadius: '6px' }}><h4>Jugadores Activos</h4><p style={{ fontSize: '2em', margin: 0 }}>{estadisticas.total_jugadores}</p></div>
            <div style={{ border: '1px solid #ccc', padding: '15px', textAlign: 'center', borderRadius: '6px' }}><h4>Tarjetas Acumuladas</h4><p style={{ fontSize: '2em', margin: 0 }}>{estadisticas.total_tarjetas}</p></div>
          </div>

          <h3>⭐ Top Jugadores Destacados (Efectividad)</h3>
          <ul>
            {estadisticas.mejores_jugadores.map((j, i) => (
              <li key={i}><strong>{j.nombre} {j.apellido}</strong> ({j.equipo}) - {j.efectivas} jugadas efectivas</li>
            ))}
          </ul>
        </div>
      )}

      {/* HISTORIAL */}
      {pestana === 'historial' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead><tr style={{ background: '#eee' }}><th style={{ padding: '8px' }}>Fecha</th><th style={{ padding: '8px' }}>Torneo</th><th style={{ padding: '8px' }}>Encuentro</th><th style={{ padding: '8px' }}>Marcador</th></tr></thead>
          <tbody>
            {partidos.map(p => (
              <tr key={p.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(p.fecha_hora).toLocaleDateString()}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.torneo_nombre}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.local_nombre} vs {p.visita_nombre}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{p.marcador_local !== null ? `${p.marcador_local} - ${p.marcador_visita}` : 'Pendiente'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}