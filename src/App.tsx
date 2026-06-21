import { useState, useEffect } from 'react'
import { Menu, X, Search, Users, Info, Trophy, FileText, Home, ClipboardList, MessageCircle } from 'lucide-react'
import logoLiga from './assets/LogoLiga.png'
import logoSmall from './assets/LogoLigaSmall.png'
import { getClubLogo, getClubColor, getClubTextDark } from './clubImages'
import './App.css'

const GQL_URL = import.meta.env.VITE_GRAPHQL_URL as string
const API_URL  = GQL_URL.replace('/graphql', '')

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Jugador {
  id: string
  nombre: string
  rutOriginal: string
  equipo: string
}

interface Jugador2026 {
  id: string
  nombre: string
  rut: string
  club: string
  jornadasTotal: number
  jornadasPV: number
  jornadasSV: number
}

interface Jornada {
  id: string
  numero: number
  fecha: string
  esSegundaVuelta: boolean
  estado: string
}

interface PartidoSimple {
  id: string
  clubLocal:     { id: string; nombre: string } | null
  clubVisitante: { id: string; nombre: string } | null
  estado: string
}

type Modo   = 'nombre' | 'rut'
type Pagina = 'home' | 'inicio' | 'clubes' | 'buscador2026' | 'versus' | 'resultados' | 'acerca'

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizeRut(raw: string): string {
  let r = raw.replace(/[.,\s]/g, '').toLowerCase()
  if (!r.includes('-') && r.length > 1) r = r.slice(0, -1) + '-' + r.slice(-1)
  return r
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  return json.data as T
}

// ── Queries ──────────────────────────────────────────────────────────────────
async function buscarJugador(query: string): Promise<Jugador[]> {
  const data = await gql<{ buscarJugadorLiga2025: Jugador[] }>(
    `query($q:String!){ buscarJugadorLiga2025(query:$q){ id nombre rutOriginal equipo } }`,
    { q: query },
  )
  return data.buscarJugadorLiga2025 ?? []
}

async function obtenerTodos(): Promise<Jugador[]> {
  const data = await gql<{ jugadoresLiga2025: Jugador[] }>(
    `{ jugadoresLiga2025 { id nombre rutOriginal equipo } }`,
  )
  return data.jugadoresLiga2025 ?? []
}

async function buscarJugador2026(query: string): Promise<Jugador2026[]> {
  const data = await gql<{ buscarJugadores2026: Jugador2026[] }>(
    `query($q:String!){ buscarJugadores2026(query:$q){ id nombre rut club jornadasTotal jornadasPV jornadasSV } }`,
    { q: query },
  )
  return data.buscarJugadores2026 ?? []
}

async function cargarJornadas(): Promise<Jornada[]> {
  const data = await gql<{ jornadas: Jornada[] }>(
    `{ jornadas { id numero fecha esSegundaVuelta estado } }`,
  )
  return (data.jornadas ?? []).sort((a, b) => a.numero - b.numero)
}

async function cargarJornadasHabilitadas(): Promise<Jornada[]> {
  const data = await gql<{ jornadasHabilitadas: Jornada[] }>(
    `{ jornadasHabilitadas { id numero fecha esSegundaVuelta estado } }`,
  )
  return (data.jornadasHabilitadas ?? []).sort((a, b) => a.numero - b.numero)
}

async function cargarLigaConfig(): Promise<{ mensajeSuspendidos: string }> {
  const data = await gql<{ ligaConfig: { mensajeSuspendidos: string } }>(
    `{ ligaConfig { mensajeSuspendidos } }`,
  )
  return data.ligaConfig ?? { mensajeSuspendidos: '' }
}

async function cargarPartidosPorJornada(jornadaId: string): Promise<PartidoSimple[]> {
  const data = await gql<{ partidosPorJornada: PartidoSimple[] }>(
    `query($id:ID!){ partidosPorJornada(jornadaId:$id){ id estado
      clubLocal { id nombre } clubVisitante { id nombre } } }`,
    { id: jornadaId },
  )
  return data.partidosPorJornada ?? []
}

// ── Constantes de series ─────────────────────────────────────────────────────
const SERIES = ['TERCERA', 'SEGUNDA', 'SENIOR', 'PRIMERA'] as const
type SerieKey = typeof SERIES[number]

const SERIE_LABEL: Record<SerieKey, string> = {
  TERCERA: 'Tercera', SEGUNDA: 'Segunda', SENIOR: 'Sénior', PRIMERA: 'Primera',
}
const PTS_VICTORIA: Record<SerieKey, number> = {
  TERCERA: 3, SEGUNDA: 3, SENIOR: 3, PRIMERA: 4,
}
const PTS_EMPATE: Record<SerieKey, number> = {
  TERCERA: 1, SEGUNDA: 1, SENIOR: 1, PRIMERA: 2,
}

