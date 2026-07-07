// backend/src/config/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const useSSL = process.env.DB_SSL === 'true';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'observatorio_pobreza',

  ssl: useSSL
    ? {
        rejectUnauthorized: true,
      }
    : undefined,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false,
  charset: 'utf8mb4',
});

export async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('Conexión a MySQL/TiDB correcta');
  } finally {
    conn.release();
  }
}