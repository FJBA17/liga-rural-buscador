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
  // alias cortos
  'Talcarehue':  TalcarehueLogo,
  'Polonia':     PoloniaLogo,
  'Condor':      CondorLogo,
  'Trapiche':    TrapicheLogo,
  'Nilcunlauta': NilcunlautaLogo,
}

export function getClubLogo(nombre: string): string {
  return logos[nombre] ?? ''
}
