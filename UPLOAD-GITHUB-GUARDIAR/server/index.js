const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, getLocalDateStr } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper: Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c * 1.32).toFixed(2));
}

function getSettingsMap() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

function getEnrichedAppointments(dateFilter = null, techFilter = null) {
  let sql = `
    SELECT
      a.*,
      a.contact_name AS client_name,
      t.name AS technician_name,
      t.badge AS technician_badge,
      t.color AS technician_color,
      t.fleet_vehicle AS technician_vehicle,
      t.fleet_plate AS technician_plate,
      t.base_lat AS technician_base_lat,
      t.base_lng AS technician_base_lng,
      t.base_address AS technician_base_address,
      tr.internal_code AS tracker_code,
      tr.brand_model AS tracker_model,
      tr.imei AS tracker_imei,
      tr.sim_carrier AS tracker_carrier,
      tr.technology AS tracker_technology
    FROM appointments a
    LEFT JOIN technicians t ON a.technician_id = t.id
    LEFT JOIN trackers tr ON a.tracker_id = tr.id
    WHERE 1=1
  `;
  const params = [];
  if (dateFilter) {
    sql += ' AND a.scheduled_date = ?';
    params.push(dateFilter);
  }
  if (techFilter && techFilter !== 'ALL' && techFilter !== 'ALL_DAY') {
    sql += ' AND a.technician_id = ?';
    params.push(Number(techFilter));
  }
  sql += ' ORDER BY a.scheduled_date ASC, CASE WHEN a.route_order > 0 THEN a.route_order ELSE 999 END ASC, a.window_start ASC, a.scheduled_time ASC';
  return db.prepare(sql).all(...params);
}

