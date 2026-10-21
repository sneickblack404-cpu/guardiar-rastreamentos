const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'guardiar.sqlite');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      badge TEXT NOT NULL,
      department TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      badge TEXT NOT NULL UNIQUE,
      internal_phone TEXT NOT NULL,
      fleet_vehicle TEXT NOT NULL,
      fleet_plate TEXT NOT NULL,
      region TEXT NOT NULL,
      base_address TEXT NOT NULL,
      base_lat REAL NOT NULL,
      base_lng REAL NOT NULL,
      color TEXT NOT NULL,
      skills TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISPONIVEL',
      max_daily_os INTEGER DEFAULT 6
    );

    CREATE TABLE IF NOT EXISTS trackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      internal_code TEXT NOT NULL UNIQUE,
      brand_model TEXT NOT NULL,
      imei TEXT NOT NULL UNIQUE,
      sim_iccid TEXT NOT NULL,
      sim_carrier TEXT NOT NULL,
      technology TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DISPONIVEL',
      assigned_vehicle_plate TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      os_number TEXT NOT NULL UNIQUE,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL DEFAULT '',
      vehicle_plate TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      technician_id INTEGER,
      tracker_id INTEGER,
      service_type TEXT NOT NULL DEFAULT 'INSTALACAO',
      priority TEXT NOT NULL DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'AGENDADO',
      scheduled_date TEXT NOT NULL,
      window_start TEXT NOT NULL DEFAULT '08:00',
      window_end TEXT NOT NULL DEFAULT '10:00',
      time_window TEXT NOT NULL DEFAULT '08:00 - 10:00',
      scheduled_time TEXT NOT NULL DEFAULT '08:30',
      estimated_duration_min INTEGER NOT NULL DEFAULT 60,
      address TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Belo Horizonte',
      state TEXT NOT NULL DEFAULT 'MG',
      cep TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      onsite_authorized_person TEXT NOT NULL DEFAULT '',
      install_hidden_spot TEXT DEFAULT '',
      route_order INTEGER DEFAULT 0,
      internal_notes TEXT DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'David',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      completed_at TEXT,
      FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL,
      FOREIGN KEY (tracker_id) REFERENCES trackers(id) ON DELETE SET NULL
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as total FROM users').get();
  if (countRow.total === 0) {
    seedDatabase();
  } else {
    // Always enforce the official Guardiar fixed base in BH - MG
    const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    upsertSetting.run('hq_name', 'Base Guardiar - Ouro Preto (BH)');
    upsertSetting.run('hq_address', 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG');
    upsertSetting.run('hq_lat', '-19.87404');
    upsertSetting.run('hq_lng', '-43.98780');
  }
}

