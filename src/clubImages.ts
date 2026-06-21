import TalcarehueLogo  from './assets/Clubes/Talcarehue.png'
import PoloniaLogo     from './assets/Clubes/Polonia.png'
import LinguesLogo     from './assets/Clubes/San Jose de Los Lingues.png'
import CondorLogo      from './assets/Clubes/Condor de Roma.png'
import SantaElbaLogo   from './assets/Clubes/Santa Elba.png'
import CarlinaLogo     from './assets/Clubes/Carlina.png'
import TrapicheLogo    from './assets/Clubes/Trapiche.png'
import MirafloresLogo  from './assets/Clubes/Miraflores.png'
import NilcunlautaLogo from './assets/Clubes/Nilcunlauta.png'

const logos: Record<string, string> = {
  'Atletico Talcarehue':    TalcarehueLogo,
  'Santa Isabel de Polonia': PoloniaLogo,
  'San Jose de los Lingues': LinguesLogo,
  'Condor de Roma':          CondorLogo,
  'Santa Elba':              SantaElbaLogo,
  'Carlina':                 CarlinaLogo,
  'CD Juventud el Trapiche': TrapicheLogo,
  'Miraflores':              MirafloresLogo,
  'CD Nilcunlauta':          NilcunlautaLogo,
  'Talcarehue':  TalcarehueLogo,
  'Polonia':     PoloniaLogo,
  'Condor':      CondorLogo,
  'Trapiche':    TrapicheLogo,
  'Nilcunlauta': NilcunlautaLogo,
}

const colores: Record<string, string> = {
  'Atletico Talcarehue':    '#0c0b4d',
  'Santa Isabel de Polonia':'#8c0000',
  'San Jose de los Lingues':'#f1c80a',
  'Condor de Roma':         '#6a1b9a',
  'Santa Elba':             '#000000',
  'Carlina':                '#e3e3e3',
  'CD Juventud el Trapiche':'#013088',
  'Miraflores':             '#0c4937',
  'CD Nilcunlauta':         '#457357',
}

// Clubes con color claro que necesitan texto oscuro
const clubesClaro = new Set(['Carlina', 'San Jose de los Lingues'])

export function getClubLogo(nombre: string): string   { return logos[nombre]   ?? '' }
export function getClubColor(nombre: string): string  { return colores[nombre] ?? '#c71585' }
export function getClubTextDark(nombre: string): boolean { return clubesClaro.has(nombre) }