function buildGoogleMapsRouteUrl(stops) {
  if (!stops || stops.length === 0) return null;
  if (stops.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stops[0].lat},${stops[0].lng}&travelmode=driving`;
  }
  const first = stops[0];
  const last = stops[stops.length - 1];
  const origin = `${first.lat},${first.lng}`;
  const destination = `${last.lat},${last.lng}`;
  const waypointsList = stops.slice(1, -1).map((s) => `${s.lat},${s.lng}`);

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });
  if (waypointsList.length > 0) {
    params.set('waypoints', waypointsList.join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// POST /api/login - Authenticate internal operator (David, Sarah, Jennifer) OR Field Technician (password: 1234)
app.post('/api/login', (req, res) => {
  try {
    const { username = '', password = '', loginType = 'operator', technicianId = null } = req.body || {};

    if (String(password).trim() !== '1234') {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    if (loginType === 'technician') {
      let tech = null;
      if (technicianId) {
        tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(Number(technicianId));
      }
      if (!tech && username) {
        const q = String(username).trim().toLowerCase();
        const allTechs = db.prepare('SELECT * FROM technicians ORDER BY id ASC').all();
        tech = allTechs.find(
          (t) =>
            t.badge.toLowerCase() === q ||
            t.name.toLowerCase() === q ||
            t.name.toLowerCase().includes(q)
        );
      }

      if (!tech) {
        return res.status(401).json({ error: 'Técnico não encontrado.' });
      }

      return res.json({
        user: {
          id: `tech-${tech.id}`,
          technician_id: tech.id,
          accountType: 'TECHNICIAN',
          name: tech.name,
          username: tech.badge,
          role: `Técnico de Campo • ${tech.region}`,
          badge: tech.badge,
          department: tech.fleet_vehicle,
          color: tech.color,
        },
      });
    }

    const user = db
      .prepare('SELECT id, username, role, badge, department, password FROM users WHERE LOWER(username) = LOWER(?) AND active = 1')
      .get(String(username).trim());

    if (!user || String(user.password) !== String(password).trim()) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    res.json({
      user: {
        id: user.id,
        accountType: 'OPERATOR',
        name: user.username,
        username: user.username,
        role: user.role,
        badge: user.badge,
        department: user.department,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bootstrap
app.get('/api/bootstrap', (req, res) => {
  try {
    const settings = getSettingsMap();
    const users = db
      .prepare('SELECT id, username as name, username, role, badge, department FROM users WHERE active = 1 ORDER BY id ASC')
      .all();
    const technicians = db
      .prepare('SELECT * FROM technicians ORDER BY id ASC')
      .all()
      .map((t) => ({
        ...t,
        skills: JSON.parse(t.skills || '[]'),
      }));
    const trackers = db.prepare('SELECT * FROM trackers ORDER BY id ASC').all();
    const appointments = getEnrichedAppointments();

    res.json({
      today: getLocalDateStr(0),
      settings,
      employees: users,
      technicians,
      trackers,
      appointments,
    });
  } catch (err) {
    console.error('Error in /api/bootstrap:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
app.put('/api/settings', (req, res) => {
  try {
    const updates = req.body || {};
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(updates)) {
      stmt.run(k, String(v ?? ''));
    }
    res.json({ settings: getSettingsMap() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Known Minas Gerais (BH & Região Metropolitana) coordinates fallback dictionary
const MG_GEO_DICTIONARY = [
  { match: ['sena madureira', 'ouro preto', '31330'], lat: -19.87404, lng: -43.98780 },
  { match: ['joao gomide leite', 'joão gomide leite'], lat: -19.90559, lng: -44.02287 },
  { match: ['canelinha'], lat: -19.90512, lng: -44.01951 },
  { match: ['pindorama', '30865', 'coqueiros', 'gloria', 'glória', 'alipio de melo', 'alípio de melo'], lat: -19.9055, lng: -44.0210 },
  { match: ['castelo', 'fleming', 'serrano', 'santa terezinha', 'itamarati'], lat: -19.8825, lng: -43.9991 },
  { match: ['pampulha', 'sao luiz', 'são luiz', 'bandeirantes', 'itapoa', 'itapoã', 'planalto'], lat: -19.8588, lng: -43.9729 },
  { match: ['padre eustaquio', 'padre eustáquio', 'caicara', 'caiçara', 'carlos prates', 'coreu'], lat: -19.9145, lng: -43.9789 },
  { match: ['savassi', 'funcionarios', 'funcionários', 'contorno', 'lourdes', 'sion', 'anchieta', '30110'], lat: -19.9386, lng: -43.9352 },
  { match: ['centro', 'afonso pena', 'amazonas', 'barro preto', 'santa efigenia', 'santa efigênia', 'floresta', '30130'], lat: -19.9191, lng: -43.9386 },
  { match: ['venda nova', 'padre pedro pinto', 'mantiqueira', 'ceu azul', 'céu azul', '31510'], lat: -19.8157, lng: -43.9542 },
  { match: ['barreiro', 'sinfronio brochado', 'milionarios', 'milionários', 'lindeia', '30640'], lat: -19.9748, lng: -44.0145 },
  { match: ['buritis', 'raja gabaglia', 'estoril', 'palmeiras', 'belvedere', '30455'], lat: -19.9712, lng: -43.9658 },
  { match: ['cidade nova', 'cristiano machado', 'uniao', 'união', 'ipiranga', 'sagrada familia', 'sagrada família'], lat: -19.8889, lng: -43.9278 },
  { match: ['contagem', 'eldorado', 'industrial', 'nacional', 'ressaca', '32310'], lat: -19.9462, lng: -44.0341 },
  { match: ['betim', 'alterosas', 'ptb', '32600'], lat: -19.9677, lng: -44.1984 },
  { match: ['esmeraldas', '35740'], lat: -19.7625, lng: -44.3139 },
  { match: ['ribeirao das neves', 'ribeirão das neves', 'justinopolis', 'justinópolis'], lat: -19.7669, lng: -44.0867 },
  { match: ['santa luzia', 'sao benedito', 'são benedito'], lat: -19.7697, lng: -43.8514 },
  { match: ['sabara', 'sabará'], lat: -19.8844, lng: -43.8067 },
  { match: ['ibirite', 'ibirité', 'sarzedo', 'mario campos', 'mário campos'], lat: -20.0219, lng: -44.0589 },
  { match: ['nova lima', 'vila da serra', 'jardim canada', 'jardim canadá'], lat: -19.9856, lng: -43.8467 },
  { match: ['lagoa santa', 'vespasiano', 'confins', 'pedro leopoldo'], lat: -19.6292, lng: -43.8897 },
  { match: ['sete lagoas'], lat: -19.4658, lng: -44.2467 },
];

async function queryNominatim(queryStr) {
  if (!queryStr || !queryStr.trim()) return null;
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(queryStr)}`;
    const nomRes = await fetch(nomUrl, {
      headers: { 'User-Agent': 'GuardiarRastreamentosInternal/2.0' },
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        return {
          lat: parseFloat(nomData[0].lat),
          lng: parseFloat(nomData[0].lon),
        };
      }
    }
  } catch (_e) {
    // ignore
  }
  return null;
}

