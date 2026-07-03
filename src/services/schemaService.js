// backend/src/services/schemaService.js
import { pool } from '../config/db.js';
import { escapeIdent, isValidIdentifier, resolveSqlType } from '../utils/sqlSafe.js';

// Devuelve true si existe la tabla en la base de datos actual.
export async function tableExists(tabla) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tabla]
  );
  return rows[0].n > 0;
}

// Devuelve la lista de columnas existentes de una tabla.
export async function getColumns(tabla) {
  const [rows] = await pool.query(
    `SELECT column_name AS name, data_type AS type
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY ordinal_position`,
    [tabla]
  );
  return rows.map((r) => r.name);
}

// Normaliza un valor para insertarlo segun el tipo elegido.
function coerce(value, tipo) {
  if (value === null || value === undefined || value === '') return null;
  const t = String(tipo).toUpperCase();
  if (t === 'INT') {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  if (t === 'DECIMAL') {
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  if (t === 'BOOLEAN') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const s = String(value).trim().toLowerCase();
    return ['1', 'true', 'si', 'sí', 'yes', 'verdadero'].includes(s) ? 1 : 0;
  }
  if (t === 'DATE') {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
  return String(value);
}

// Crea una nueva tabla dinamica con las columnas y tipos dados.
// columnasDef: [{ safe, tipo, esId }]
async function createTable(conn, tabla, columnasDef) {
  const idCol = columnasDef.find((c) => c.esId);
  if (!idCol) throw new Error('Debes marcar una columna como id (clave primaria)');

  const partes = columnasDef.map((c) => {
    const tipoSql = resolveSqlType(c.tipo);
    const esPk = c.safe === idCol.safe;
    return `${escapeIdent(c.safe)} ${tipoSql}${esPk ? ' NOT NULL' : ''}`;
  });

  partes.push('`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  partes.push('`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  partes.push(`PRIMARY KEY (${escapeIdent(idCol.safe)})`);

  const sql = `CREATE TABLE ${escapeIdent(tabla)} (\n  ${partes.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
  await conn.query(sql);
}

// Inserta todas las filas en una tabla recien creada.
async function insertAll(conn, tabla, columnasDef, filas) {
  if (!filas.length) return 0;
  const cols = columnasDef.map((c) => c.safe);
  const colSql = cols.map((c) => escapeIdent(c)).join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  let insertadas = 0;
  for (const fila of filas) {
    const valores = columnasDef.map((c) => coerce(fila[c.safe], c.tipo));
    await conn.query(
      `INSERT INTO ${escapeIdent(tabla)} (${colSql}) VALUES (${placeholders})`,
      valores
    );
    insertadas++;
  }
  return insertadas;
}

// Logica principal: crear tabla nueva o fusionar con una existente.
// Devuelve un resumen de la operacion.
export async function applyUpload({ tabla, columnasDef, filas }) {
  if (!isValidIdentifier(tabla)) {
    throw new Error(`Nombre de tabla invalido: ${tabla}`);
  }
  const idCol = columnasDef.find((c) => c.esId);
  if (!idCol) throw new Error('Debes marcar una columna como id (clave primaria)');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const existe = await tableExists(tabla);

    if (!existe) {
      await createTable(conn, tabla, columnasDef);
      const insertadas = await insertAll(conn, tabla, columnasDef, filas);
      await conn.commit();
      return {
        accion: 'creada',
        tabla,
        columnasAgregadas: columnasDef.map((c) => c.safe),
        filasInsertadas: insertadas,
        filasActualizadas: 0,
      };
    }

    // La tabla ya existe: fusionar.
    const existentes = await getColumns(tabla);
    const existentesSet = new Set(existentes);

    // 1) Columnas nuevas -> ALTER TABLE ADD COLUMN
    const columnasAgregadas = [];
    for (const c of columnasDef) {
      if (!existentesSet.has(c.safe)) {
        const tipoSql = resolveSqlType(c.tipo);
        await conn.query(
          `ALTER TABLE ${escapeIdent(tabla)} ADD COLUMN ${escapeIdent(c.safe)} ${tipoSql}`
        );
        columnasAgregadas.push(c.safe);
        existentesSet.add(c.safe);
      }
    }

    // 2) Por fila: si el id existe -> UPDATE de atributos; si no -> INSERT
    let filasInsertadas = 0;
    let filasActualizadas = 0;
    const idSafe = idCol.safe;

    for (const fila of filas) {
      const idValor = coerce(fila[idSafe], idCol.tipo);
      if (idValor === null) continue;

      const [rows] = await conn.query(
        `SELECT 1 FROM ${escapeIdent(tabla)} WHERE ${escapeIdent(idSafe)} = ? LIMIT 1`,
        [idValor]
      );

      if (rows.length) {
        // id ya registrado -> solo actualizar atributos (no duplicar fila)
        const setCols = columnasDef.filter((c) => c.safe !== idSafe);
        if (setCols.length) {
          const setSql = setCols.map((c) => `${escapeIdent(c.safe)} = ?`).join(', ');
          const valores = setCols.map((c) => coerce(fila[c.safe], c.tipo));
          valores.push(idValor);
          await conn.query(
            `UPDATE ${escapeIdent(tabla)} SET ${setSql} WHERE ${escapeIdent(idSafe)} = ?`,
            valores
          );
          filasActualizadas++;
        }
      } else {
        // id nuevo -> insertar registro
        const cols = columnasDef.map((c) => c.safe);
        const colSql = cols.map((c) => escapeIdent(c)).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const valores = columnasDef.map((c) => coerce(fila[c.safe], c.tipo));
        await conn.query(
          `INSERT INTO ${escapeIdent(tabla)} (${colSql}) VALUES (${placeholders})`,
          valores
        );
        filasInsertadas++;
      }
    }

    await conn.commit();
    return {
      accion: 'fusionada',
      tabla,
      columnasAgregadas,
      filasInsertadas,
      filasActualizadas,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Lista todas las tablas dinamicas (excluye las del sistema).
export async function listDynamicTables() {
  const sistema = ['usuarios', 'indicadores', 'mensajes_contacto'];
  const [rows] = await pool.query(
    `SELECT table_name AS nombre, table_rows AS registros
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );
  const result = [];
  for (const r of rows) {
    if (sistema.includes(r.nombre)) continue;
    const columnas = await getColumns(r.nombre);
    const [cnt] = await pool.query(`SELECT COUNT(*) AS n FROM ${escapeIdent(r.nombre)}`);
    result.push({ nombre: r.nombre, columnas, registros: cnt[0].n });
  }
  return result;
}

export async function dropTable(tabla) {
  if (!isValidIdentifier(tabla)) throw new Error('Nombre de tabla invalido');
  const sistema = ['usuarios', 'indicadores', 'mensajes_contacto'];
  if (sistema.includes(tabla)) throw new Error('No se puede eliminar una tabla del sistema');
  await pool.query(`DROP TABLE IF EXISTS ${escapeIdent(tabla)}`);
  await pool.query(`DELETE FROM indicadores WHERE nombre_tabla = ?`, [tabla]);
  return { tabla, eliminada: true };
}