function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seedDatabase() {
  const today = getLocalDateStr(0);
  const tomorrow = getLocalDateStr(1);

  // Settings
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'Guardiar Rastreamentos');
  insertSetting.run('hq_name', 'Base Guardiar - Ouro Preto (BH)');
  insertSetting.run('hq_address', 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG');
  insertSetting.run('hq_lat', '-19.87404');
  insertSetting.run('hq_lng', '-43.98780');
  insertSetting.run('google_maps_api_key', '');
  insertSetting.run('default_urban_speed_kmh', '28');
  insertSetting.run('buffer_between_os_min', '15');
  insertSetting.run('workday_start', '08:00');
  insertSetting.run('workday_end', '18:00');

  // 3 Users: David, Sarah, Jennifer (password: 1234)
  const insertUser = db.prepare(
    'INSERT INTO users (username, password, role, badge, department) VALUES (?, ?, ?, ?, ?)'
  );
  insertUser.run('David', '1234', 'Coordenação & Rotas', 'GD-01', 'Operações Guardiar');
  insertUser.run('Sarah', '1234', 'Agendamento & Atendimento Interno', 'GD-02', 'Central de Agendamentos');
  insertUser.run('Jennifer', '1234', 'Gestão Técnica & Controle', 'GD-03', 'Despacho & Logística');

  // Technicians
  const insertTech = db.prepare(`
    INSERT INTO technicians (name, badge, internal_phone, fleet_vehicle, fleet_plate, region, base_address, base_lat, base_lng, color, skills, status, max_daily_os)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTech.run(
    'Carlos Eduardo ("Cadu")',
    'TEC-01',
    '(31) 99101-4401',
    'Fiat Fiorino Endurance',
    'GRD-1A01',
    'Pampulha & Zona Norte (BH)',
    'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
    -19.87404,
    -43.98780,
    '#12303e',
    JSON.stringify(['12V', '24V Caminhão', 'Telemetria CAN', 'Isca RF']),
    'EM_ROTA',
    6
  );

  insertTech.run(
    'Roberto Nascimento ("Betão")',
    'TEC-02',
    '(31) 99102-4402',
    'VW Saveiro Robust',
    'GRD-2B02',
    'Centro-Sul & Contagem (MG)',
    'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
    -19.87404,
    -43.98780,
    '#e31e24',
    JSON.stringify(['12V', '24V Caminhão', 'Baú Frigorífico', 'Sensor de Porta']),
    'DISPONIVEL',
    6
  );

  insertTech.run(
    'Leandro Silva',
    'TEC-03',
    '(31) 99103-4403',
    'Honda CG 160 Cargo',
    'GRD-3C03',
    'Belo Horizonte & Betim (MG)',
    'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
    -19.87404,
    -43.98780,
    '#0284c7',
    JSON.stringify(['12V', 'Motos', 'Isca RF/LoRa', 'Manutenção Rápida']),
    'DISPONIVEL',
    7
  );

  insertTech.run(
    'Wagner Moura Técnico',
    'TEC-04',
    '(31) 99104-4404',
    'Renault Kangoo Express',
    'GRD-4D04',
    'Grande BH & Nova Lima (MG)',
    'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
    -19.87404,
    -43.98780,
    '#059669',
    JSON.stringify(['12V', '24V Caminhão', 'Telemetria CAN', 'Frotas Pesadas']),
    'DISPONIVEL',
    5
  );

  // Trackers Inventory
  const insertTracker = db.prepare(`
    INSERT INTO trackers (internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, assigned_vehicle_plate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTracker.run('EQ-9001', 'Suntech ST4310U 4G', '359881092340011', '895506123000192831', 'Vivo M2M Multi', '4G Rastreamento', 'RESERVADO', 'FTR-4E21', 'Testado em bancada');
  insertTracker.run('EQ-9002', 'Teltonika FMB920 4G', '359881092340029', '895506123000192832', 'Claro IoT Corp', '4G Rastreamento', 'RESERVADO', 'LOG-8B12', 'Chicote padrão incluso');
  insertTracker.run('EQ-9003', 'Queclink GV350M CAN', '359881092340037', '895506123000192833', 'Arqia Dual-Chip', '4G Telemetria Canbus', 'DISPONIVEL', null, 'Configurado para leitura de hodômetro');
  insertTracker.run('EQ-9004', 'Suntech ST4310U 4G', '359881092340045', '895506123000192834', 'Vivo M2M Multi', '4G Rastreamento', 'DISPONIVEL', null, 'Pronto para despacho');
  insertTracker.run('EQ-9005', 'Isca Autônoma LoRa RF', '359881092340052', '895506123000192835', 'Tim M2M + RF', 'Isca RF/LoRa', 'DISPONIVEL', null, 'Bateria 3 anos 100% carregada');

  // Appointments (Ordens de Serviço with free-text vehicle/contact fields & custom minute windows)
  const insertApp = db.prepare(`
    INSERT INTO appointments (
      os_number, contact_name, contact_phone, vehicle_plate, vehicle_model,
      technician_id, service_type, priority, status,
      scheduled_date, window_start, window_end, time_window, scheduled_time,
      estimated_duration_min, address, neighborhood, city, state, cep,
      lat, lng, onsite_authorized_person, install_hidden_spot,
      route_order, internal_notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertApp.run(
    'OS-2026-1001',
    'David Marques Gonçalves',
    '(31) 99999-0000',
    'ERM1234',
    'SW4',
    1,
    'INSTALACAO',
    'NORMAL',
    'AGENDADO',
    tomorrow,
    '08:00',
    '10:00',
    '08:00 - 10:00',
    '08:00',
    60,
    'Rua João Gomide Leite, 81',
    'Pindorama',
    'Belo Horizonte',
    'MG',
    '30865-060',
    -19.90559,
    -44.02287,
    'David Marques Gonçalves',
    'Painel central superior',
    1,
    '',
    'David'
  );

  insertApp.run(
    'OS-2026-1002',
    'David Marques Gonçalves',
    '(31) 99999-0000',
    'DAD1234',
    'XRE 300',
    1,
    'INSTALACAO',
    'NORMAL',
    'AGENDADO',
    tomorrow,
    '09:00',
    '10:00',
    '09:00 - 10:00',
    '09:00',
    60,
    'Rua Canelinha, 100',
    'Pindorama',
    'Belo Horizonte',
    'MG',
    '30865-200',
    -19.90512,
    -44.01951,
    'David Marques Gonçalves',
    'Sob carenagem frontal',
    2,
    '',
    'David'
  );
}

initDb();

module.exports = {
  db,
  getLocalDateStr,
};