async function resolveAddressCoordinates({
  address = '',
  neighborhood = '',
  city = 'Belo Horizonte',
  state = 'MG',
  cep = '',
}) {
  const settings = getSettingsMap();
  const googleApiKey = settings.google_maps_api_key || '';

  const effectiveCity =
    !city || city.toLowerCase() === 'são paulo' || city.toLowerCase() === 'sao paulo'
      ? 'Belo Horizonte'
      : city;
  const effectiveState = !state || state.toUpperCase() === 'SP' ? 'MG' : state.toUpperCase();

  let addressData = {
    address: address,
    neighborhood: neighborhood,
    city: effectiveCity,
    state: effectiveState,
    cep: cep,
    lat: null,
    lng: null,
    source: 'fallback',
  };

  // 1. ViaCEP lookup if 8-digit CEP is provided
  const cleanCep = String(cep || '').replace(/\D/g, '');
  if (cleanCep.length === 8) {
    try {
      const viaRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (viaRes.ok) {
        const viaJson = await viaRes.json();
        if (!viaJson.erro) {
          if (!addressData.address) addressData.address = viaJson.logradouro || '';
          if (!addressData.neighborhood) addressData.neighborhood = viaJson.bairro || '';
          addressData.city = viaJson.localidade || addressData.city;
          addressData.state = viaJson.uf || addressData.state;
          addressData.cep = viaJson.cep || cep;
        }
      }
    } catch (_e) {
      // Ignore ViaCEP error
    }
  }

  // Strip house numbers and complements to also have a clean street name fallback
  const streetOnly = String(addressData.address || '')
    .replace(/,\s*\d+.*$/g, '')
    .replace(/\s+\d+.*$/g, '')
    .trim();

  const fullQuery = [addressData.address, addressData.neighborhood, addressData.city, addressData.state, 'Brasil']
    .filter(Boolean)
    .join(', ');

  // 2. Google Maps Geocoding API if key is set
  if (googleApiKey && fullQuery) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullQuery)}&key=${encodeURIComponent(googleApiKey)}`;
      const gRes = await fetch(gUrl);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.status === 'OK' && gData.results?.[0]?.geometry?.location) {
          addressData.lat = gData.results[0].geometry.location.lat;
          addressData.lng = gData.results[0].geometry.location.lng;
          addressData.source = 'google_maps';
          return addressData;
        }
      }
    } catch (_e) {
      // Fallback
    }
  }

  // 3. Dictionary quick check for exact known streets/neighborhoods in BH/MG
  const normalizedAll = `${addressData.address} ${addressData.neighborhood} ${addressData.city} ${cleanCep}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 4. Nominatim multi-step queries (Full -> Street without number -> Neighborhood -> City)
  const candidateQueries = [
    fullQuery,
    streetOnly && streetOnly !== addressData.address
      ? [streetOnly, addressData.neighborhood, addressData.city, addressData.state, 'Brasil'].filter(Boolean).join(', ')
      : null,
    streetOnly
      ? [streetOnly, addressData.city, addressData.state, 'Brasil'].filter(Boolean).join(', ')
      : null,
    addressData.neighborhood
      ? [addressData.neighborhood, addressData.city, addressData.state, 'Brasil'].filter(Boolean).join(', ')
      : null,
    [addressData.city, addressData.state, 'Brasil'].filter(Boolean).join(', '),
  ].filter(Boolean);

  for (const qStr of candidateQueries) {
    const found = await queryNominatim(qStr);
    if (found && found.lat && found.lng) {
      addressData.lat = Number(found.lat.toFixed(6));
      addressData.lng = Number(found.lng.toFixed(6));
      addressData.source = 'nominatim_osm';
      return addressData;
    }
  }

  // 5. Fallback to MG dictionary
  const matched = MG_GEO_DICTIONARY.find((entry) =>
    entry.match.some((kw) => {
      const cleanKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedAll.includes(cleanKw);
    })
  );

  if (matched) {
    const jitterLat = (Math.random() - 0.5) * 0.0015;
    const jitterLng = (Math.random() - 0.5) * 0.0015;
    addressData.lat = Number((matched.lat + jitterLat).toFixed(6));
    addressData.lng = Number((matched.lng + jitterLng).toFixed(6));
    addressData.source = 'mg_dictionary';
  } else {
    addressData.lat = Number(settings.hq_lat || -19.87404);
    addressData.lng = Number(settings.hq_lng || -43.98780);
    addressData.source = 'bh_base_default';
  }

  return addressData;
}

