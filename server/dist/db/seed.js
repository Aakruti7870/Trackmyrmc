import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import * as schema from './schema.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
async function seed() {
    console.log('🌱 Seeding database...');
    const hash = (p) => bcrypt.hash(p, 10);
    await db.insert(schema.users).values([
        { name: 'Rajesh Kumar', email: 'admin@aakruti.com', passwordHash: await hash('admin123'), role: 'admin' },
        { name: 'Priya Sharma', email: 'dispatcher@aakruti.com', passwordHash: await hash('dispatch123'), role: 'dispatcher' },
        { name: 'Suresh Patel', email: 'operator@aakruti.com', passwordHash: await hash('operator123'), role: 'plant_operator' },
        { name: 'Arvind Builders', email: 'client@aakruti.com', passwordHash: await hash('client123'), role: 'client' },
        { name: 'Ganesh More', email: 'driver@aakruti.com', passwordHash: await hash('driver123'), role: 'driver' },
    ]).onConflictDoNothing();
    // Marketplace plants — seeded ONLY for CONCRETE KING's live service areas:
    // Navi Mumbai, Thane, Vashi, Belapur, Pune, Pimpri Chinchwad, Lonavla, Karjat,
    // Uran. Coordinates are real (Google-map) locations for each area. Most are
    // approved + active + verified (visible to customers); two demo rows are
    // pending / inactive to prove the nearby filter and admin onboarding flow.
    // Each plant carries a unique plantCode (PLT-NNN) — the tenant identifier the
    // per-plant customer codes hang off.
    const plantRows = await db.insert(schema.plants).values([
        { plantCode: 'PLT-001', name: 'CONCRETE KING — Navi Mumbai Hub', legalName: 'Concrete King Navi Mumbai Pvt Ltd', gstNo: '27AAKCK0001A1Z5', email: 'navimumbai@concreteking.example', address: 'Sector 19, Nerul', city: 'Navi Mumbai', contactNumber: '9820011001', latitude: '19.0330000', longitude: '73.0297000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-002', name: 'ShreeMix RMC — Vashi', address: 'Plot 21, Sector 19, Vashi', city: 'Vashi', contactNumber: '9820011002', latitude: '19.0760000', longitude: '72.9986000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 30, grades: ['M-15', 'M-20', 'M-25', 'M-30'], openTime: '06:30', closeTime: '19:30' },
        { plantCode: 'PLT-003', name: 'Belapur ReadyMix — CBD', address: 'Sector 11, CBD Belapur', city: 'Belapur', contactNumber: '9820011003', latitude: '19.0152000', longitude: '73.0359000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 30, grades: ['M-20', 'M-25', 'M-30', 'M-35'], openTime: '07:00', closeTime: '20:00' },
        { plantCode: 'PLT-004', name: 'Thane Premix — Ghodbunder', address: 'Ghodbunder Road', city: 'Thane', contactNumber: '9820011004', latitude: '19.2183000', longitude: '72.9781000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 35, grades: ['M-20', 'M-25', 'M-30', 'M-35'], openTime: '07:00', closeTime: '19:00' },
        { plantCode: 'PLT-005', name: 'Uran Coastal RMC', address: 'JNPT Road, Uran', city: 'Uran', contactNumber: '9820011005', latitude: '18.8833000', longitude: '72.9447000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-006', name: 'Karjat Hills Concrete', address: 'Karjat–Murbad Road', city: 'Karjat', contactNumber: '9820011006', latitude: '18.9107000', longitude: '73.3239000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30'], openTime: '06:30', closeTime: '20:00' },
        { plantCode: 'PLT-007', name: 'Lonavla Ghat RMC', address: 'Mumbai–Pune Highway, Lonavla', city: 'Lonavla', contactNumber: '9820011007', latitude: '18.7546000', longitude: '73.4062000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-20', 'M-25', 'M-30', 'M-35'], openTime: '06:00', closeTime: '20:00' },
        { plantCode: 'PLT-008', name: 'Deccan RMC — Pune', address: 'Hadapsar Industrial Estate', city: 'Pune', contactNumber: '9820011008', latitude: '18.5204000', longitude: '73.8567000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-25', 'M-30', 'M-35', 'M-40', 'M-45'], openTime: '05:30', closeTime: '22:00' },
        { plantCode: 'PLT-009', name: 'PCMC UltraReady Concrete', address: 'MIDC Bhosari, Pimpri Chinchwad', city: 'Pimpri Chinchwad', contactNumber: '9820011009', latitude: '18.6298000', longitude: '73.7997000', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-25', 'M-30', 'M-35', 'M-40'], openTime: '05:00', closeTime: '23:00' },
        { plantCode: 'PLT-010', name: 'Thane Skyline RMC (Pending Approval)', address: 'Wagle Estate, Thane', city: 'Thane', contactNumber: '9820011010', latitude: '19.1972000', longitude: '72.9722000', plantStatus: 'pending', isActive: true, locationVerified: false, deliveryRadiusKm: 25, grades: ['M-20', 'M-25'], openTime: '08:00', closeTime: '18:00' },
        { plantCode: 'PLT-011', name: 'Airoli ReadyMix (Inactive)', address: 'Sector 4, Airoli', city: 'Navi Mumbai', contactNumber: '9820011011', latitude: '19.1500000', longitude: '72.9990000', plantStatus: 'approved', isActive: false, locationVerified: true, deliveryRadiusKm: 25, grades: ['M-20', 'M-25', 'M-30'], openTime: '07:00', closeTime: '20:00' },
        // Real RMC plants in the Navi Mumbai / Panvel / Raigad belt, sourced from
        // their Google Maps listings (exact GPS + postal address). These are
        // onboarding leads; contact number / GST are collected at verification.
        { plantCode: 'PLT-012', name: 'AAKRUTI INFRA RMC', address: 'JNPT Rd, near Nilesh dhaba parking, Karanjade, Panvel, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9724111', longitude: '73.1026611', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-013', name: 'Sai Construction RMC Plant', address: 'Sr. No. 69, Karanjade, Panvel, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9698582', longitude: '73.1028335', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-014', name: 'Godrej & Boyce RMC Plant Panvel', address: 'X4C3+GMW, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9721367', longitude: '73.103232', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-015', name: 'VAIBHAV CONSTRUCTION (RMC- Plant)', address: 'X4F2+7P, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9732448', longitude: '73.1017771', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-016', name: 'Nexoos RMC Plant', address: 'X4F2+6XQ Gat No-77/1,Near Nilesh Dhaba, Palaspe, JNPT Rd, Karanjade, Panvel, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9727676', longitude: '73.1030178', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-017', name: 'LTPS INFRA PVT. LTD. (RMC PLANT)', address: 'X4F2+253, Karanjade, Maharashtra 410206, India', city: 'Karanjade', contactNumber: null, latitude: '18.9725548', longitude: '73.1012199', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-018', name: 'RMC PLANT PUSHPAK NAGAR', address: 'Pushpak nagar, Sector-6, near Manghar, Panvel, Navi Mumbai, Maharashtra 401221, India', city: 'Navi Mumbai', contactNumber: null, latitude: '18.9627833', longitude: '73.0725536', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-019', name: 'RMC PLANT - ULTRA STRUCTURAL SOLUTION PVT LTD', address: 'Sr. No. 50/51, Mouje Manghar, Post Kundevahal, Taluka Panvel, District Raigad, PIN code, Maharashtra 410206, India', city: 'Panvel', contactNumber: null, latitude: '18.9596008', longitude: '73.0694981', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-020', name: 'Vishvamukh RMC Plant', address: 'W4VH+Q3, Palaspa, Panvel, Navi Mumbai, Shirdhon, Maharashtra 410221, India', city: 'Shirdhon', contactNumber: null, latitude: '18.9443687', longitude: '73.1277173', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-021', name: 'Shree Balaji Infra Associates', address: 'X35C+QPV, Manghar, Ulwe, Manghar, Maharashtra 410206, India', city: 'Manghar', contactNumber: null, latitude: '18.9594794', longitude: '73.0717929', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-022', name: 'Inframarket Ready Mix Concrete Batching Plant - Ulwe', address: 'S No. 17/3, Gavhanphata - Chirner Rd, next to Dhyaneshwar shipping Yard Tal, Gaonthan, Near, Uran, Jambhulpada, Navi Mumbai, Maharashtra 410206, India', city: 'Navi Mumbai', contactNumber: null, latitude: '18.9335621', longitude: '73.0445122', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-023', name: 'RMC PLANT GAAMUP INFRA', address: 'SURVEY NO. 203, DR PATIL CRUSHER, GAAMUP INFRA RMC PLANT, VILLAGE,RIKONDA, BONSARI, MIDC Industrial Area, Turbhe, Maharashtra 400703, India', city: 'Turbhe', contactNumber: null, latitude: '19.0630755', longitude: '73.0337589', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-024', name: 'Bangur RMC Plant', address: 'X25V+GCW, Ulwe, Padeghar, Maharashtra 410206, India', city: 'Padeghar', contactNumber: null, latitude: '18.9588683', longitude: '73.0435903', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-025', name: 'PAM INFRACON (RMC PLANT)', address: 'PLOT NO 78/8, Valvali Village, Panvel, Maharashtra 410208, India', city: 'Panvel', contactNumber: null, latitude: '19.0338659', longitude: '73.1292781', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-026', name: 'Gurukrupa Readymix Concrete', address: 'JNPT Rd, Ulwe, Bambavi, Maharashtra 410206, India', city: 'Bambavi', contactNumber: null, latitude: '18.964', longitude: '73.0548', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-027', name: 'JMMIPL Plant', address: 'X374+F55, Ulwe, Bambavi, Navi Mumbai, Maharashtra 410206, India', city: 'Navi Mumbai', contactNumber: null, latitude: '18.9636405', longitude: '73.0554948', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-028', name: 'Ultratech RMC Panvel', address: 'X522+2QH, Road, near Gemco company, Rasayani, Ariwali, Maharashtra 410221, India', city: 'Ariwali', contactNumber: null, latitude: '18.9500644', longitude: '73.1519836', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-029', name: 'Inframarket RMC Plant - Godrej Panvel', address: 'Godrej City, Old, Mumbai - Pune Expy, Panvel, Khanavale, Maharashtra 410206, India', city: 'Khanavale', contactNumber: null, latitude: '18.9302622', longitude: '73.1870944', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-030', name: 'TNA RMC Plant', address: 'V3X5+GQ2, Dighode, Pohi, Maharashtra 410206, India', city: 'Pohi', contactNumber: null, latitude: '18.8987731', longitude: '73.0593765', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-031', name: 'Kharghar plant RDC Concrete INDIA PVT LTD.', address: 'Kharghar Railway Station Complex, Sector 2, Kharghar, Panvel, Maharashtra 410210, India', city: 'Panvel', contactNumber: null, latitude: '19.0261123', longitude: '73.0609173', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-032', name: 'R k madhani RMC Plant', address: 'V3X5+6V8, Pohi, Maharashtra 410206, India', city: 'Pohi', contactNumber: null, latitude: '18.8980397', longitude: '73.0597177', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-033', name: 'SRP INFRA SOLUTIONS RMC PLANT', address: 'Survey No. 203, Vill - Bonsari, M/s. Jai Balaji Infraprojects, Turbhe, Navi Mumbai, Maharashtra 400703, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.0711754', longitude: '73.0345751', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-034', name: 'Chaitrali RMC Plant', address: 'W5FX+6CR, Pen, Bhokarpada, Maharashtra 410207, India', city: 'Bhokarpada', contactNumber: null, latitude: '18.9231228', longitude: '73.1985263', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-035', name: 'Prism Johnson Limited (RMC India Division)', address: 'JNPT Rd, Ulwe, Kundevahal, Maharashtra 410206, India', city: 'Kundevahal', contactNumber: null, latitude: '18.9623892', longitude: '73.05809', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-036', name: 'Omkar Enterprises RMC Plant Vindhane', address: 'V3X5+MQ Tiranga Farm, Pohi, Maharashtra 410206, India', city: 'Pohi', contactNumber: null, latitude: '18.8985833', longitude: '73.0595', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-037', name: 'Yashraj Infrastructure Plant', address: 'Indira Nagar, MIDC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400703, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.0758596', longitude: '73.0327143', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-038', name: 'MANSI-OM (JV)/Infratech Concrete Solutions1(RMC Plant)', address: '45/1, phase \'A, Electronic Zone, MIDC Industrial Area, Sector 1, Mahape, Navi Mumbai, Maharashtra 400710, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.1066399', longitude: '73.0224696', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-039', name: 'Manoj InfraWork Pvt. Ltd.', address: '21/22, Vishrali Naka, Panvel, Maharashtra 410206, India', city: 'Panvel', contactNumber: null, latitude: '18.9808902', longitude: '73.1152644', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-040', name: 'Harshal Deshmukh Infra (RMC PLANT)', address: 'Near takedevi mandir, at- dandphata, post - barvai Tal, dist, Panvel, Barvai, Maharashtra 410207, India', city: 'Barvai', contactNumber: null, latitude: '18.9113763', longitude: '73.2096738', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-041', name: 'Inframarket RMC Plant - Turbhe', address: 'C3A, situated at, Savita Chemical Rd, adjacent Asian Paints, opp. Star 2 Chemicals, Turbhe MIDC, Turbhe, Navi Mumbai, Maharashtra 400703, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.0834983', longitude: '73.0210477', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-042', name: 'Aparna Enterprises Limited - Ulwe', address: 'Survey No. 431/2, 429/0, Gavhanphata - Chirner Rd, Wahal, Maharashtra 410206, India', city: 'Wahal', contactNumber: null, latitude: '18.94827', longitude: '73.0404949', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-043', name: 'Inframarket RMC Plant - Mahape', address: 'Q-5/1, Q-8, Plot No - Q-5, TTC Industrial Area, MIDC Mahape, Pawne, Navi Mumbai, Maharashtra 400710, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.0976306', longitude: '73.0262286', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-044', name: 'Ultratech cement bulk Terminal', address: 'Industrial Area, Kalamboli, Panvel, Maharashtra 410218, India', city: 'Panvel', contactNumber: null, latitude: '19.0235335', longitude: '73.1113053', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
        { plantCode: 'PLT-045', name: 'GaamUP Infra Pvt. Ltd.', address: 'Akshar Business Park, Y-3120, Janta Market Rd, opposite APMC Fruit & Vegetable Market, Sector 25, Vashi, Navi Mumbai, Maharashtra 400703, India', city: 'Navi Mumbai', contactNumber: null, latitude: '19.079066', longitude: '73.0134099', plantStatus: 'approved', isActive: true, locationVerified: true, deliveryRadiusKm: 40, grades: ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40'], openTime: '06:00', closeTime: '21:00' },
    ]).returning().onConflictDoNothing();
    // The legacy single-tenant demo dataset (clients/orders/challans/ledger) is
    // bound to the first plant so it stays coherent as that plant's own tenant
    // data. Each demo client gets a per-plant customer code under that plant.
    const homePlant = plantRows[0];
    const custCode = (i) => `${homePlant.plantCode}-C${String(i + 1).padStart(4, '0')}`;
    const clientRows = await db.insert(schema.clients).values([
        { plantId: homePlant.id, customerCode: custCode(0), name: 'Arvind Builders Pvt Ltd', contactPerson: 'Arvind Shah', phone: '9876543210', email: 'arvind@arvindbuilders.com', gstNo: '27AAACL1234F1Z5', address: 'Plot 12, MIDC', city: 'Navi Mumbai', creditLimit: '500000', outstandingAmount: '125000' },
        { plantId: homePlant.id, customerCode: custCode(1), name: 'Marvel Realty Ltd', contactPerson: 'Suresh Marvel', phone: '9123456780', email: 'suresh@marvelrealty.com', gstNo: '27AABCM5678G1Z3', address: 'Sector 7, Kharghar', city: 'Navi Mumbai', creditLimit: '1000000', outstandingAmount: '380000' },
        { plantId: homePlant.id, customerCode: custCode(2), name: 'Thane Tower Projects', contactPerson: 'Rajan Thakur', phone: '9988776655', email: 'rajan@thanetower.com', gstNo: '27AAACT9012H1Z8', address: 'Ghodbunder Road', city: 'Thane', creditLimit: '750000', outstandingAmount: '95000' },
        { plantId: homePlant.id, customerCode: custCode(3), name: 'Panvel Infrastructure', contactPerson: 'Nilesh Jadhav', phone: '9765432109', email: 'nilesh@panvelinfra.com', gstNo: '27AADCP3456J1Z2', address: 'Sector 23, Panvel', city: 'Panvel', creditLimit: '600000', outstandingAmount: '45000' },
        { plantId: homePlant.id, customerCode: custCode(4), name: 'Kharghar Heights Builders', contactPerson: 'Deepak Mehra', phone: '9654321098', email: 'deepak@khargharh.com', gstNo: '27AAECK7890K1Z6', address: 'Plot 45, Sector 12', city: 'Kharghar', creditLimit: '400000', outstandingAmount: '210000' },
    ]).returning().onConflictDoNothing();
    const siteRows = await db.insert(schema.sites).values([
        { clientId: clientRows[0].id, name: 'Arvind Galaxy Phase 2', address: 'Plot 12, Sector 4', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Central Tower', address: 'Sector 7, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Residency Wing B', address: 'Sector 10, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[2].id, name: 'Thane Central Tower B4', address: 'Ghodbunder Road, Near Station', city: 'Thane' },
        { clientId: clientRows[3].id, name: 'Panvel Tech Park Block C', address: 'Sector 23', city: 'Panvel' },
    ]).returning().onConflictDoNothing();
    const driverRows = await db.insert(schema.drivers).values([
        { name: 'Ganesh More', phone: '9823456701', licenseNo: 'MH04-20180123456', licenseExpiry: '2026-09-15' },
        { name: 'Ramesh Patil', phone: '9823456702', licenseNo: 'MH04-20190234567', licenseExpiry: '2027-03-22' },
        { name: 'Sanjay Kamble', phone: '9823456703', licenseNo: 'MH04-20170345678', licenseExpiry: '2025-11-30' },
        { name: 'Vinod Shinde', phone: '9823456704', licenseNo: 'MH04-20200456789', licenseExpiry: '2028-06-10' },
    ]).returning().onConflictDoNothing();
    const vehicleRows = await db.insert(schema.vehicles).values([
        { vehicleNo: 'MH 46 CU 1122', type: 'Transit Mixer', capacity: '7', driverId: driverRows[0]?.id, insuranceExpiry: '2025-12-31', lastService: '2025-03-15', status: 'active' },
        { vehicleNo: 'MH 46 CU 0813', type: 'Transit Mixer', capacity: '7', driverId: driverRows[1]?.id, insuranceExpiry: '2026-06-30', lastService: '2025-04-20', status: 'active' },
        { vehicleNo: 'MH 46 BT 4521', type: 'Transit Mixer', capacity: '6', driverId: driverRows[2]?.id, insuranceExpiry: '2025-08-15', lastService: '2025-01-10', status: 'maintenance' },
        { vehicleNo: 'MH 46 DX 7788', type: 'Transit Mixer', capacity: '9', driverId: driverRows[3]?.id, insuranceExpiry: '2026-11-20', lastService: '2025-05-01', status: 'active' },
    ]).returning().onConflictDoNothing();
    const today = new Date().toISOString().slice(0, 10);
    const hp = homePlant.id;
    const orderRows = await db.insert(schema.orders).values([
        { orderNo: 'ORD-001', plantId: hp, clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M30', quantity: '42', pumpRequired: true, deliveryDate: today, status: 'in_progress', notes: 'Slab casting today morning' },
        { orderNo: 'ORD-002', plantId: hp, clientId: clientRows[1].id, siteId: siteRows[1].id, grade: 'M25', quantity: '28', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-003', plantId: hp, clientId: clientRows[2].id, siteId: siteRows[3].id, grade: 'M40', quantity: '56', pumpRequired: true, deliveryDate: today, status: 'in_progress' },
        { orderNo: 'ORD-004', plantId: hp, clientId: clientRows[3].id, siteId: siteRows[4].id, grade: 'M20', quantity: '21', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-005', plantId: hp, clientId: clientRows[4].id, siteId: null, grade: 'M35', quantity: '35', pumpRequired: true, deliveryDate: today, status: 'completed' },
        { orderNo: 'ORD-006', plantId: hp, clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M20', quantity: '14', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-007', plantId: hp, clientId: clientRows[1].id, siteId: siteRows[2].id, grade: 'M30', quantity: '49', pumpRequired: true, deliveryDate: today, status: 'cancelled' },
    ]).returning().onConflictDoNothing();
    const now = new Date();
    const h2 = new Date(now.getTime() - 2 * 3600000);
    const h4 = new Date(now.getTime() - 4 * 3600000);
    const challanRows = await db.insert(schema.challans).values([
        { challanNo: 'CH-0001', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 3600000) },
        { challanNo: 'CH-0002', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0003', plantId: hp, orderId: orderRows[2]?.id, clientId: clientRows[2].id, siteId: siteRows[3].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M40', quantity: '9', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0004', plantId: hp, orderId: orderRows[4]?.id, clientId: clientRows[4].id, siteId: null, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M35', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 4200000) },
        { challanNo: 'CH-0005', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
        { challanNo: 'CH-0006', plantId: hp, orderId: orderRows[1]?.id, clientId: clientRows[1].id, siteId: siteRows[1].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M25', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
    ]).returning().onConflictDoNothing();
    await db.insert(schema.batchRecords).values([
        { batchNo: 'BTH-001', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel', remarks: 'Morning batch' },
        { batchNo: 'BTH-002', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
        { batchNo: 'BTH-003', grade: 'M40', quantity: '9', cementBags: 81, waterLiters: 198, sandKg: 990, aggregateKg: 1350, operator: 'Suresh Patel' },
        { batchNo: 'BTH-004', grade: 'M35', quantity: '7', cementBags: 63, waterLiters: 168, sandKg: 875, aggregateKg: 1225, operator: 'Suresh Patel' },
        { batchNo: 'BTH-005', grade: 'M25', quantity: '7', cementBags: 49, waterLiters: 182, sandKg: 805, aggregateKg: 1050, operator: 'Suresh Patel', remarks: 'Afternoon batch' },
        { batchNo: 'BTH-006', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
    ]).onConflictDoNothing();
    await db.insert(schema.ledgerEntries).values([
        { clientId: clientRows[0].id, type: 'debit', amount: '125000', description: 'Invoice #INV-2025-001 - M30 Concrete Supply', referenceNo: 'INV-2025-001' },
        { clientId: clientRows[1].id, type: 'debit', amount: '420000', description: 'Invoice #INV-2025-002 - M25 Concrete Supply', referenceNo: 'INV-2025-002' },
        { clientId: clientRows[1].id, type: 'credit', amount: '40000', description: 'Payment received - NEFT', referenceNo: 'NEFT-20250405' },
        { clientId: clientRows[2].id, type: 'debit', amount: '95000', description: 'Invoice #INV-2025-003 - M40 Concrete Supply', referenceNo: 'INV-2025-003' },
        { clientId: clientRows[3].id, type: 'debit', amount: '45000', description: 'Invoice #INV-2025-004 - M20 Concrete Supply', referenceNo: 'INV-2025-004' },
        { clientId: clientRows[4].id, type: 'debit', amount: '280000', description: 'Invoice #INV-2025-005 - M35 Concrete Supply', referenceNo: 'INV-2025-005' },
        { clientId: clientRows[4].id, type: 'credit', amount: '70000', description: 'Payment received - Cheque', referenceNo: 'CHQ-20250418' },
    ]).onConflictDoNothing();
    const { eq } = await import('drizzle-orm');
    await db.update(schema.users)
        .set({ linkedClientId: clientRows[0].id })
        .where(eq(schema.users.email, 'client@aakruti.com'));
    await db.update(schema.users)
        .set({ linkedDriverId: driverRows[0].id })
        .where(eq(schema.users.email, 'driver@aakruti.com'));
    // Map the demo customer to their per-plant client at the home plant so the
    // marketplace cross-plant listing has a mapping row to read (mirrors what the
    // first marketplace order would create lazily via resolvePlantCustomer).
    const [clientUser] = await db.select({ id: schema.users.id })
        .from(schema.users).where(eq(schema.users.email, 'client@aakruti.com'));
    if (clientUser) {
        await db.insert(schema.plantCustomers)
            .values({ plantId: homePlant.id, userId: clientUser.id, clientId: clientRows[0].id })
            .onConflictDoNothing();
    }
    console.log('✅ Seed complete!');
    console.log('\n🔑 Demo Credentials:');
    console.log('  Admin:    admin@aakruti.com / admin123');
    console.log('  Dispatcher: dispatcher@aakruti.com / dispatch123');
    console.log('  Operator: operator@aakruti.com / operator123');
    console.log('  Client:   client@aakruti.com / client123');
    console.log('  Driver:   driver@aakruti.com / driver123');
    await pool.end();
}
seed().catch(e => { console.error(e); process.exit(1); });