interface ResultadoExistente {
  id: string
  tipoSerie: SerieKey
  golesLocal: number
  golesVisitante: number
  esSecretariado: boolean
}

type ScoreInput = { local: string; visitante: string }

async function cargarResultadosPorPartido(partidoId: string): Promise<ResultadoExistente[]> {
  const data = await gql<{ resultadosPorPartido: ResultadoExistente[] }>(
    `query($id:ID!){ resultadosPorPartido(partidoId:$id){ id tipoSerie golesLocal golesVisitante esSecretariado } }`,
    { id: partidoId },
  )
  return data.resultadosPorPartido ?? []
}

function agruparPorEquipo(jugadores: Jugador[]): Record<string, Jugador[]> {
  return jugadores.reduce<Record<string, Jugador[]>>((acc, j) => {
    if (!acc[j.equipo]) acc[j.equipo] = []
    acc[j.equipo].push(j)
    return acc
  }, {})
}

// ── Página Clubes (2025) ─────────────────────────────────────────────────────
function PaginaClubes() {
  const [todos, setTodos]                     = useState<Jugador[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(false)
  const [filtroClub, setFiltroClub]           = useState('')
  const [clubSeleccionado, setClubSeleccionado] = useState<string | null>(null)
  const [filtroJugador, setFiltroJugador]     = useState('')

  useEffect(() => {
    obtenerTodos()
      .then(data => { setTodos(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const grupos  = agruparPorEquipo(todos)
  const equipos = Object.keys(grupos).sort()

  if (clubSeleccionado) {
    const lista = (grupos[clubSeleccionado] ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
    const filtrados = filtroJugador.trim()
      ? lista.filter(j =>
          j.nombre.toLowerCase().includes(filtroJugador.toLowerCase()) ||
          j.rutOriginal.replace(/[.\s]/g, '').includes(filtroJugador.replace(/[.\s]/g, '')))
      : lista
    return (
      <div className="pagina">
        <button className="back-btn" onClick={() => { setClubSeleccionado(null); setFiltroJugador('') }}>
          ← Volver a clubes
        </button>
        <div className="club-detalle-header">
          <h2 className="club-detalle-nombre">{clubSeleccionado}</h2>
          <span className="club-count">{lista.length} jugadores</span>
        </div>
        <input className="search-input club-filter" type="text" placeholder="Buscar jugador..."
          value={filtroJugador} onChange={e => setFiltroJugador(e.target.value)} autoComplete="off" autoFocus />
        <ul className="club-jugadores club-jugadores-detalle">
          {filtrados.length === 0
            ? <li className="msg-vacio" style={{ padding: '12px 16px' }}>No se encontraron jugadores.</li>
            : filtrados.map(j => (
                <li key={j.id} className="club-jugador">
                  <span className="cj-nombre">{j.nombre}</span>
                  <span className="cj-rut">{j.rutOriginal}</span>
                </li>
              ))}
        </ul>
      </div>
    )
  }

  const equiposFiltrados = filtroClub.trim()
    ? equipos.filter(e => e.toLowerCase().includes(filtroClub.toLowerCase()))
    : equipos

  return (
    <div className="pagina">
      <h2 className="section-title">Clubes · Edición 2025</h2>
      <input className="search-input club-filter" type="text" placeholder="Buscar club..."
        value={filtroClub} onChange={e => setFiltroClub(e.target.value)} autoComplete="off" />
      {loading && <p className="msg-vacio">Cargando...</p>}
      {error   && <p className="msg-error">Error al cargar los datos.</p>}
      {!loading && !error && (
        <div className="clubes-lista">
          {equiposFiltrados.length === 0
            ? <p className="msg-vacio">No se encontraron clubes.</p>
            : equiposFiltrados.map(equipo => (
                <button key={equipo} className="club-card club-card-btn" onClick={() => setClubSeleccionado(equipo)}>
                  <span className="club-nombre">{equipo}</span>
                  <span className="club-count">{grupos[equipo].length} jugadores</span>
                  <span className="club-chevron">›</span>
                </button>
              ))}
        </div>
      )}
    </div>
  )
}

// ── Página Buscador 2025 ─────────────────────────────────────────────────────
function PaginaInicio() {
  const [modo, setModo]           = useState<Modo>('nombre')
  const [input, setInput]         = useState('')
  const [resultados, setResultados] = useState<Jugador[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(false)

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setLoading(true); setError(false)
    try {
      const term = modo === 'rut' ? normalizeRut(q) : q
      setResultados(await buscarJugador(term))
    } catch { setError(true) }
    finally { setLoading(false) }
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
          <button type="button" className={`modo-tab${modo === 'nombre' ? ' active' : ''}`}
            onClick={() => { setModo('nombre'); setInput(''); setResultados(null) }}>Por nombre</button>
          <button type="button" className={`modo-tab${modo === 'rut' ? ' active' : ''}`}
            onClick={() => { setModo('rut'); setInput(''); setResultados(null) }}>Por RUT</button>
        </div>
        <div className="input-row">
          <input className="search-input" type="text"
            placeholder={modo === 'nombre' ? 'Ej: Juan Pérez' : 'Ej: 12.345.678-9'}
            value={input} onChange={e => setInput(e.target.value)} autoComplete="off" autoFocus />
          <button className="search-btn" type="submit" disabled={loading}>
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
      </form>
      {error && <p className="msg-error">Error al conectar con el servidor.</p>}
      {resultados !== null && !loading && !error && (
        <div className="resultados">
          {resultados.length === 0
            ? <p className="msg-vacio">No se encontraron jugadores.</p>
            : resultados.map(j => (
                <div className="card" key={j.id}>
                  <p className="card-texto">
                    <span className="card-nombre">{j.nombre}</span>{' '}
                    jugó en <span className="card-equipo">{j.equipo}</span> en la Liga Rural Edición 2025
                  </p>
                  <p className="card-rut">{j.rutOriginal}</p>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

// ── Página Buscador 2026 ─────────────────────────────────────────────────────
function PaginaBuscador2026() {
  const [modo, setModo]             = useState<Modo>('nombre')
  const [input, setInput]           = useState('')
  const [resultados, setResultados] = useState<Jugador2026[] | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(false)

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setLoading(true); setError(false)
    try {
      const term = modo === 'rut' ? normalizeRut(q) : q
      setResultados(await buscarJugador2026(term))
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  return (
    <div className="pagina">
      <div className="hero-header">
        <img src={logoLiga} alt="Liga Rural" className="hero-logo" />
        <div>
          <h2 className="hero-title">Liga Rural 2026</h2>
          <p className="hero-sub">Consulta de jugadores · Temporada actual</p>
        </div>
      </div>

      <form className="search-form" onSubmit={handleBuscar}>
        <div className="modo-tabs">
          <button type="button" className={`modo-tab${modo === 'nombre' ? ' active' : ''}`}
            onClick={() => { setModo('nombre'); setInput(''); setResultados(null) }}>Por nombre</button>
          <button type="button" className={`modo-tab${modo === 'rut' ? ' active' : ''}`}
            onClick={() => { setModo('rut'); setInput(''); setResultados(null) }}>Por RUT</button>
        </div>
        <div className="input-row">
          <input className="search-input" type="text"
            placeholder={modo === 'nombre' ? 'Ej: Juan Pérez' : 'Ej: 12.345.678-9'}
            value={input} onChange={e => setInput(e.target.value)} autoComplete="off" autoFocus />
          <button className="search-btn" type="submit" disabled={loading}>
            {loading ? '…' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p className="msg-error">Error al conectar con el servidor.</p>}

      {resultados !== null && !loading && !error && (
        <div className="resultados">
          {resultados.length === 0
            ? <p className="msg-vacio">No se encontraron jugadores en la temporada 2026.</p>
            : resultados.map(j => {
                const color    = getClubColor(j.club)
                const logo     = getClubLogo(j.club)
                const textDark = getClubTextDark(j.club)
                return (
                  <div className="card card-2026" key={j.id}
                    style={{ '--club-color': color, '--club-text': textDark ? '#111' : '#fff', '--club-muted': textDark ? '#444' : 'rgba(255,255,255,0.7)' } as React.CSSProperties}>
                    <div className="card-2026-body">
                      <div className="card-2026-info">
                        <p className="card-nombre">{j.nombre}</p>
                        <p className="card-rut">{j.rut}</p>
                      </div>
                    </div>
                    {logo && <img src={logo} alt={j.club} className="card-2026-escudo" />}
                    <div className="jornadas-strip">
                      <span className="badge badge-pv">1ª Vuelta: {j.jornadasPV}</span>
                      <span className="badge badge-sv">2ª Vuelta: {j.jornadasSV}</span>
                      <span className="badge badge-total">Total: {j.jornadasTotal}</span>
                    </div>
                  </div>
                )
              })}
        </div>
      )}
    </div>
  )
}

// ── Pick Logo (logo grande centrado para la selección de partido) ─────────────
function PickLogo({ nombre }: { nombre?: string | null }) {
  const logo = getClubLogo(nombre ?? '')
  return logo
    ? <img src={logo} alt={nombre ?? ''} className="pick-logo" />
    : <div className="pick-logo pick-logo-placeholder" />
}

// ── Club Cell (logo + nombre inline para headers) ─────────────────────────────

// ── Bottom Sheet ─────────────────────────────────────────────────────────────
interface BottomSheetProps {
  open: boolean
  titulo: string
  onClose: () => void
  children: React.ReactNode
}

function BottomSheet({ open, titulo, onClose, children }: BottomSheetProps) {
  return (
    <>
      <div className={`bs-overlay${open ? ' bs-open' : ''}`} onClick={onClose} />
      <div className={`bs-panel${open ? ' bs-open' : ''}`}>
        <div className="bs-handle" />
        <div className="bs-header">
          <span className="bs-titulo">{titulo}</span>
          <button className="bs-close" onClick={onClose}><X size={20} strokeWidth={2} /></button>
        </div>
        <div className="bs-body">{children}</div>
      </div>
    </>
  )
}

// ── Página Versus PDF ────────────────────────────────────────────────────────
function PaginaVersus() {
  const [jornadas, setJornadas]         = useState<Jornada[]>([])
  const [jornadaId, setJornadaId]       = useState('')
  const [partidos, setPartidos]         = useState<PartidoSimple[]>([])
  const [partidoId, setPartidoId]       = useState('')
  const [loadingJ, setLoadingJ]         = useState(true)
  const [loadingP, setLoadingP]         = useState(false)
  const [errorJ, setErrorJ]             = useState(false)
  const [sheetAbierto, setSheetAbierto] = useState(false)

  useEffect(() => {
    cargarJornadas()
      .then(data => { setJornadas(data); setLoadingJ(false) })
      .catch(() => { setErrorJ(true); setLoadingJ(false) })
  }, [])

  useEffect(() => {
    if (!jornadaId) { setPartidos([]); setPartidoId(''); return }
    setLoadingP(true); setPartidoId('')
    cargarPartidosPorJornada(jornadaId)
      .then(data => { setPartidos(data); setLoadingP(false) })
      .catch(() => setLoadingP(false))
  }, [jornadaId])

  const [descargando, setDescargando] = useState('')   // partidoId descargándose

  const jornada = jornadas.find(j => j.id === jornadaId)

  function etiquetaJornada(j: Jornada) {
    const fecha  = new Date(j.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
    const vuelta = j.esSegundaVuelta ? '2ª Vuelta' : '1ª Vuelta'
    return `Jornada ${j.numero} · ${vuelta} · ${fecha}`
  }

  function seleccionarJornada(id: string) {
    setJornadaId(id)
    setSheetAbierto(false)
  }

  function togglePartido(id: string) {
    setPartidoId(prev => prev === id ? '' : id)
  }

  async function descargarPDF(p: PartidoSimple) {
    if (!jornada) return
    setDescargando(p.id)
    try {
      const res  = await fetch(`${API_URL}/reportes/versus/${p.id}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const local     = p.clubLocal?.nombre     ?? 'Local'
      const visitante = p.clubVisitante?.nombre ?? 'Visitante'
      const nombre = `${local} vs ${visitante} - Jornada ${jornada.numero}.pdf`
      const a = document.createElement('a')
      a.href = url; a.download = nombre
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silencioso */ }
    finally { setDescargando('') }
  }

  return (
    <div className="pagina">
      <div className="versus-header">
        <FileText size={28} strokeWidth={1.5} className="versus-icon" />
        <div>
          <h2 className="hero-title">Reportes de Partidos</h2>
          <p className="hero-sub">Descarga el PDF de un partido</p>
        </div>
      </div>

      {/* Selector de Jornada → Bottom Sheet */}
      <div className="selector-group">
        <label className="selector-label">Jornada</label>
        {loadingJ && <p className="msg-vacio">Cargando jornadas…</p>}
        {errorJ   && <p className="msg-error">Error al cargar jornadas.</p>}
        {!loadingJ && !errorJ && (
          <button
            className={`jornada-trigger${jornadaId ? ' selected' : ''}`}
            onClick={() => setSheetAbierto(true)}
          >
            <span>{jornada ? etiquetaJornada(jornada) : 'Selecciona una jornada'}</span>
            <span className="jornada-trigger-chevron">›</span>
          </button>
        )}
      </div>

      {/* Bottom Sheet de Jornadas */}
      <BottomSheet
        open={sheetAbierto}
        titulo="Selecciona una jornada"
        onClose={() => setSheetAbierto(false)}
      >
        {jornadas.map(j => (
          <button
            key={j.id}
            className={`bs-item${jornadaId === j.id ? ' bs-item-selected' : ''}`}
            onClick={() => seleccionarJornada(j.id)}
          >
            <div className="bs-item-vuelta">{j.esSegundaVuelta ? '2ª Vuelta' : '1ª Vuelta'}</div>
            <div className="bs-item-info">
              <span className="bs-item-num">Jornada {j.numero}</span>
              <span className="bs-item-fecha">
                {new Date(j.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
            </div>
            {jornadaId === j.id && <span className="bs-item-check">✓</span>}
          </button>
        ))}
      </BottomSheet>

      {/* Selector de Partido — acordeón */}
      {jornadaId && (
        <div className="selector-group">
          <label className="selector-label">
            Partido{jornada ? ` · J${jornada.numero}` : ''}
          </label>
          {loadingP && <p className="msg-vacio">Cargando partidos…</p>}
          {!loadingP && partidos.length === 0 && (
            <p className="msg-vacio">No hay partidos para esta jornada.</p>
          )}
          {!loadingP && partidos.length > 0 && (
            <div className="pick-partido-lista">
              {partidos.map(p => {
                const abierto = partidoId === p.id
                return (
                  <div key={p.id} className={`pick-partido-card${abierto ? ' pick-selected' : ''}`}>
                    <div className="pick-card-header" onClick={() => togglePartido(p.id)}>
                      <div className="pick-club">
                        <PickLogo nombre={p.clubLocal?.nombre} />
                        <span className="pick-nombre">{p.clubLocal?.nombre ?? '?'}</span>
                      </div>
                      <span className="pick-vs">vs</span>
                      <div className="pick-club">
                        <PickLogo nombre={p.clubVisitante?.nombre} />
                        <span className="pick-nombre">{p.clubVisitante?.nombre ?? '?'}</span>
                      </div>
                    </div>
                    {abierto && (
                      <div className="pick-accordion">
                        <button
                          className="pdf-download-btn"
                          onClick={() => descargarPDF(p)}
                          disabled={descargando === p.id}
                        >
                          <FileText size={18} strokeWidth={2} />
                          {descargando === p.id ? 'Descargando…' : 'Descargar PDF'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página Resultados ─────────────────────────────────────────────────────────
type PasoResultados = 1 | 2 | 3

function PaginaResultados() {
  const [paso, setPaso]             = useState<PasoResultados>(1)
  const [jornadas, setJornadas]     = useState<Jornada[]>([])
  const [jornadaId, setJornadaId]   = useState('')
  const [loadingJ, setLoadingJ]     = useState(true)

  const [partidos, setPartidos]     = useState<PartidoSimple[]>([])
  const [loadingP, setLoadingP]     = useState(false)
  const [partidoId, setPartidoId]   = useState('')

  const [existentes, setExistentes] = useState<ResultadoExistente[]>([])
  const [loadingR, setLoadingR]     = useState(false)

  const [scores, setScores]         = useState<Record<SerieKey, ScoreInput>>(
    Object.fromEntries(SERIES.map(s => [s, { local: '', visitante: '' }])) as Record<SerieKey, ScoreInput>
  )
  const [enviando, setEnviando]     = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  useEffect(() => {
    cargarJornadasHabilitadas()
      .then(d => { setJornadas(d); setLoadingJ(false) })
      .catch(() => setLoadingJ(false))
  }, [])

  function elegirJornada(id: string) {
    setJornadaId(id); setPaso(2)
    setPartidoId(''); setExistentes([]); resetScores()
    setLoadingP(true)
    cargarPartidosPorJornada(id)
      .then(d => { setPartidos(d); setLoadingP(false) })
      .catch(() => setLoadingP(false))
  }

  async function elegirPartido(id: string) {
    setPartidoId(id); setPaso(3)
    setLoadingR(true); resetScores()
    const rs = await cargarResultadosPorPartido(id)
    setExistentes(rs)
    if (rs.length > 0) {
      const next = { ...scores }
      SERIES.forEach(s => {
        const ex = rs.find(r => r.tipoSerie === s)
        next[s] = ex ? { local: String(ex.golesLocal), visitante: String(ex.golesVisitante) } : { local: '', visitante: '' }
      })
      setScores(next)
    }
    setLoadingR(false)
  }

  function resetScores() {
    setScores(Object.fromEntries(SERIES.map(s => [s, { local: '', visitante: '' }])) as Record<SerieKey, ScoreInput>)
  }

  function updateScore(serie: SerieKey, campo: 'local' | 'visitante', val: string) {
    const v = val.replace(/\D/g, '').slice(0, 2)
    setScores(prev => ({ ...prev, [serie]: { ...prev[serie], [campo]: v } }))
  }

  async function enviarResultados() {
    setEnviando(true); setErrorEnvio('')
    try {
      for (const serie of SERIES) {
        const s = scores[serie]
        if (!s || s.local === '' || s.visitante === '') continue
        await gql(
          `mutation($i:CargarResultadoInput!){ cargarResultado(input:$i){ id } }`,
          { i: { partidoId, tipoSerie: serie, golesLocal: +s.local, golesVisitante: +s.visitante } },
        )
      }
      const rs = await cargarResultadosPorPartido(partidoId)
      setExistentes(rs)
    } catch {
      setErrorEnvio('Error al enviar. Revisa la conexión e intenta de nuevo.')
    } finally { setEnviando(false) }
  }

  const jornada        = jornadas.find(j => j.id === jornadaId)
  const partido        = partidos.find(p => p.id === partidoId)
  const tieneResultados = existentes.length > 0

  function generarTextoWsp(): string {
    if (!jornada || !partido) return ''
    const local     = partido.clubLocal?.nombre     ?? 'Local'
    const visitante = partido.clubVisitante?.nombre ?? 'Visitante'
    const lineas    = [`*Jornada ${jornada.numero}*\n`, `*${local} vs ${visitante}*`]
    let pL = 0, pV = 0
    for (const serie of SERIES) {
      const r = existentes.find(x => x.tipoSerie === serie)
      if (!r) continue
      const ptV = PTS_VICTORIA[serie], ptE = PTS_EMPATE[serie]
      if      (r.golesLocal > r.golesVisitante)  { pL += ptV }
      else if (r.golesVisitante > r.golesLocal)   { pV += ptV }
      else                                         { pL += ptE; pV += ptE }
      lineas.push(`${SERIE_LABEL[serie]}: ${r.golesLocal}-${r.golesVisitante}`)
    }
    lineas.push(`\n*${local} ${pL}pts*\n*${visitante} ${pV}pts*`)
    return lineas.join('\n')
  }

  // ── Paso 1: Grid de jornadas ─────────────────────────────────────────────
  if (paso === 1) return (
    <div className="pagina">
      <div className="versus-header">
        <ClipboardList size={28} strokeWidth={1.5} className="versus-icon" />
        <div>
          <h2 className="hero-title">Resultados</h2>
          <p className="hero-sub">¿En qué jornada jugaste?</p>
        </div>
      </div>
      {loadingJ && <p className="msg-vacio">Cargando jornadas…</p>}
      {!loadingJ && (
        <div className="jornadas-grid">
          {jornadas.map(j => (
            <button key={j.id} className="jornada-grid-btn" onClick={() => elegirJornada(j.id)}>
              <span className="jgb-vuelta">{j.esSegundaVuelta ? '2V' : '1V'}</span>
              <span className="jgb-num">J{j.numero}</span>
              <span className="jgb-fecha">
                {new Date(j.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── Paso 2: Selección de partido ────────────────────────────────────────
  if (paso === 2) return (
    <div className="pagina">
      <button className="back-btn" onClick={() => setPaso(1)}>← Volver</button>
      <div className="versus-header">
        <ClipboardList size={28} strokeWidth={1.5} className="versus-icon" />
        <div>
          <h2 className="hero-title">Jornada {jornada?.numero}</h2>
          <p className="hero-sub">¿Cuál es tu partido?</p>
        </div>
      </div>
      {loadingP && <p className="msg-vacio">Cargando partidos…</p>}
      {!loadingP && (
        <div className="pick-partido-lista">
          {partidos.map(p => (
            <button key={p.id} className="pick-partido-card" onClick={() => elegirPartido(p.id)}>
              <div className="pick-card-header" style={{ pointerEvents: 'none' }}>
                <div className="pick-club">
                  <PickLogo nombre={p.clubLocal?.nombre} />
                  <span className="pick-nombre">{p.clubLocal?.nombre ?? '?'}</span>
                </div>
                <span className="pick-vs">vs</span>
                <div className="pick-club">
                  <PickLogo nombre={p.clubVisitante?.nombre} />
                  <span className="pick-nombre">{p.clubVisitante?.nombre ?? '?'}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── Paso 3: Formulario de resultados ────────────────────────────────────
  const totales = SERIES.reduce((acc, serie) => {
    const s = scores[serie]
    if (!s || s.local === '' || s.visitante === '') return acc
    const gl = +s.local, gv = +s.visitante
    const ptV = PTS_VICTORIA[serie], ptE = PTS_EMPATE[serie]
    if      (gl > gv) { acc.local += ptV }
    else if (gv > gl) { acc.visitante += ptV }
    else              { acc.local += ptE; acc.visitante += ptE }
    return acc
  }, { local: 0, visitante: 0 })

  const hayAlgunScore = SERIES.some(s => scores[s]?.local !== '' && scores[s]?.visitante !== '')

  return (
    <div className="pagina">
      <button className="back-btn" onClick={() => { setPaso(2); setExistentes([]) }}>← Volver</button>

      {/* Header con logos + totales */}
      <div className="partido-res-card" style={{ marginBottom: 16 }}>
        <div className="pick-partido-header">
          <div className="pick-club">
            <PickLogo nombre={partido?.clubLocal?.nombre} />
            <span className="pick-nombre">{partido?.clubLocal?.nombre ?? '?'}</span>
          </div>
          <span className="pick-vs">vs</span>
          <div className="pick-club">
            <PickLogo nombre={partido?.clubVisitante?.nombre} />
            <span className="pick-nombre">{partido?.clubVisitante?.nombre ?? '?'}</span>
          </div>
        </div>

        {/* Totales de puntos */}
        <div className="pts-banner">
          <span className={`pts-num${totales.local > totales.visitante ? ' pts-winner' : ''}`}>
            {totales.local}
          </span>
          <span className="pts-banner-label">
            {hayAlgunScore ? 'puntos' : `J${jornada?.numero} · ${jornada?.esSegundaVuelta ? '2ª Vuelta' : '1ª Vuelta'}`}
          </span>
          <span className={`pts-num${totales.visitante > totales.local ? ' pts-winner' : ''}`}>
            {totales.visitante}
          </span>
        </div>
      </div>

      {loadingR && <p className="msg-vacio">Verificando resultados…</p>}

      {!loadingR && (
        <>
          {tieneResultados && (
            <div className="res-aviso">✓ Resultado ya registrado</div>
          )}

          <div className="partido-res-card">
            <div className="series-tabla">
              {SERIES.map(serie => {
                const s = scores[serie]
                const gl = s.local !== '' ? +s.local : null
                const gv = s.visitante !== '' ? +s.visitante : null
                const ambos = gl !== null && gv !== null
                const ptV = PTS_VICTORIA[serie], ptE = PTS_EMPATE[serie]
                const loc = partido?.clubLocal?.nombre?.split(' ')[0] ?? 'Local'
                const vis = partido?.clubVisitante?.nombre?.split(' ')[0] ?? 'Visit.'
                const preview = ambos
                  ? (gl! > gv! ? `${loc} +${ptV}` : gv! > gl! ? `${vis} +${ptV}` : `+${ptE} c/u`)
                  : ''
                return (
                  <div key={serie} className="serie-fila">
                    <span className="serie-nombre">{SERIE_LABEL[serie]}</span>
                    <div className="score-group">
                      <input className="score-input" inputMode="numeric"
                        value={s.local} placeholder="–" disabled={tieneResultados}
                        onChange={e => updateScore(serie, 'local', e.target.value)} />
                      <span className="score-sep">:</span>
                      <input className="score-input" inputMode="numeric"
                        value={s.visitante} placeholder="–" disabled={tieneResultados}
                        onChange={e => updateScore(serie, 'visitante', e.target.value)} />
                    </div>
                    <span className="serie-pts-preview">{preview}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {errorEnvio && <p className="msg-error" style={{ marginTop: 12 }}>{errorEnvio}</p>}

          <div className="res-acciones">
            {!tieneResultados && (
              <button className="search-btn res-enviar-btn" onClick={enviarResultados} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar resultados'}
              </button>
            )}
            {tieneResultados && (
              <button className="wsp-btn"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(generarTextoWsp())}`, '_blank')}>
                <MessageCircle size={18} strokeWidth={2} />
                Enviar resumen por WhatsApp
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Página Home ──────────────────────────────────────────────────────────────
interface AccesoItem {
  id: Pagina
  icon: React.ReactNode
  label: string
  desc: string
  accent: string
}

function PaginaHome({ onNavegar }: { onNavegar: (p: Pagina) => void }) {
  const [mensajeSusp, setMensajeSusp] = useState('')
  const [descargandoSusp, setDescargandoSusp] = useState(false)

  useEffect(() => {
    cargarLigaConfig().then(c => setMensajeSusp(c.mensajeSuspendidos)).catch(() => {})
  }, [])

  async function descargarSuspendidos() {
    setDescargandoSusp(true)
    try {
      const res  = await fetch(`${API_URL}/reportes/jugadores-suspendidos`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'Suspendidos.pdf'
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silencioso */ }
    finally { setDescargandoSusp(false) }
  }

  const accesos: AccesoItem[] = [
    {
      id: 'buscador2026',
      icon: <Trophy size={28} strokeWidth={1.5} />,
      label: 'Buscador 2026',
      desc: 'Busca jugadores de la temporada actual con jornadas por vuelta',
      accent: '#c71585',
    },
    {
      id: 'versus',
      icon: <FileText size={28} strokeWidth={1.5} />,
      label: 'Reportes de Partidos',
      desc: 'Descarga el PDF de enfrentamiento de cualquier partido',
      accent: '#9b59b6',
    },
    {
      id: 'inicio',
      icon: <Search size={28} strokeWidth={1.5} />,
      label: 'Buscador 2025',
      desc: 'Consulta jugadores inscritos en la edición anterior',
      accent: '#2980b9',
    },
    {
      id: 'clubes',
      icon: <Users size={28} strokeWidth={1.5} />,
      label: 'Clubes',
      desc: 'Listado de equipos y sus jugadores (2025)',
      accent: '#27ae60',
    },
  ]

  return (
    <div className="pagina home-pagina">
      <div className="home-header">
        <img src={logoLiga} alt="Liga Rural" className="home-logo" />
        <div>
          <h1 className="home-titulo">Liga Rural Delegados</h1>
          <p className="home-sub">Selecciona una sección para comenzar</p>
        </div>
      </div>

      <div className="accesos-grid">
        {accesos.map(item => (
          <button
            key={item.id}
            className="acceso-card"
            style={{ '--acceso-color': item.accent } as React.CSSProperties}
            onClick={() => onNavegar(item.id)}
          >
            <span className="acceso-icon">{item.icon}</span>
            <p className="acceso-label">{item.label}</p>
            <p className="acceso-desc">{item.desc}</p>
          </button>
        ))}
      </div>

      <button
        className="acceso-card acceso-card-full"
        style={{ '--acceso-color': '#e67e22' } as React.CSSProperties}
        onClick={() => onNavegar('resultados')}
      >
        <span className="acceso-icon"><ClipboardList size={28} strokeWidth={1.5} /></span>
        <div>
          <p className="acceso-label">Ingresar Resultados</p>
          <p className="acceso-desc">Carga los marcadores de la jornada y envía resumen por WhatsApp</p>
        </div>
      </button>

      <button
        className="acceso-card acceso-card-full acceso-card-susp"
        style={{ '--acceso-color': '#e74c3c' } as React.CSSProperties}
        onClick={descargarSuspendidos}
        disabled={descargandoSusp}
      >
        <span className="acceso-icon"><FileText size={28} strokeWidth={1.5} /></span>
        <div className="acceso-susp-body">
          <p className="acceso-label">{descargandoSusp ? 'Descargando…' : 'Descargar Jugadores Suspendidos'}</p>
          <p className="acceso-susp-msg">{mensajeSusp || 'Lista oficial de suspensiones activas'}</p>
        </div>
        <span className="acceso-pdf-badge">PDF</span>
      </button>
    </div>
  )
}

// ── Página Acerca ────────────────────────────────────────────────────────────
function PaginaAcerca() {
  return (
    <div className="pagina">
      <h2 className="section-title">Acerca</h2>
      <p className="section-text">
        Sistema de consulta de jugadores inscritos en la <strong>Liga Rural de Fútbol</strong>.
        Permite buscar participantes por nombre o RUT, verificar inscripciones de la Edición 2025
        y la temporada actual 2026, consultar clubes y descargar reportes PDF de partidos.
      </p>
    </div>
  )
}

// ── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [pagina, setPagina]           = useState<Pagina>('home')
  const [menuAbierto, setMenuAbierto] = useState(false)

  function navegar(p: Pagina) { setPagina(p); setMenuAbierto(false) }

  const navItems: { id: Pagina; label: string; icon: React.ReactNode }[] = [
    { id: 'home',         label: 'Inicio',             icon: <Home          size={16} strokeWidth={2} /> },
    { id: 'resultados',   label: 'Resultados',          icon: <ClipboardList size={16} strokeWidth={2} /> },
    { id: 'buscador2026', label: 'Buscador 2026',       icon: <Trophy        size={16} strokeWidth={2} /> },
    { id: 'versus',       label: 'Reportes',             icon: <FileText      size={16} strokeWidth={2} /> },
    { id: 'inicio',       label: 'Buscador 2025',       icon: <Search        size={16} strokeWidth={2} /> },
    { id: 'clubes',       label: 'Clubes',               icon: <Users         size={16} strokeWidth={2} /> },
    { id: 'acerca',       label: 'Acerca',               icon: <Info          size={16} strokeWidth={2} /> },
  ]

  return (
    <div className="layout">
      <nav className={`sidebar${menuAbierto ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img src={logoSmall} alt="Liga Rural" />
          <span>Delegados</span>
        </div>
        <ul className="sidebar-nav">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                className={pagina === item.id ? 'active' : ''}
                onClick={() => navegar(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {menuAbierto && <div className="overlay" onClick={() => setMenuAbierto(false)} />}

      <div className="content">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuAbierto(v => !v)}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}>
            {menuAbierto ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
          <div className="topbar-title">
            <img src={logoSmall} alt="" className="topbar-logo" />
            Liga Rural Delegados
          </div>
        </header>

        <main>
          {pagina === 'home'         && <PaginaHome onNavegar={navegar} />}
          {pagina === 'resultados'   && <PaginaResultados />}
          {pagina === 'inicio'       && <PaginaInicio />}
          {pagina === 'clubes'       && <PaginaClubes />}
          {pagina === 'buscador2026' && <PaginaBuscador2026 />}
          {pagina === 'versus'       && <PaginaVersus />}
          {pagina === 'acerca'       && <PaginaAcerca />}
        </main>
      </div>
    </div>
  )
}