// POST /api/appointments - Create internal OS with automatic MG geocoding
app.post('/api/appointments', async (req, res) => {
  try {
    const {
      contact_name = '',
      contact_phone = '',
      vehicle_plate = '',
      vehicle_model = '',
      technician_id = null,
      tracker_id = null,
      service_type = 'INSTALACAO',
      priority = 'NORMAL',
      status = 'AGENDADO',
      scheduled_date,
      window_start = '08:00',
      window_end = '10:00',
      scheduled_time,
      estimated_duration_min = 60,
      address = '',
      neighborhood = '',
      city = 'Belo Horizonte',
      state = 'MG',
      cep = '',
      lat,
      lng,
      onsite_authorized_person = '',
      install_hidden_spot = '',
      internal_notes = '',
      created_by = 'David',
    } = req.body;

    const lastOs = db.prepare('SELECT id FROM appointments ORDER BY id DESC LIMIT 1').get();
    const nextNum = 1001 + (lastOs ? lastOs.id : 0);
    const os_number = `OS-2026-${nextNum}`;

    const computedTimeWindow = `${window_start} - ${window_end}`;
    const computedScheduledTime = scheduled_time || window_start || '08:00';
    const computedStatus = status || 'AGENDADO';

    let routeOrder = 0;
    if (technician_id) {
      const maxRow = db
        .prepare('SELECT COALESCE(MAX(route_order), 0) AS max_order FROM appointments WHERE technician_id = ? AND scheduled_date = ?')
        .get(Number(technician_id), scheduled_date);
      routeOrder = (maxRow?.max_order || 0) + 1;
    }

    // Automatically geocode if lat/lng is missing, is in SP (-23.x), or equals the default base coordinates
    let finalLat = Number(lat);
    let finalLng = Number(lng);
    let finalCity = !city || city === 'São Paulo' ? 'Belo Horizonte' : city;
    let finalState = !state || state === 'SP' ? 'MG' : state;

    const isDefaultOrSpCoord =
      !finalLat ||
      !finalLng ||
      finalLat < -22.0 ||
      (Math.abs(finalLat - -19.87404) < 0.0002 && Math.abs(finalLng - -43.98780) < 0.0002);

    if (isDefaultOrSpCoord && (address || neighborhood || cep)) {
      const geo = await resolveAddressCoordinates({
        address,
        neighborhood,
        city: finalCity,
        state: finalState,
        cep,
      });
      finalLat = geo.lat || -19.87404;
      finalLng = geo.lng || -43.98780;
      finalCity = geo.city || finalCity;
      finalState = geo.state || finalState;
    }

    const result = db.prepare(`
      INSERT INTO appointments (
        os_number, contact_name, contact_phone, vehicle_plate, vehicle_model,
        technician_id, tracker_id, service_type, priority, status,
        scheduled_date, window_start, window_end, time_window, scheduled_time,
        estimated_duration_min, address, neighborhood, city, state, cep,
        lat, lng, onsite_authorized_person, install_hidden_spot,
        route_order, internal_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      os_number,
      contact_name.trim(),
      contact_phone.trim(),
      vehicle_plate.toUpperCase().trim(),
      vehicle_model.trim(),
      technician_id ? Number(technician_id) : null,
      tracker_id ? Number(tracker_id) : null,
      service_type,
      priority,
      computedStatus,
      scheduled_date,
      window_start,
      window_end,
      computedTimeWindow,
      computedScheduledTime,
      Number(estimated_duration_min) || 60,
      address,
      neighborhood,
      finalCity,
      finalState,
      cep,
      finalLat || -19.87404,
      finalLng || -43.98780,
      onsite_authorized_person || contact_name,
      install_hidden_spot,
      routeOrder,
      internal_notes,
      created_by
    );

    const created = getEnrichedAppointments().find((a) => a.id === Number(result.lastInsertRowid));
    res.status(201).json({ appointment: created });
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/appointments/:id - Update OS with automatic MG geocoding
app.put('/api/appointments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Ordem de Serviço não encontrada.' });
    }

    const {
      contact_name = existing.contact_name,
      contact_phone = existing.contact_phone,
      vehicle_plate = existing.vehicle_plate,
      vehicle_model = existing.vehicle_model,
      technician_id = existing.technician_id,
      tracker_id = existing.tracker_id,
      service_type = existing.service_type,
      priority = existing.priority,
      status = existing.status,
      scheduled_date = existing.scheduled_date,
      window_start = existing.window_start || '08:00',
      window_end = existing.window_end || '10:00',
      scheduled_time,
      estimated_duration_min = existing.estimated_duration_min,
      address = existing.address,
      neighborhood = existing.neighborhood,
      city = existing.city,
      state = existing.state,
      cep = existing.cep,
      lat = existing.lat,
      lng = existing.lng,
      onsite_authorized_person = existing.onsite_authorized_person,
      install_hidden_spot = existing.install_hidden_spot,
      route_order = existing.route_order,
      internal_notes = existing.internal_notes,
    } = req.body;

    const computedTimeWindow = `${window_start} - ${window_end}`;
    const computedScheduledTime = scheduled_time || window_start || existing.scheduled_time;

    let finalLat = Number(lat);
    let finalLng = Number(lng);
    let finalCity = !city || city === 'São Paulo' ? 'Belo Horizonte' : city;
    let finalState = !state || state === 'SP' ? 'MG' : state;

    const addressChanged =
      address !== existing.address ||
      neighborhood !== existing.neighborhood ||
      cep !== existing.cep ||
      city !== existing.city;

    const isSpOrDefault =
      !finalLat ||
      !finalLng ||
      finalLat < -22.0 ||
      (Math.abs(finalLat - -19.87404) < 0.0002 && Math.abs(finalLng - -43.98780) < 0.0002);

    if ((addressChanged || isSpOrDefault) && (address || neighborhood || cep)) {
      const geo = await resolveAddressCoordinates({
        address,
        neighborhood,
        city: finalCity,
        state: finalState,
        cep,
      });
      if (geo.lat && geo.lng) {
        finalLat = geo.lat;
        finalLng = geo.lng;
        finalCity = geo.city || finalCity;
        finalState = geo.state || finalState;
      }
    }

    db.prepare(`
      UPDATE appointments SET
        contact_name = ?, contact_phone = ?, vehicle_plate = ?, vehicle_model = ?,
        technician_id = ?, tracker_id = ?, service_type = ?, priority = ?, status = ?,
        scheduled_date = ?, window_start = ?, window_end = ?, time_window = ?, scheduled_time = ?,
        estimated_duration_min = ?, address = ?, neighborhood = ?, city = ?, state = ?, cep = ?,
        lat = ?, lng = ?, onsite_authorized_person = ?, install_hidden_spot = ?,
        route_order = ?, internal_notes = ?,
        completed_at = CASE WHEN ? = 'CONCLUIDO' AND completed_at IS NULL THEN datetime('now', 'localtime') ELSE completed_at END
      WHERE id = ?
    `).run(
      contact_name.trim(),
      contact_phone.trim(),
      vehicle_plate.toUpperCase().trim(),
      vehicle_model.trim(),
      technician_id ? Number(technician_id) : null,
      tracker_id ? Number(tracker_id) : null,
      service_type,
      priority,
      status,
      scheduled_date,
      window_start,
      window_end,
      computedTimeWindow,
      computedScheduledTime,
      Number(estimated_duration_min) || 60,
      address,
      neighborhood,
      finalCity,
      finalState,
      cep,
      finalLat,
      finalLng,
      onsite_authorized_person,
      install_hidden_spot,
      Number(route_order || 0),
      internal_notes,
      status,
      id
    );

    const updated = getEnrichedAppointments().find((a) => a.id === id);
    res.json({ appointment: updated });
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/appointments/:id/status - Quick status or technician assignment/unassignment
app.patch('/api/appointments/:id/status', (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, technician_id, route_order, install_hidden_spot, internal_notes } = req.body;
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'OS não encontrada' });

    const newTechId =
      technician_id !== undefined
        ? technician_id
          ? Number(technician_id)
          : null
        : existing.technician_id;

    let newStatus = status || existing.status;
    if (technician_id !== undefined && newTechId && existing.status === 'PENDENTE_ROTA' && !status) {
      newStatus = 'AGENDADO';
    }

    let newOrder = route_order !== undefined ? Number(route_order) : existing.route_order;
    if (newTechId && newOrder === 0) {
      const maxRow = db
        .prepare('SELECT COALESCE(MAX(route_order), 0) AS max_order FROM appointments WHERE technician_id = ? AND scheduled_date = ? AND id != ?')
        .get(newTechId, existing.scheduled_date, id);
      newOrder = (maxRow?.max_order || 0) + 1;
    } else if (!newTechId && technician_id === null) {
      newOrder = 0;
    }

    db.prepare(`
      UPDATE appointments SET
        status = ?,
        technician_id = ?,
        route_order = ?,
        install_hidden_spot = COALESCE(?, install_hidden_spot),
        internal_notes = COALESCE(?, internal_notes),
        completed_at = CASE WHEN ? = 'CONCLUIDO' THEN datetime('now', 'localtime') ELSE completed_at END
      WHERE id = ?
    `).run(
      newStatus,
      newTechId,
      newOrder,
      install_hidden_spot !== undefined ? install_hidden_spot : null,
      internal_notes !== undefined ? internal_notes : null,
      newStatus,
      id
    );

    const updated = getEnrichedAppointments().find((a) => a.id === id);
    res.json({ appointment: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/appointments/:id
app.delete('/api/appointments/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/routes/optimize - Optimize route starting ALWAYS from the 1st service
app.post('/api/routes/optimize', (req, res) => {
  try {
    const {
      date,
      technician_id, // number or 'ALL_DAY'
      mode = 'time_window_proximity',
      custom_order_ids = null,
    } = req.body;

    const settings = getSettingsMap();
    let tech = null;
    if (technician_id && technician_id !== 'ALL_DAY' && technician_id !== 'ALL') {
      tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(Number(technician_id));
    }

    const allTechApps = getEnrichedAppointments(
      date,
      tech ? tech.id : null
    ).filter((a) => a.status !== 'CANCELADO');

    if (allTechApps.length === 0) {
      return res.json({
        origin: null,
        stops: [],
        metrics: { total_distance_km: 0, total_drive_min: 0, total_service_min: 0, total_day_min: 0 },
        google_maps_url: null,
      });
    }

    const parseMinutes = (tStr = '08:00') => {
      const [h, m] = String(tStr).split(':').map(Number);
      return (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    let orderedStops = [];

    if (Array.isArray(custom_order_ids) && custom_order_ids.length > 0) {
      const mapById = new Map(allTechApps.map((a) => [a.id, a]));
      for (const id of custom_order_ids) {
        if (mapById.has(Number(id))) {
          orderedStops.push(mapById.get(Number(id)));
          mapById.delete(Number(id));
        }
      }
      for (const rem of mapById.values()) {
        orderedStops.push(rem);
      }
    } else if (mode === 'proximity') {
      // Start at the earliest scheduled appointment, then chain nearest neighbor from there
      const sortedByTime = [...allTechApps].sort(
        (a, b) =>
          parseMinutes(a.window_start || a.scheduled_time) -
          parseMinutes(b.window_start || b.scheduled_time)
      );
      const firstStop = sortedByTime.shift();
      orderedStops.push(firstStop);
      let curLat = firstStop.lat;
      let curLng = firstStop.lng;

      while (sortedByTime.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < sortedByTime.length; i++) {
          const d = haversineKm(curLat, curLng, sortedByTime[i].lat, sortedByTime[i].lng);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        const chosen = sortedByTime.splice(bestIdx, 1)[0];
        orderedStops.push(chosen);
        curLat = chosen.lat;
        curLng = chosen.lng;
      }
    } else {
      // 'time_window_proximity': Start at earliest appointment, then group by time bucket & proximity
      const sortedByTime = [...allTechApps].sort(
        (a, b) =>
          parseMinutes(a.window_start || a.scheduled_time) -
          parseMinutes(b.window_start || b.scheduled_time)
      );
      const firstStop = sortedByTime.shift();
      orderedStops.push(firstStop);
      let curLat = firstStop.lat;
      let curLng = firstStop.lng;

      const buckets = new Map();
      for (const appItem of sortedByTime) {
        const startMin = parseMinutes(appItem.window_start || appItem.scheduled_time);
        const bucketKey = Math.floor(startMin / 90);
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
        buckets.get(bucketKey).push(appItem);
      }

      const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);

      for (const k of sortedKeys) {
        const group = buckets.get(k);
        while (group.length > 0) {
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < group.length; i++) {
            const d = haversineKm(curLat, curLng, group[i].lat, group[i].lng);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          const chosen = group.splice(bestIdx, 1)[0];
          orderedStops.push(chosen);
          curLat = chosen.lat;
          curLng = chosen.lng;
        }
      }
    }

    const updateOrderStmt = db.prepare('UPDATE appointments SET route_order = ? WHERE id = ?');
    orderedStops.forEach((stop, idx) => {
      stop.route_order = idx + 1;
      updateOrderStmt.run(idx + 1, stop.id);
    });

    const avgSpeedKmh = Number(settings.default_urban_speed_kmh || 28);
    const bufferMin = Number(settings.buffer_between_os_min || 15);

    const formatTimeMin = (totalMin) => {
      const h = Math.floor(totalMin / 60) % 24;
      const m = Math.round(totalMin % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const firstService = orderedStops[0];
    let currentMinutesOfDay = parseMinutes(firstService.window_start || firstService.scheduled_time || '08:00');
    let prevLat = firstService.lat;
    let prevLng = firstService.lng;
    let totalDistanceKm = 0;
    let totalDriveMin = 0;
    let totalServiceMin = 0;

    const enrichedStops = orderedStops.map((stop, idx) => {
      let legDistanceKm = 0;
      let legDriveMin = 0;

      if (idx > 0) {
        legDistanceKm = haversineKm(prevLat, prevLng, stop.lat, stop.lng);
        legDriveMin = Math.max(5, Math.round((legDistanceKm / avgSpeedKmh) * 60));
        currentMinutesOfDay += legDriveMin;
      }

      const startStr = stop.window_start || stop.scheduled_time || '08:00';
      const schedMin = parseMinutes(startStr);
      const startServiceMin = idx === 0 ? schedMin : Math.max(currentMinutesOfDay, schedMin);
      const etaArrival = formatTimeMin(startServiceMin);
      const finishServiceMin = startServiceMin + (stop.estimated_duration_min || 60);
      const etaDeparture = formatTimeMin(finishServiceMin);

      const singleStopGoogleMapsUrl =
        idx === 0
          ? `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`
          : `https://www.google.com/maps/dir/?api=1&origin=${prevLat},${prevLng}&destination=${stop.lat},${stop.lng}&travelmode=driving`;

      currentMinutesOfDay = finishServiceMin + bufferMin;
      prevLat = stop.lat;
      prevLng = stop.lng;

      totalDistanceKm += legDistanceKm;
      totalDriveMin += legDriveMin;
      totalServiceMin += stop.estimated_duration_min || 60;

      return {
        ...stop,
        stop_number: idx + 1,
        leg_distance_km: legDistanceKm,
        leg_drive_min: legDriveMin,
        eta_arrival: etaArrival,
        eta_departure: etaDeparture,
        is_late_warning: false,
        google_maps_nav_url: singleStopGoogleMapsUrl,
      };
    });

    const googleMapsUrl = buildGoogleMapsRouteUrl(enrichedStops);

    res.json({
      origin: {
        lat: firstService.lat,
        lng: firstService.lng,
        address: `${firstService.address} — ${firstService.neighborhood} (${firstService.city})`,
        label: `1º Serviço: ${firstService.contact_name || firstService.client_name}`,
      },
      technician: tech
        ? {
            ...tech,
            skills: JSON.parse(tech.skills || '[]'),
          }
        : null,
      stops: enrichedStops,
      return_to_base: {
        enabled: false,
        distance_km: 0,
        drive_min: 0,
      },
      metrics: {
        total_distance_km: Number(totalDistanceKm.toFixed(2)),
        total_drive_min: totalDriveMin,
        total_service_min: totalServiceMin,
        total_day_min: totalDriveMin + totalServiceMin,
      },
      google_maps_url: googleMapsUrl,
    });
  } catch (err) {
    console.error('Error optimizing route:', err);
    res.status(500).json({ error: err.message });
  }
});

