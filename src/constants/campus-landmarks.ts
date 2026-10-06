import type { Coordinates } from '@/types'

export interface CampusLandmark {
  id: string
  name: string
  shortName: string
  category: 'tasued' | 'ijebu_central' | 'hostel'
  address: string
  landmarkNote: string
  coords: Coordinates
  icon: string
}

export const CAMPUS_LANDMARKS: CampusLandmark[] = [
  {
    id: 'tasued_main_gate',
    name: '🎓 TASUED Main Campus Gate',
    shortName: 'Main Gate',
    category: 'tasued',
    address: 'Tai Solarin University of Education Main Gate, Ijagun, Ijebu-Ode',
    landmarkNote: 'Security Post & ATM Gallery',
    coords: { latitude: 6.8042, longitude: 3.8863 },
    icon: '🎓',
  },
  {
    id: 'tasued_cepep_annex',
    name: '📚 CEPEP Annex & Lecture Halls',
    shortName: 'CEPEP Annex',
    category: 'tasued',
    address: 'CEPEP Complex, TASUED Campus, Ijagun, Ijebu-Ode',
    landmarkNote: 'Faculty of Science & Lecture Quad',
    coords: { latitude: 6.8065, longitude: 3.8885 },
    icon: '📚',
  },
  {
    id: 'tasued_library',
    name: '📖 University Library Complex',
    shortName: 'Library',
    category: 'tasued',
    address: 'University Library, TASUED Campus, Ijagun, Ijebu-Ode',
    landmarkNote: 'Academic Complex / Quiet Zone',
    coords: { latitude: 6.8055, longitude: 3.8872 },
    icon: '📖',
  },
  {
    id: 'abiola_female_hostels',
    name: '🏢 Abiola Hall & Female Hostels',
    shortName: 'Abiola Hall',
    category: 'hostel',
    address: 'Abiola Hall of Residence, TASUED, Ijagun, Ijebu-Ode',
    landmarkNote: 'Student Residential Quadrangle',
    coords: { latitude: 6.808, longitude: 3.8845 },
    icon: '🏢',
  },
  {
    id: 'ijagun_junction',
    name: '🛵 Ijagun Junction Roundabout',
    shortName: 'Ijagun Junc.',
    category: 'tasued',
    address: 'Ijagun Junction, Benin-Sagamu Expressway Exit, Ijebu-Ode',
    landmarkNote: 'Commercial Hub & Keke Terminal',
    coords: { latitude: 6.8115, longitude: 3.891 },
    icon: '🛵',
  },
  {
    id: 'dipo_dina_stadium',
    name: '🏟️ Dipo Dina International Stadium',
    shortName: 'Stadium',
    category: 'ijebu_central',
    address: 'Otunba Dipo Dina Stadium Road, Ijebu-Ode',
    landmarkNote: 'Stadium Main Entrance',
    coords: { latitude: 6.8197, longitude: 3.9247 },
    icon: '🏟️',
  },
  {
    id: 'awujale_palace',
    name: '👑 Awujale Palace Complex',
    shortName: 'Awujale Palace',
    category: 'ijebu_central',
    address: 'Awujale Palace Complex, Itoro, Ijebu-Ode',
    landmarkNote: 'Itoro Civic Cultural Center',
    coords: { latitude: 6.8215, longitude: 3.9185 },
    icon: '👑',
  },
  {
    id: 'molipa_expressway',
    name: '🛣️ Molipa Expressway Junction',
    shortName: 'Molipa Express',
    category: 'ijebu_central',
    address: 'Molipa Express Junction, Ijebu-Ode',
    landmarkNote: 'Commercial Axis',
    coords: { latitude: 6.8351, longitude: 3.9212 },
    icon: '🛣️',
  },
]
