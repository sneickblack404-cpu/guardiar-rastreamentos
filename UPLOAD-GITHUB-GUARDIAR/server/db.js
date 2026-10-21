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
      city TEXT NOT NULL DEFAULT 'São Paulo',
      state TEXT NOT NULL DEFAULT 'SP',
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
  insertSetting.run('hq_name', 'Matriz Operacional Guardiar - Barra Funda');
  insertSetting.run('hq_address', 'Av. Marquês de São Vicente, 1619 - Barra Funda, São Paulo - SP');
  insertSetting.run('hq_lat', '-23.5218');
  insertSetting.run('hq_lng', '-46.6692');
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
    '(11) 99101-4401',
    'Fiat Fiorino Endurance',
    'GRD-1A01',
    'Zona Sul & Oeste (SP)',
    'Av. Marquês de São Vicente, 1619 - Barra Funda, São Paulo - SP',
    -23.5218,
    -46.6692,
    '#12303e', // Guardiar Petrol Navy
    JSON.stringify(['12V', '24V Caminhão', 'Telemetria CAN', 'Isca RF']),
    'EM_ROTA',
    6
  );

  insertTech.run(
    'Roberto Nascimento ("Betão")',
    'TEC-02',
    '(11) 99102-4402',
    'VW Saveiro Robust',
    'GRD-2B02',
    'Zona Leste & Guarulhos',
    'Av. Celso Garcia, 4200 - Tatuapé, São Paulo - SP',
    -23.5326,
    -46.5640,
    '#e31e24', // Guardiar Red
    JSON.stringify(['12V', '24V Caminhão', 'Baú Frigorífico', 'Sensor de Porta']),
    'DISPONIVEL',
    6
  );

  insertTech.run(
    'Leandro Silva',
    'TEC-03',
    '(11) 99103-4403',
    'Honda CG 160 Cargo',
    'GRD-3C03',
    'Centro Expandido & Zona Norte',
    'Av. Marquês de São Vicente, 1619 - Barra Funda, São Paulo - SP',
    -23.5218,
    -46.6692,
    '#0284c7', // Sky Blue
    JSON.stringify(['12V', 'Motos', 'Isca RF/LoRa', 'Manutenção Rápida']),
    'DISPONIVEL',
    7
  );

  insertTech.run(
    'Wagner Moura Técnico',
    'TEC-04',
    '(11) 99104-4404',
    'Renault Kangoo Express',
    'GRD-4D04',
    'ABC Paulista & Rodoanel Sul',
    'Av. Kennedy, 700 - Centro, São Bernardo do Campo - SP',
    -23.6939,
    -46.5650,
    '#059669', // Emerald
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
    'Eng. Marcos Tadeu (Vértice)',
    '(11) 98812-2233',
    'VLM-2D90',
    'Toyota Hilux SRX 2.8 4x4',
    1,
    'INSTALACAO',
    'ALTA',
    'CONCLUIDO',
    today,
    '08:15',
    '09:45',
    '08:15 - 09:45',
    '08:15',
    60,
    'Rua Cardeal Arcoverde, 1749 - Pinheiros',
    'Pinheiros',
    'São Paulo',
    'SP',
    '05407-002',
    -23.5612,
    -46.6914,
    'Eng. Marcos Tadeu',
    'Coluna A esquerda superior',
    1,
    'Sinal GPS validado com 14 satélites e ignição pós-chave testada.',
    'David'
  );

  insertApp.run(
    'OS-2026-1002',
    'Juliana Martins (Prime Fleet)',
    '(11) 99188-5510',
    'LOG-8B12',
    'Jeep Compass Longitude T270',
    1,
    'INSTALACAO',
    'NORMAL',
    'EM_EXECUCAO',
    today,
    '10:15',
    '11:45',
    '10:15 - 11:45',
    '10:15',
    60,
    'Rua Funchal, 418 - Vila Olímpia',
    'Vila Olímpia',
    'São Paulo',
    'SP',
    '04551-060',
    -23.5952,
    -46.6890,
    'Juliana Martins',
    'Atrás do painel digital com chicote Y plug-and-play',
    2,
    'Usar fita acústica felpuda padrão montadora para evitar ruído.',
    'Sarah'
  );

  insertApp.run(
    'OS-2026-1003',
    'Sr. Cláudio (TransLogística)',
    '(11) 97412-8800',
    'FTR-4E21',
    'Mercedes-Benz Sprinter 416 CDI',
    1,
    'INSTALACAO',
    'URGENTE_FROTA',
    'AGENDADO',
    today,
    '13:40',
    '15:20',
    '13:40 - 15:20',
    '13:40',
    60,
    'Av. das Nações Unidas, 12901 - Brooklin Paulista',
    'Brooklin Paulista',
    'São Paulo',
    'SP',
    '04578-910',
    -23.6095,
    -46.6968,
    'Sr. Cláudio (Chefe de Pátio)',
    'Painel central superior',
    3,
    'Veículo sairá em viagem às 17h00, prioridade máxima na janela da tarde.',
    'David'
  );

  insertApp.run(
    'OS-2026-1004',
    'Paulo Sérgio (Express Leste)',
    '(11) 96099-4100',
    'TRANS-9C77',
    'VW Delivery 11.180 Baú',
    2,
    'INSTALACAO',
    'ALTA',
    'AGENDADO',
    today,
    '09:10',
    '11:00',
    '09:10 - 11:00',
    '09:10',
    90,
    'Rua Tuiuti, 2100 - Tatuapé',
    'Tatuapé',
    'São Paulo',
    'SP',
    '03307-005',
    -23.5415,
    -46.5712,
    'Paulo Sérgio',
    'Módulo central 24V atrás do tacógrafo',
    1,
    'Conferir tensão 24V antes de fechar chicote.',
    'Jennifer'
  );

  insertApp.run(
    'OS-2026-1005',
    'Rogério Dias (CD Guarulhos)',
    '(11) 98408-7711',
    'GRU-1A99',
    'Volvo VM 270 6x2 Frigorífico',
    2,
    'MANUTENCAO',
    'NORMAL',
    'AGENDADO',
    today,
    '13:30',
    '15:00',
    '13:30 - 15:00',
    '13:30',
    60,
    'Av. Paulo Faccini, 1200 - Macedo',
    'Macedo',
    'Guarulhos',
    'SP',
    '07111-000',
    -23.4648,
    -46.5262,
    'Rogério Dias',
    'Painel inferior direito próximo à caixa de fusíveis',
    2,
    'Revisar antena GPS do caminhão.',
    'Sarah'
  );

  insertApp.run(
    'OS-2026-1006',
    'Rafael Gomes (Moema)',
    '(11) 99321-4090',
    'MOT-3X44',
    'Yamaha Fazer FZ25 ABS',
    null,
    'INSTALACAO',
    'NORMAL',
    'AGENDADO',
    today,
    '15:15',
    '16:45',
    '15:15 - 16:45',
    '15:15',
    60,
    'Av. Ibirapuera, 2332 - Moema',
    'Moema',
    'São Paulo',
    'SP',
    '04028-002',
    -23.6048,
    -46.6629,
    'Rafael Gomes',
    'Sob carenagem frontal',
    0,
    'OS disponível para inclusão em rota da tarde.',
    'Jennifer'
  );

  insertApp.run(
    'OS-2026-1007',
    'Valdir Santos (ABC Cargas)',
    '(11) 94122-9800',
    'ABC-5H88',
    'Scania R450 Plus',
    4,
    'INSTALACAO',
    'ALTA',
    'AGENDADO',
    tomorrow,
    '08:30',
    '10:30',
    '08:30 - 10:30',
    '08:30',
    90,
    'Av. Pereira Barreto, 1395 - Baeta Neves',
    'Baeta Neves',
    'São Bernardo do Campo',
    'SP',
    '09751-000',
    -23.6795,
    -46.5482,
    'Valdir Santos',
    'Painel lateral da cabine Scania',
    1,
    'Caminhão zero km aguardando ativação.',
    'David'
  );
}

initDb();

module.exports = {
  db,
  getLocalDateStr,
};