// CRUD Technicians (including DELETE to remove technician!)
app.post('/api/technicians', (req, res) => {
  try {
    const {
      name,
      badge,
      internal_phone,
      fleet_vehicle,
      fleet_plate,
      region,
      base_address = 'Rua Sena Madureira, 253 - Ouro Preto, Belo Horizonte - MG',
      base_lat = -19.87404,
      base_lng = -43.98780,
      color = '#12303e',
      skills = ['12V', 'Rastreamento'],
      status = 'DISPONIVEL',
      max_daily_os = 6,
    } = req.body;

    const result = db.prepare(`
      INSERT INTO technicians (name, badge, internal_phone, fleet_vehicle, fleet_plate, region, base_address, base_lat, base_lng, color, skills, status, max_daily_os)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      badge,
      internal_phone,
      fleet_vehicle,
      fleet_plate,
      region,
      base_address,
      Number(base_lat),
      Number(base_lng),
      color,
      JSON.stringify(Array.isArray(skills) ? skills : [skills]),
      status,
      Number(max_daily_os)
    );

    const created = db.prepare('SELECT * FROM technicians WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({
      technician: { ...created, skills: JSON.parse(created.skills || '[]') },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/technicians/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Técnico não encontrado' });

    const {
      name = existing.name,
      badge = existing.badge,
      internal_phone = existing.internal_phone,
      fleet_vehicle = existing.fleet_vehicle,
      fleet_plate = existing.fleet_plate,
      region = existing.region,
      base_address = existing.base_address,
      base_lat = existing.base_lat,
      base_lng = existing.base_lng,
      color = existing.color,
      skills,
      status = existing.status,
      max_daily_os = existing.max_daily_os,
    } = req.body;

    const skillsJson = skills ? JSON.stringify(Array.isArray(skills) ? skills : [skills]) : existing.skills;

    db.prepare(`
      UPDATE technicians SET
        name = ?, badge = ?, internal_phone = ?, fleet_vehicle = ?, fleet_plate = ?,
        region = ?, base_address = ?, base_lat = ?, base_lng = ?, color = ?,
        skills = ?, status = ?, max_daily_os = ?
      WHERE id = ?
    `).run(
      name,
      badge,
      internal_phone,
      fleet_vehicle,
      fleet_plate,
      region,
      base_address,
      Number(base_lat),
      Number(base_lng),
      color,
      skillsJson,
      status,
      Number(max_daily_os),
      id
    );

    const updated = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id);
    res.json({ technician: { ...updated, skills: JSON.parse(updated.skills || '[]') } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/technicians/:id - Remove technician and unlink appointments
app.delete('/api/technicians/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    db.prepare('UPDATE appointments SET technician_id = NULL, route_order = 0 WHERE technician_id = ?').run(id);
    db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD Trackers
app.post('/api/trackers', (req, res) => {
  try {
    const {
      internal_code,
      brand_model,
      imei,
      sim_iccid,
      sim_carrier,
      technology = '4G Rastreamento',
      status = 'DISPONIVEL',
      notes = '',
    } = req.body;

    const result = db.prepare(`
      INSERT INTO trackers (internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, notes);

    const created = db.prepare('SELECT * FROM trackers WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json({ tracker: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trackers/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Equipamento não encontrado' });

    const {
      internal_code = existing.internal_code,
      brand_model = existing.brand_model,
      imei = existing.imei,
      sim_iccid = existing.sim_iccid,
      sim_carrier = existing.sim_carrier,
      technology = existing.technology,
      status = existing.status,
      assigned_vehicle_plate = existing.assigned_vehicle_plate,
      notes = existing.notes,
    } = req.body;

    db.prepare(`
      UPDATE trackers SET
        internal_code = ?, brand_model = ?, imei = ?, sim_iccid = ?,
        sim_carrier = ?, technology = ?, status = ?, assigned_vehicle_plate = ?, notes = ?
      WHERE id = ?
    `).run(internal_code, brand_model, imei, sim_iccid, sim_carrier, technology, status, assigned_vehicle_plate, notes, id);

    const updated = db.prepare('SELECT * FROM trackers WHERE id = ?').get(id);
    res.json({ tracker: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/geocode
app.get('/api/geocode', async (req, res) => {
  try {
    const {
      q = '',
      address = '',
      neighborhood = '',
      city = 'Belo Horizonte',
      state = 'MG',
      cep = '',
    } = req.query;

    const addressData = await resolveAddressCoordinates({
      address: address || q,
      neighborhood,
      city,
      state,
      cep,
    });

    res.json(addressData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-fix any appointments in DB that were saved with SP coordinates (-23.x)
async function fixMisplacedAppointmentsOnStartup() {
  try {
    const rows = db.prepare('SELECT * FROM appointments WHERE lat < -21.5').all();
    for (const r of rows) {
      const geo = await resolveAddressCoordinates({
        address: r.address,
        neighborhood: r.neighborhood,
        city: 'Belo Horizonte',
        state: 'MG',
        cep: r.cep,
      });
      if (geo.lat && geo.lng) {
        db.prepare('UPDATE appointments SET lat = ?, lng = ?, city = ?, state = ? WHERE id = ?').run(
          geo.lat,
          geo.lng,
          geo.city || 'Belo Horizonte',
          geo.state || 'MG',
          r.id
        );
      }
    }
  } catch (_e) {
    // ignore
  }
}
fixMisplacedAppointmentsOnStartup();

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA Fallback for production build
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexHtml = path.join(distPath, 'index.html');
    return res.sendFile(indexHtml, (err) => {
      if (err) next();
    });
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Guardiar Rastreamentos Backend] Servidor interno rodando na porta ${PORT}`);
});
