import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'safety.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      rfid         TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      contact      TEXT,
      medical_notes TEXT,
      role         TEXT DEFAULT 'worker',
      created_at   INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id     TEXT NOT NULL,
      rfid          TEXT,
      timestamp     INTEGER NOT NULL,
      bpm           REAL,
      spo2          REAL,
      temperature   REAL,
      humidity      REAL,
      gas_ppm       REAL,
      smoke_detected INTEGER DEFAULT 0,
      sound_db      REAL,
      accel_x       REAL,
      accel_y       REAL,
      accel_z       REAL,
      gyro_x        REAL,
      gyro_y        REAL,
      gyro_z        REAL,
      pressure_hpa  REAL,
      altitude_m    REAL,
      battery_pct   REAL,
      wifi_rssi     INTEGER,
      sos_pressed   INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_device ON telemetry(device_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_rfid   ON telemetry(rfid, timestamp DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id   TEXT NOT NULL,
      rfid        TEXT,
      type        TEXT NOT NULL,
      severity    TEXT NOT NULL,
      message     TEXT NOT NULL,
      value       REAL,
      threshold   REAL,
      timestamp   INTEGER NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      email_sent  INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS devices (
      device_id   TEXT PRIMARY KEY,
      rfid        TEXT,
      battery_pct REAL,
      last_seen   INTEGER,
      status      TEXT DEFAULT 'offline',
      ip_address  TEXT,
      wifi_rssi   INTEGER
    );
  `);
}

// ─── Telemetry helpers ───────────────────────────────────────────────────────

export function insertTelemetry(row: TelemetryRow) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO telemetry
      (device_id, rfid, timestamp, bpm, spo2, temperature, humidity, gas_ppm,
       smoke_detected, sound_db, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z,
       pressure_hpa, altitude_m, battery_pct, wifi_rssi, sos_pressed)
    VALUES
      (@device_id, @rfid, @timestamp, @bpm, @spo2, @temperature, @humidity, @gas_ppm,
       @smoke_detected, @sound_db, @accel_x, @accel_y, @accel_z, @gyro_x, @gyro_y, @gyro_z,
       @pressure_hpa, @altitude_m, @battery_pct, @wifi_rssi, @sos_pressed)
  `);
  return stmt.run(row);
}

export function getLatestPerDevice() {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, w.name as worker_name
    FROM telemetry t
    LEFT JOIN workers w ON t.rfid = w.rfid
    WHERE t.id IN (
      SELECT MAX(id) FROM telemetry GROUP BY device_id
    )
    ORDER BY t.timestamp DESC
  `).all();
}

export function getLatestForDevice(device_id: string) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM telemetry WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1
  `).get(device_id);
}

export function getLatestForRfid(rfid: string) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM telemetry WHERE rfid = ? ORDER BY timestamp DESC LIMIT 1
  `).get(rfid);
}

export function getHistoricalTelemetry(device_id: string, from: number, to: number) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM telemetry
    WHERE device_id = ? AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `).all(device_id, from, to);
}

// ─── Alert helpers ───────────────────────────────────────────────────────────

export function insertAlert(alert: AlertRow) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO alerts (device_id, rfid, type, severity, message, value, threshold, timestamp, email_sent)
    VALUES (@device_id, @rfid, @type, @severity, @message, @value, @threshold, @timestamp, @email_sent)
  `);
  return stmt.run(alert);
}

export function getAlerts(limit = 100, offset = 0) {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, w.name as worker_name
    FROM alerts a
    LEFT JOIN workers w ON a.rfid = w.rfid
    ORDER BY a.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function getActiveAlerts() {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, w.name as worker_name
    FROM alerts a
    LEFT JOIN workers w ON a.rfid = w.rfid
    WHERE a.acknowledged = 0
    ORDER BY a.timestamp DESC
  `).all();
}

export function acknowledgeAlert(id: number) {
  const db = getDb();
  return db.prepare(`UPDATE alerts SET acknowledged = 1 WHERE id = ?`).run(id);
}

export function markEmailSent(id: number) {
  const db = getDb();
  return db.prepare(`UPDATE alerts SET email_sent = 1 WHERE id = ?`).run(id);
}

// ─── Device helpers ──────────────────────────────────────────────────────────

export function upsertDevice(d: DeviceRow) {
  const db = getDb();
  db.prepare(`
    INSERT INTO devices (device_id, rfid, battery_pct, last_seen, status, ip_address, wifi_rssi)
    VALUES (@device_id, @rfid, @battery_pct, @last_seen, @status, @ip_address, @wifi_rssi)
    ON CONFLICT(device_id) DO UPDATE SET
      rfid        = excluded.rfid,
      battery_pct = excluded.battery_pct,
      last_seen   = excluded.last_seen,
      status      = excluded.status,
      ip_address  = excluded.ip_address,
      wifi_rssi   = excluded.wifi_rssi
  `).run(d);
}

export function getAllDevices() {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, w.name as worker_name
    FROM devices d
    LEFT JOIN workers w ON d.rfid = w.rfid
    ORDER BY d.last_seen DESC
  `).all();
}

export function markOfflineDevices(cutoffSeconds = 60) {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - cutoffSeconds;
  db.prepare(`UPDATE devices SET status = 'offline' WHERE last_seen < ?`).run(cutoff);
}

// ─── Worker helpers ──────────────────────────────────────────────────────────

export function getAllWorkers() {
  const db = getDb();
  return db.prepare(`SELECT * FROM workers ORDER BY name`).all();
}

export function getWorkerByRfid(rfid: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM workers WHERE rfid = ?`).get(rfid);
}

export function upsertWorker(w: WorkerRow) {
  const db = getDb();
  db.prepare(`
    INSERT INTO workers (rfid, name, contact, medical_notes, role)
    VALUES (@rfid, @name, @contact, @medical_notes, @role)
    ON CONFLICT(rfid) DO UPDATE SET
      name          = excluded.name,
      contact       = excluded.contact,
      medical_notes = excluded.medical_notes,
      role          = excluded.role
  `).run(w);
}

export function deleteWorker(rfid: string) {
  const db = getDb();
  return db.prepare(`DELETE FROM workers WHERE rfid = ?`).run(rfid);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TelemetryRow {
  device_id: string;
  rfid?: string;
  timestamp: number;
  bpm?: number;
  spo2?: number;
  temperature?: number;
  humidity?: number;
  gas_ppm?: number;
  smoke_detected?: number;
  sound_db?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
  gyro_x?: number;
  gyro_y?: number;
  gyro_z?: number;
  pressure_hpa?: number;
  altitude_m?: number;
  battery_pct?: number;
  wifi_rssi?: number;
  sos_pressed?: number;
}

export interface AlertRow {
  device_id: string;
  rfid?: string;
  type: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: number;
  email_sent: number;
}

export interface DeviceRow {
  device_id: string;
  rfid?: string;
  battery_pct?: number;
  last_seen: number;
  status: 'online' | 'offline';
  ip_address?: string;
  wifi_rssi?: number;
}

export interface WorkerRow {
  rfid: string;
  name: string;
  contact?: string;
  medical_notes?: string;
  role?: string;
}
