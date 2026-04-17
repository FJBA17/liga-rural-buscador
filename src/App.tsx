import { useState, useEffect } from 'react'
import { Menu, X, Search, Users, Info } from 'lucide-react'
import logoLiga from './assets/LogoLiga.png'
import logoSmall from './assets/LogoLigaSmall.png'
import './App.css'

const GQL_URL = import.meta.env.VITE_GRAPHQL_URL as string

interface Jugador {
  id: string
  nombre: string
  rutOriginal: string
  equipo: string
}

type Modo = 'nombre' | 'rut'

function normalizeRut(raw: string): string {
  let r = raw.replace(/[.,\s]/g, '').toLowerCase()
  // Si el usuario escribió sin guión (ej: 207448958 → 20744895-8)
  if (!r.includes('-') && r.length > 1) {
    r = r.slice(0, -1) + '-' + r.slice(-1)
  }
  return r
}

async function buscarJugador(query: string): Promise<Jugador[]> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($q:String!){ buscarJugadorLiga2025(query:$q){ id nombre rutOriginal equipo } }`,
      variables: { q: query },
    }),
  })
  const json = await res.json()
  return json.data?.buscarJugadorLiga2025 ?? []
}

async function obtenerTodos(): Promise<Jugador[]> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{ jugadoresLiga2025 { id nombre rutOriginal equipo } }`,
    }),
  })
  const json = await res.json()
  return json.data?.jugadoresLiga2025 ?? []
}

function agruparPorEquipo(jugadores: Jugador[]): Record<string, Jugador[]> {
  return jugadores.reduce<Record<string, Jugador[]>>((acc, j) => {
    if (!acc[j.equipo]) acc[j.equipo] = []
    acc[j.equipo].push(j)
    return acc
  }, {})
}

