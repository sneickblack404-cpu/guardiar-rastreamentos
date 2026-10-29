const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_wSOZUH4Enf1x@ep-sparkling-glade-b5fo0gh8-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

function toSqliteVal(val) {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val.toISOString().replace('T', ' ').substring(0, 19);
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

let pool = null;

function getPool() {
  if (!pool && DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => {
      console.error('[Neon Postgres Pool Error]:', err.message);
    });
  }
  return pool;
}

async function initNeonSchema() {
  const p = getPool();
  if (!p) return;

  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        badge TEXT NOT NULL,
        department TEXT NOT NULL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS technicians (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        badge TEXT NOT NULL UNIQUE,
        internal_phone TEXT NOT NULL,
        fleet_vehicle TEXT NOT NULL,
        fleet_plate TEXT NOT NULL,
        region TEXT NOT NULL,
        base_address TEXT NOT NULL,
        base_lat DOUBLE PRECISION NOT NULL,
        base_lng DOUBLE PRECISION NOT NULL,
        color TEXT NOT NULL,
        skills TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DISPONIVEL',
        max_daily_os INTEGER DEFAULT 6
      );

      CREATE TABLE IF NOT EXISTS trackers (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
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
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        onsite_authorized_person TEXT NOT NULL DEFAULT '',
        install_hidden_spot TEXT DEFAULT '',
        route_order INTEGER DEFAULT 0,
        internal_notes TEXT DEFAULT '',
        created_by TEXT NOT NULL DEFAULT 'David',
        created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        completed_at TEXT
      );
    `);
    console.log('[Neon Postgres] Tabelas prontas e verificadas com sucesso na nuvem!');
  } catch (err) {
    console.error('[Neon Postgres Init Error]:', err);
  }
}

// Initial Sync: On startup, if Neon has data, pull to SQLite. If Neon is empty, push SQLite to Neon!
async function syncOnStartup(sqliteDb) {
  const p = getPool();
  if (!p) return;

  try {
    await initNeonSchema();

    const usersCountRes = await p.query('SELECT COUNT(*) as total FROM users');
    const hasCloudData = Number(usersCountRes.rows[0]?.total || 0) > 0;

    if (!hasCloudData) {
      console.log('[Neon Postgres] Nuvem vazia. Semeando dados iniciais do SQLite para a Neon...');
      // Push Settings
      const settingsRows = sqliteDb.prepare('SELECT key, value FROM settings').all();
      for (const r of settingsRows) {
        await p.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          [r.key, r.value]
        );
      }

      // Push Users
      const userRows = sqliteDb.prepare('SELECT * FROM users').all();
      for (const u of userRows) {
        await p.query(
          'INSERT INTO users (id, username, password, role, badge, department, active) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (username) DO NOTHING',
          [u.id, u.username, u.password, u.role, u.badge, u.department, u.active]
        );
      }

      // Push Technicians
      const techRows = sqliteDb.prepare('SELECT * FROM technicians').all();
      for (const t of techRows) {
        await p.query(
          `INSERT INTO technicians (id, name, badge, internal_phone, fleet_vehicle, fleet_plate, region, base_address, base_lat, base_lng, color, skills, status, max_daily_os)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (badge) DO NOTHING`,
          [
            t.id,
            t.name,
            t.badge,
            t.internal_phone,
            t.fleet_vehicle,
            t.fleet_plate,
            t.region,
            t.base_address,
            t.base_lat,
            t.base_lng,
            t.color,
            t.skills,
            t.status,
            t.max_daily_os,
          ]
        );
      }

      // Push Trackers
      const trackerRows = sqliteDb.prepare('SELECT * FROM trackers').all();
      for (const tr of trackerRows) {
        await p.query(
          `INSERT INTO trackers (id, internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, assigned_vehicle_plate, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (internal_code) DO NOTHING`,
          [
            tr.id,
            tr.internal_code,
            tr.brand_model,
            tr.imei,
            tr.sim_iccid,
            tr.sim_carrier,
            tr.technology,
            tr.status,
            tr.assigned_vehicle_plate,
            tr.notes,
          ]
        );
      }

      // Push Appointments
      const appRows = sqliteDb.prepare('SELECT * FROM appointments').all();
      for (const a of appRows) {
        await p.query(
          `INSERT INTO appointments (id, os_number, contact_name, contact_phone, vehicle_plate, vehicle_model, technician_id, tracker_id, service_type, priority, status, scheduled_date, window_start, window_end, time_window, scheduled_time, estimated_duration_min, address, neighborhood, city, state, cep, lat, lng, onsite_authorized_person, install_hidden_spot, route_order, internal_notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
           ON CONFLICT (os_number) DO NOTHING`,
          [
            a.id,
            a.os_number,
            a.contact_name,
            a.contact_phone || '',
            a.vehicle_plate,
            a.vehicle_model,
            a.technician_id,
            a.tracker_id,
            a.service_type,
            a.priority,
            a.status,
            a.scheduled_date,
            a.window_start,
            a.window_end,
            a.time_window,
            a.scheduled_time,
            a.estimated_duration_min,
            a.address,
            a.neighborhood,
            a.city,
            a.state,
            a.cep,
            a.lat,
            a.lng,
            a.onsite_authorized_person,
            a.install_hidden_spot,
            a.route_order,
            a.internal_notes,
            a.created_by,
          ]
        );
      }
      console.log('[Neon Postgres] Sincronização inicial concluída: Banco Neon pronto!');
    } else {
      console.log('[Neon Postgres] Restaurando dados da nuvem Neon para o servidor local...');
      // Pull Settings
      const cloudSettings = await p.query('SELECT key, value FROM settings');
      const upsertSetting = sqliteDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      for (const r of cloudSettings.rows) {
        upsertSetting.run(r.key, r.value);
      }

      // Pull Users
      const cloudUsers = await p.query('SELECT * FROM users');
      const upsertUser = sqliteDb.prepare(`
        INSERT OR REPLACE INTO users (id, username, password, role, badge, department, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const u of cloudUsers.rows) {
        upsertUser.run(u.id, u.username, u.password, u.role, u.badge, u.department, u.active);
      }

      // Pull Technicians
      const cloudTechs = await p.query('SELECT * FROM technicians');
      const upsertTech = sqliteDb.prepare(`
        INSERT OR REPLACE INTO technicians (id, name, badge, internal_phone, fleet_vehicle, fleet_plate, region, base_address, base_lat, base_lng, color, skills, status, max_daily_os)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of cloudTechs.rows) {
        upsertTech.run(
          t.id,
          t.name,
          t.badge,
          t.internal_phone,
          t.fleet_vehicle,
          t.fleet_plate,
          t.region,
          t.base_address,
          t.base_lat,
          t.base_lng,
          t.color,
          t.skills,
          t.status,
          t.max_daily_os
        );
      }

      // Pull Trackers
      const cloudTrackers = await p.query('SELECT * FROM trackers');
      const upsertTracker = sqliteDb.prepare(`
        INSERT OR REPLACE INTO trackers (id, internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, assigned_vehicle_plate, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tr of cloudTrackers.rows) {
        upsertTracker.run(
          tr.id,
          tr.internal_code,
          tr.brand_model,
          tr.imei,
          tr.sim_iccid,
          tr.sim_carrier,
          tr.technology,
          tr.status,
          tr.assigned_vehicle_plate,
          tr.notes
        );
      }

      // Pull Appointments
      const cloudApps = await p.query('SELECT * FROM appointments ORDER BY id ASC');
      const upsertApp = sqliteDb.prepare(`
        INSERT OR REPLACE INTO appointments (id, os_number, contact_name, contact_phone, vehicle_plate, vehicle_model, technician_id, tracker_id, service_type, priority, status, scheduled_date, window_start, window_end, time_window, scheduled_time, estimated_duration_min, address, neighborhood, city, state, cep, lat, lng, onsite_authorized_person, install_hidden_spot, route_order, internal_notes, created_by, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of cloudApps.rows) {
        upsertApp.run(
          toSqliteVal(a.id),
          toSqliteVal(a.os_number),
          toSqliteVal(a.contact_name),
          toSqliteVal(a.contact_phone || ''),
          toSqliteVal(a.vehicle_plate),
          toSqliteVal(a.vehicle_model),
          a.technician_id != null ? Number(a.technician_id) : null,
          a.tracker_id != null ? Number(a.tracker_id) : null,
          toSqliteVal(a.service_type),
          toSqliteVal(a.priority),
          toSqliteVal(a.status),
          toSqliteVal(a.scheduled_date),
          toSqliteVal(a.window_start),
          toSqliteVal(a.window_end),
          toSqliteVal(a.time_window),
          toSqliteVal(a.scheduled_time),
          Number(a.estimated_duration_min) || 60,
          toSqliteVal(a.address),
          toSqliteVal(a.neighborhood),
          toSqliteVal(a.city),
          toSqliteVal(a.state),
          toSqliteVal(a.cep),
          a.lat != null ? Number(a.lat) : null,
          a.lng != null ? Number(a.lng) : null,
          toSqliteVal(a.onsite_authorized_person),
          toSqliteVal(a.install_hidden_spot),
          Number(a.route_order || 0),
          toSqliteVal(a.internal_notes),
          toSqliteVal(a.created_by),
          toSqliteVal(a.created_at),
          toSqliteVal(a.completed_at)
        );
      }
      console.log(
        `[Neon Postgres] Restaurado da nuvem: ${cloudApps.rows.length} agendamentos, ${cloudTechs.rows.length} técnicos.`
      );
    }
  } catch (err) {
    console.error('[Neon Postgres Sync Error]:', err);
  }
}

// Background persist functions for live changes
async function persistAppointment(appData, isDelete = false) {
  const p = getPool();
  if (!p) return;

  try {
    if (isDelete) {
      await p.query('DELETE FROM appointments WHERE id = $1', [appData.id]);
      return;
    }

    await p.query(
      `INSERT INTO appointments (id, os_number, contact_name, contact_phone, vehicle_plate, vehicle_model, technician_id, tracker_id, service_type, priority, status, scheduled_date, window_start, window_end, time_window, scheduled_time, estimated_duration_min, address, neighborhood, city, state, cep, lat, lng, onsite_authorized_person, install_hidden_spot, route_order, internal_notes, created_by, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
       ON CONFLICT (id) DO UPDATE SET
         contact_name = EXCLUDED.contact_name,
         contact_phone = EXCLUDED.contact_phone,
         vehicle_plate = EXCLUDED.vehicle_plate,
         vehicle_model = EXCLUDED.vehicle_model,
         technician_id = EXCLUDED.technician_id,
         tracker_id = EXCLUDED.tracker_id,
         service_type = EXCLUDED.service_type,
         priority = EXCLUDED.priority,
         status = EXCLUDED.status,
         scheduled_date = EXCLUDED.scheduled_date,
         window_start = EXCLUDED.window_start,
         window_end = EXCLUDED.window_end,
         time_window = EXCLUDED.time_window,
         scheduled_time = EXCLUDED.scheduled_time,
         estimated_duration_min = EXCLUDED.estimated_duration_min,
         address = EXCLUDED.address,
         neighborhood = EXCLUDED.neighborhood,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         cep = EXCLUDED.cep,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         onsite_authorized_person = EXCLUDED.onsite_authorized_person,
         install_hidden_spot = EXCLUDED.install_hidden_spot,
         route_order = EXCLUDED.route_order,
         internal_notes = EXCLUDED.internal_notes,
         completed_at = EXCLUDED.completed_at`,
      [
        appData.id,
        appData.os_number,
        appData.contact_name,
        appData.contact_phone || '',
        appData.vehicle_plate,
        appData.vehicle_model,
        appData.technician_id,
        appData.tracker_id,
        appData.service_type,
        appData.priority,
        appData.status,
        appData.scheduled_date,
        appData.window_start,
        appData.window_end,
        appData.time_window,
        appData.scheduled_time,
        appData.estimated_duration_min,
        appData.address,
        appData.neighborhood,
        appData.city,
        appData.state,
        appData.cep,
        appData.lat,
        appData.lng,
        appData.onsite_authorized_person,
        appData.install_hidden_spot,
        appData.route_order,
        appData.internal_notes,
        appData.created_by,
        appData.completed_at || null,
      ]
    );
  } catch (err) {
    console.error('[Neon Postgres Persist Appointment Error]:', err.message);
  }
}

async function persistSetting(key, value) {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
  } catch (err) {
    console.error('[Neon Postgres Persist Setting Error]:', err.message);
  }
}

async function persistTechnician(techData, isDelete = false) {
  const p = getPool();
  if (!p) return;
  try {
    if (isDelete) {
      await p.query('DELETE FROM technicians WHERE id = $1', [techData.id]);
      return;
    }
    await p.query(
      `INSERT INTO technicians (id, name, badge, internal_phone, fleet_vehicle, fleet_plate, region, base_address, base_lat, base_lng, color, skills, status, max_daily_os)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         badge = EXCLUDED.badge,
         internal_phone = EXCLUDED.internal_phone,
         fleet_vehicle = EXCLUDED.fleet_vehicle,
         fleet_plate = EXCLUDED.fleet_plate,
         region = EXCLUDED.region,
         base_address = EXCLUDED.base_address,
         base_lat = EXCLUDED.base_lat,
         base_lng = EXCLUDED.base_lng,
         color = EXCLUDED.color,
         skills = EXCLUDED.skills,
         status = EXCLUDED.status,
         max_daily_os = EXCLUDED.max_daily_os`,
      [
        techData.id,
        techData.name,
        techData.badge,
        techData.internal_phone,
        techData.fleet_vehicle,
        techData.fleet_plate,
        techData.region,
        techData.base_address,
        techData.base_lat,
        techData.base_lng,
        techData.color,
        techData.skills,
        techData.status,
        techData.max_daily_os,
      ]
    );
  } catch (err) {
    console.error('[Neon Postgres Persist Tech Error]:', err.message);
  }
}

module.exports = {
  getPool,
  initNeonSchema,
  syncOnStartup,
  persistAppointment,
  persistSetting,
  persistTechnician,
};
