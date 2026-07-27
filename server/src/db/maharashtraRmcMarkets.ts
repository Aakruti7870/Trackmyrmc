export interface MaharashtraRmcMarketSeed {
  district: string;
  marketName: string;
  locality: string;
  latitude: number;
  longitude: number;
  priority: number;
  industrial?: boolean;
}

/**
 * Maintainable locality-centre catalogue used only as a Places location bias.
 * Coordinates are locality/city centroids curated from the application's existing
 * map usage and OpenStreetMap locality centres. They are not plant coordinates and
 * must never be presented to users as a verified plant location. The 50 km search
 * circle and Google result coordinates remain the discovery source of truth.
 */
export const MAHARASHTRA_RMC_MARKETS: MaharashtraRmcMarketSeed[] = [
  { district: 'Mumbai City', marketName: 'Mumbai City', locality: 'Mumbai City', latitude: 18.9388, longitude: 72.8354, priority: 10 },
  { district: 'Mumbai Suburban', marketName: 'Mumbai Suburban', locality: 'Mumbai Suburban', latitude: 19.1197, longitude: 72.8468, priority: 10 },
  { district: 'Mumbai Suburban', marketName: 'Andheri', locality: 'Andheri', latitude: 19.1136, longitude: 72.8697, priority: 10 },
  { district: 'Mumbai Suburban', marketName: 'Goregaon', locality: 'Goregaon', latitude: 19.1663, longitude: 72.8526, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Malad', locality: 'Malad', latitude: 19.1874, longitude: 72.8484, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Borivali', locality: 'Borivali', latitude: 19.2307, longitude: 72.8567, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Kurla', locality: 'Kurla', latitude: 19.0726, longitude: 72.8845, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Chembur', locality: 'Chembur', latitude: 19.0622, longitude: 72.9005, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Mulund', locality: 'Mulund', latitude: 19.1726, longitude: 72.9425, priority: 12 },
  { district: 'Mumbai Suburban', marketName: 'Bhandup', locality: 'Bhandup', latitude: 19.1439, longitude: 72.9384, priority: 12 },

  { district: 'Raigad', marketName: 'Panvel', locality: 'Panvel', latitude: 18.9894, longitude: 73.1175, priority: 1 },
  { district: 'Raigad', marketName: 'Karanjade', locality: 'Karanjade', latitude: 18.9862, longitude: 73.1085, priority: 1 },
  { district: 'Raigad', marketName: 'Kamothe', locality: 'Kamothe', latitude: 19.0168, longitude: 73.0965, priority: 1 },
  { district: 'Raigad', marketName: 'Kalamboli', locality: 'Kalamboli', latitude: 19.0330, longitude: 73.1012, priority: 1 },
  { district: 'Raigad', marketName: 'Taloja', locality: 'Taloja', latitude: 19.0554, longitude: 73.1220, priority: 1 },
  { district: 'Raigad', marketName: 'Taloja MIDC', locality: 'Taloja MIDC', latitude: 19.0780, longitude: 73.1140, priority: 1, industrial: true },
  { district: 'Raigad', marketName: 'Kharghar', locality: 'Kharghar', latitude: 19.0473, longitude: 73.0699, priority: 2 },
  { district: 'Thane', marketName: 'Belapur', locality: 'CBD Belapur', latitude: 19.0168, longitude: 73.0395, priority: 2 },
  { district: 'Thane', marketName: 'Nerul', locality: 'Nerul', latitude: 19.0330, longitude: 73.0182, priority: 2 },
  { district: 'Thane', marketName: 'Vashi', locality: 'Vashi', latitude: 19.0771, longitude: 72.9986, priority: 2 },
  { district: 'Thane', marketName: 'Airoli', locality: 'Airoli', latitude: 19.1590, longitude: 72.9986, priority: 2 },
  { district: 'Thane', marketName: 'Rabale', locality: 'Rabale', latitude: 19.1396, longitude: 73.0071, priority: 2, industrial: true },
  { district: 'Thane', marketName: 'Mahape', locality: 'Mahape', latitude: 19.1162, longitude: 73.0117, priority: 2, industrial: true },
  { district: 'Thane', marketName: 'Turbhe', locality: 'Turbhe', latitude: 19.0758, longitude: 73.0169, priority: 2, industrial: true },
  { district: 'Raigad', marketName: 'Uran', locality: 'Uran', latitude: 18.8781, longitude: 72.9392, priority: 8 },
  { district: 'Raigad', marketName: 'Pen', locality: 'Pen', latitude: 18.7373, longitude: 73.0960, priority: 8 },
  { district: 'Raigad', marketName: 'Khopoli', locality: 'Khopoli', latitude: 18.7856, longitude: 73.3459, priority: 8 },
  { district: 'Raigad', marketName: 'Khalapur', locality: 'Khalapur', latitude: 18.8352, longitude: 73.2836, priority: 8 },
  { district: 'Raigad', marketName: 'Rasayani', locality: 'Rasayani', latitude: 18.9020, longitude: 73.1690, priority: 5, industrial: true },

  { district: 'Thane', marketName: 'Thane', locality: 'Thane', latitude: 19.2183, longitude: 72.9781, priority: 5 },
  { district: 'Thane', marketName: 'Bhiwandi', locality: 'Bhiwandi', latitude: 19.2813, longitude: 73.0483, priority: 5 },
  { district: 'Thane', marketName: 'Kalyan', locality: 'Kalyan', latitude: 19.2403, longitude: 73.1305, priority: 5 },
  { district: 'Thane', marketName: 'Dombivli', locality: 'Dombivli', latitude: 19.2184, longitude: 73.0867, priority: 5 },
  { district: 'Thane', marketName: 'Ambernath', locality: 'Ambernath', latitude: 19.1825, longitude: 73.1926, priority: 6 },
  { district: 'Thane', marketName: 'Badlapur', locality: 'Badlapur', latitude: 19.1552, longitude: 73.2655, priority: 6 },
  { district: 'Thane', marketName: 'Shahapur', locality: 'Shahapur', latitude: 19.4520, longitude: 73.3250, priority: 15 },
  { district: 'Thane', marketName: 'Mira Road', locality: 'Mira Road', latitude: 19.2817, longitude: 72.8686, priority: 8 },
  { district: 'Thane', marketName: 'Bhayandar', locality: 'Bhayandar', latitude: 19.3016, longitude: 72.8517, priority: 8 },
  { district: 'Palghar', marketName: 'Vasai', locality: 'Vasai', latitude: 19.3919, longitude: 72.8397, priority: 8 },
  { district: 'Palghar', marketName: 'Virar', locality: 'Virar', latitude: 19.4559, longitude: 72.8114, priority: 8 },

  { district: 'Pune', marketName: 'Pune', locality: 'Pune', latitude: 18.5204, longitude: 73.8567, priority: 5 },
  { district: 'Pune', marketName: 'Pimpri', locality: 'Pimpri', latitude: 18.6298, longitude: 73.7997, priority: 5 },
  { district: 'Pune', marketName: 'Chinchwad', locality: 'Chinchwad', latitude: 18.6279, longitude: 73.8009, priority: 5 },
  { district: 'Pune', marketName: 'Hinjawadi', locality: 'Hinjawadi', latitude: 18.5913, longitude: 73.7389, priority: 5 },
  { district: 'Pune', marketName: 'Wakad', locality: 'Wakad', latitude: 18.5993, longitude: 73.7625, priority: 5 },
  { district: 'Pune', marketName: 'Ravet', locality: 'Ravet', latitude: 18.6514, longitude: 73.7447, priority: 6 },
  { district: 'Pune', marketName: 'Tathawade', locality: 'Tathawade', latitude: 18.6187, longitude: 73.7457, priority: 6 },
  { district: 'Pune', marketName: 'Chakan', locality: 'Chakan', latitude: 18.7606, longitude: 73.8635, priority: 5, industrial: true },
  { district: 'Pune', marketName: 'Talegaon', locality: 'Talegaon Dabhade', latitude: 18.7350, longitude: 73.6752, priority: 6, industrial: true },
  { district: 'Pune', marketName: 'Ranjangaon', locality: 'Ranjangaon MIDC', latitude: 18.7550, longitude: 74.2440, priority: 6, industrial: true },
  { district: 'Pune', marketName: 'Wagholi', locality: 'Wagholi', latitude: 18.5793, longitude: 73.9824, priority: 5 },
  { district: 'Pune', marketName: 'Hadapsar', locality: 'Hadapsar', latitude: 18.5089, longitude: 73.9260, priority: 5 },
  { district: 'Pune', marketName: 'Kharadi', locality: 'Kharadi', latitude: 18.5515, longitude: 73.9348, priority: 5 },
  { district: 'Pune', marketName: 'Undri', locality: 'Undri', latitude: 18.4577, longitude: 73.9130, priority: 8 },
  { district: 'Pune', marketName: 'Kondhwa', locality: 'Kondhwa', latitude: 18.4695, longitude: 73.8891, priority: 8 },
  { district: 'Pune', marketName: 'Pirangut', locality: 'Pirangut', latitude: 18.5115, longitude: 73.6802, priority: 8, industrial: true },
  { district: 'Pune', marketName: 'Alandi', locality: 'Alandi', latitude: 18.6778, longitude: 73.8989, priority: 8 },

  { district: 'Nashik', marketName: 'Nashik', locality: 'Nashik', latitude: 19.9975, longitude: 73.7898, priority: 15 },
  { district: 'Nashik', marketName: 'Sinnar', locality: 'Sinnar', latitude: 19.8451, longitude: 73.9987, priority: 15, industrial: true },
  { district: 'Nashik', marketName: 'Malegaon', locality: 'Malegaon', latitude: 20.5579, longitude: 74.5287, priority: 20 },
  { district: 'Nagpur', marketName: 'Nagpur', locality: 'Nagpur', latitude: 21.1458, longitude: 79.0882, priority: 15 },
  { district: 'Wardha', marketName: 'Wardha', locality: 'Wardha', latitude: 20.7453, longitude: 78.6022, priority: 20 },
  { district: 'Amravati', marketName: 'Amravati', locality: 'Amravati', latitude: 20.9374, longitude: 77.7796, priority: 20 },
  { district: 'Chhatrapati Sambhajinagar', marketName: 'Chhatrapati Sambhajinagar', locality: 'Chhatrapati Sambhajinagar', latitude: 19.8762, longitude: 75.3433, priority: 15 },
  { district: 'Chhatrapati Sambhajinagar', marketName: 'Waluj', locality: 'Waluj MIDC', latitude: 19.8450, longitude: 75.2400, priority: 15, industrial: true },
  { district: 'Chhatrapati Sambhajinagar', marketName: 'Shendra', locality: 'Shendra MIDC', latitude: 19.9180, longitude: 75.4850, priority: 15, industrial: true },
  { district: 'Ahmednagar', marketName: 'Ahmednagar', locality: 'Ahmednagar', latitude: 19.0948, longitude: 74.7480, priority: 20 },
  { district: 'Ahmednagar', marketName: 'Shirdi', locality: 'Shirdi', latitude: 19.7645, longitude: 74.4762, priority: 25 },
  { district: 'Ahmednagar', marketName: 'Sangamner', locality: 'Sangamner', latitude: 19.5678, longitude: 74.2115, priority: 25 },
  { district: 'Solapur', marketName: 'Solapur', locality: 'Solapur', latitude: 17.6599, longitude: 75.9064, priority: 20 },
  { district: 'Kolhapur', marketName: 'Kolhapur', locality: 'Kolhapur', latitude: 16.7050, longitude: 74.2433, priority: 20 },
  { district: 'Kolhapur', marketName: 'Ichalkaranji', locality: 'Ichalkaranji', latitude: 16.6913, longitude: 74.4605, priority: 25 },
  { district: 'Sangli', marketName: 'Sangli', locality: 'Sangli', latitude: 16.8524, longitude: 74.5815, priority: 20 },
  { district: 'Sangli', marketName: 'Miraj', locality: 'Miraj', latitude: 16.8303, longitude: 74.6425, priority: 20 },
  { district: 'Satara', marketName: 'Satara', locality: 'Satara', latitude: 17.6805, longitude: 74.0183, priority: 20 },
  { district: 'Satara', marketName: 'Karad', locality: 'Karad', latitude: 17.2850, longitude: 74.1844, priority: 20 },
  { district: 'Jalgaon', marketName: 'Jalgaon', locality: 'Jalgaon', latitude: 21.0077, longitude: 75.5626, priority: 25 },
  { district: 'Dhule', marketName: 'Dhule', locality: 'Dhule', latitude: 20.9042, longitude: 74.7749, priority: 25 },
  { district: 'Nanded', marketName: 'Nanded', locality: 'Nanded', latitude: 19.1383, longitude: 77.3210, priority: 25 },
  { district: 'Latur', marketName: 'Latur', locality: 'Latur', latitude: 18.4088, longitude: 76.5604, priority: 25 },
  { district: 'Akola', marketName: 'Akola', locality: 'Akola', latitude: 20.7002, longitude: 77.0082, priority: 25 },
  { district: 'Chandrapur', marketName: 'Chandrapur', locality: 'Chandrapur', latitude: 19.9615, longitude: 79.2961, priority: 25 },
];