// ── Sección Clubes ───────────────────────────────────────────────────────────
function PaginaClubes() {
  const [todos, setTodos] = useState<Jugador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filtroClub, setFiltroClub] = useState('')
  const [clubSeleccionado, setClubSeleccionado] = useState<string | null>(null)
  const [filtroJugador, setFiltroJugador] = useState('')

  useEffect(() => {
    obtenerTodos()
      .then(data => { setTodos(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const grupos = agruparPorEquipo(todos)
  const equipos = Object.keys(grupos).sort()

  // Vista detalle de un club
  if (clubSeleccionado) {
    const todos_jugadores = (grupos[clubSeleccionado] ?? [])
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    const jugadoresFiltrados = filtroJugador.trim()
      ? todos_jugadores.filter(j =>
          j.nombre.toLowerCase().includes(filtroJugador.toLowerCase()) ||
          j.rutOriginal.replace(/[.\s]/g, '').includes(filtroJugador.replace(/[.\s]/g, ''))
        )
      : todos_jugadores
    return (
      <div className="pagina">
        <button className="back-btn" onClick={() => { setClubSeleccionado(null); setFiltroJugador('') }}>
          ← Volver a clubes
        </button>
        <div className="club-detalle-header">
          <h2 className="club-detalle-nombre">{clubSeleccionado}</h2>
          <span className="club-count">{todos_jugadores.length} jugadores</span>
        </div>
        <input
          className="search-input club-filter"
          type="text"
          placeholder="Buscar jugador..."
          value={filtroJugador}
          onChange={e => setFiltroJugador(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        <ul className="club-jugadores club-jugadores-detalle">
          {jugadoresFiltrados.length === 0 ? (
            <li className="msg-vacio" style={{ padding: '12px 16px' }}>No se encontraron jugadores.</li>
          ) : (
            jugadoresFiltrados.map(j => (
              <li key={j.id} className="club-jugador">
                <span className="cj-nombre">{j.nombre}</span>
                <span className="cj-rut">{j.rutOriginal}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    )
  }

  // Vista lista de clubes
  const equiposFiltrados = filtroClub.trim()
    ? equipos.filter(e => e.toLowerCase().includes(filtroClub.toLowerCase()))
    : equipos

  return (
    <div className="pagina">
      <h2 className="section-title">Clubes · Edición 2025</h2>

      <input
        className="search-input club-filter"
        type="text"
        placeholder="Buscar club..."
        value={filtroClub}
        onChange={e => setFiltroClub(e.target.value)}
        autoComplete="off"
      />

      {loading && <p className="msg-vacio">Cargando...</p>}
      {error && <p className="msg-error">Error al cargar los datos.</p>}

      {!loading && !error && (
        <div className="clubes-lista">
          {equiposFiltrados.length === 0 ? (
            <p className="msg-vacio">No se encontraron clubes.</p>
          ) : (
            equiposFiltrados.map(equipo => (
              <button
                key={equipo}
                className="club-card club-card-btn"
                onClick={() => setClubSeleccionado(equipo)}
              >
                <span className="club-nombre">{equipo}</span>
                <span className="club-count">{grupos[equipo].length} jugadores</span>
                <span className="club-chevron">›</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PaginaInicio() {
  const [modo, setModo] = useState<Modo>('nombre')
  const [input, setInput] = useState('')
  const [resultados, setResultados] = useState<Jugador[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setLoading(true)
    setError(false)
    try {
      const term = modo === 'rut' ? normalizeRut(q) : q
      const data = await buscarJugador(term)
      setResultados(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pagina">
      <div className="hero-header">
        <img src={logoLiga} alt="Liga Rural" className="hero-logo" />
        <div>
          <h2 className="hero-title">Liga Rural Buscador</h2>
          <p className="hero-sub">Consulta de jugadores · Edición 2025</p>
        </div>
      </div>

      <form className="search-form" onSubmit={handleBuscar}>
        <div className="modo-tabs">
          <button
            type="button"
            className={`modo-tab${modo === 'nombre' ? ' active' : ''}`}
            onClick={() => { setModo('nombre'); setInput(''); setResultados(null) }}
          >
            Por nombre
          </button>
          <button
            type="button"
            className={`modo-tab${modo === 'rut' ? ' active' : ''}`}
            onClick={() => { setModo('rut'); setInput(''); setResultados(null) }}
          >
            Por RUT
          </button>
        </div>

        <div className="input-row">
          <input
            className="search-input"
            type="text"
            placeholder={modo === 'nombre' ? 'Ej: Juan Pérez' : 'Ej: 12.345.678-9'}
            value={input}
            onChange={e => setInput(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <button className="search-btn" type="submit" disabled={loading}>
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p className="msg-error">Error al conectar con el servidor.</p>}

      {resultados !== null && !loading && !error && (
        <div className="resultados">
          {resultados.length === 0 ? (
            <p className="msg-vacio">No se encontraron jugadores.</p>
          ) : (
            resultados.map(j => (
              <div className="card" key={j.id}>
                <p className="card-texto">
                  <span className="card-nombre">{j.nombre}</span>{' '}
                  jugó en{' '}
                  <span className="card-equipo">{j.equipo}</span>{' '}
                  en la Liga Rural Edición 2025
                </p>
                <p className="card-rut">{j.rutOriginal}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Sección Acerca ───────────────────────────────────────────────────────────
function PaginaAcerca() {
  return (
    <div className="pagina">
      <h2 className="section-title">Acerca</h2>
      <p className="section-text">
        Sistema de consulta de jugadores inscritos en la <strong>Liga Rural de Fútbol</strong>, Edición 2025.
        Permite buscar participantes por nombre o RUT y verificar el club en el que jugaron durante la temporada.
      </p>
    </div>
  )
}

// ── App principal ────────────────────────────────────────────────────────────
type Pagina = 'inicio' | 'clubes' | 'acerca'

export default function App() {
  const [pagina, setPagina] = useState<Pagina>('inicio')
  const [menuAbierto, setMenuAbierto] = useState(false)

  function navegar(p: Pagina) {
    setPagina(p)
    setMenuAbierto(false)
  }

  return (
    <div className="layout">
      {/* Sidebar desktop / drawer mobile */}
      <nav className={`sidebar${menuAbierto ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img src={logoSmall} alt="Liga Rural" />
          <span>Liga Rural</span>
        </div>
        <ul className="sidebar-nav">
          <li>
            <button
              className={pagina === 'inicio' ? 'active' : ''}
              onClick={() => navegar('inicio')}
            >
              <Search size={16} strokeWidth={2} />
              Buscador
            </button>
          </li>
          <li>
            <button
              className={pagina === 'clubes' ? 'active' : ''}
              onClick={() => navegar('clubes')}
            >
              <Users size={16} strokeWidth={2} />
              Clubes
            </button>
          </li>
          <li>
            <button
              className={pagina === 'acerca' ? 'active' : ''}
              onClick={() => navegar('acerca')}
            >
              <Info size={16} strokeWidth={2} />
              Acerca
            </button>
          </li>
        </ul>
      </nav>

      {/* Overlay mobile */}
      {menuAbierto && (
        <div className="overlay" onClick={() => setMenuAbierto(false)} />
      )}

      {/* Contenido */}
      <div className="content">
        <header className="topbar">
          <button
            className="hamburger"
            onClick={() => setMenuAbierto(v => !v)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuAbierto ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
          <div className="topbar-title">
            <img src={logoSmall} alt="" className="topbar-logo" />
            Liga Rural Buscador
          </div>
        </header>

        <main>
          {pagina === 'inicio' && <PaginaInicio />}
          {pagina === 'clubes' && <PaginaClubes />}
          {pagina === 'acerca' && <PaginaAcerca />}
        </main>
      </div>
    </div>
  )
}

