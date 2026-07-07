// backend/src/services/schemaService.js
import { pool } from '../config/db.js';

// Tablas internas que NUNCA se listan como indicadores ni se pueden borrar.
export const TABLAS_SISTEMA = ['diccionario_variables', 'estados', 'municipios', 'indicadores', 'usuarios', 'mensajes_contacto'];
import { escapeIdent, isValidIdentifier, resolveSqlType, ALLOWED_SQL_TYPES } from '../utils/sqlSafe.js';

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
async function createTable(conn, tabla, columnasDef, idCols) {
  if (!idCols || !idCols.length) {
    throw new Error('Debes marcar al menos una columna como id (clave primaria)');
  }
  const idSafes = idCols.map((c) => c.safe);

  // MySQL limita el tamaño de fila (~65535 bytes). Con muchas columnas de texto
  // se rebasa ese limite. Cuando la tabla es "ancha", convertimos las columnas
  // VARCHAR (salvo las de la clave primaria) a TEXT, que se almacena fuera de la fila.
  const tablaAncha = columnasDef.length > 40;

  const partes = columnasDef.map((c) => {
    const esPk = idSafes.includes(c.safe);
    let tipoSql = resolveSqlType(c.tipo);
    // Las columnas de la PK no pueden ser TEXT; el resto de VARCHAR pasan a TEXT si la tabla es ancha.
    if (tablaAncha && !esPk && String(c.tipo).toUpperCase() === 'VARCHAR') {
      tipoSql = ALLOWED_SQL_TYPES.TEXT;
    }
    // Todas las columnas de la clave primaria deben ser NOT NULL.
    return `${escapeIdent(c.safe)} ${tipoSql}${esPk ? ' NOT NULL' : ''}`;
  });

  partes.push('`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  partes.push('`updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  const pkCols = idSafes.map((s) => escapeIdent(s)).join(', ');
  partes.push(`PRIMARY KEY (${pkCols})`);

  const sql =
    `CREATE TABLE ${escapeIdent(tabla)} (\n  ${partes.join(',\n  ')}\n) ` +
    `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC`;
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

// Nombre de la tabla catalogo de entidades/municipios (INEGI).
const CATALOGO_TABLA = 'municipios';

// Todo indicador cargado debe traer CVE_ENT y CVE_MUN y esas claves deben
// existir en el catalogo geografico, para saber a que lugar pertenece cada dato.
export async function verificarCatalogoGeografico(columnasDef, filas) {
  const colEnt = columnasDef.find((c) => c.safe === 'cve_ent');
  const colMun = columnasDef.find((c) => c.safe === 'cve_mun');

  if (!colEnt || !colMun) {
    throw new Error(
      'Los datos deben incluir las columnas CVE_ENT y CVE_MUN: son obligatorias ' +
      'para vincular cada registro al catalogo de entidades y municipios.'
    );
  }

  const faltantes = filas.filter((f) => {
    const ent = f[colEnt.safe];
    const mun = f[colMun.safe];
    return ent === null || ent === undefined || String(ent).trim() === '' ||
           mun === null || mun === undefined || String(mun).trim() === '';
  });
  if (faltantes.length) {
    throw new Error(
      `${faltantes.length} fila(s) no tienen CVE_ENT y/o CVE_MUN. Ambos campos son obligatorios en cada registro.`
    );
  }

  const clave = (ent, mun) => `${parseInt(ent, 10)}-${parseInt(mun, 10)}`;
  const paresArchivo = new Set(filas.map((f) => clave(f[colEnt.safe], f[colMun.safe])));

  // Verifica que exista el catalogo antes de consultarlo.
  const existeCatalogo = await tableExists(CATALOGO_TABLA);
  if (!existeCatalogo) {
    throw new Error(
      `No existe el catalogo de municipios (tabla "${CATALOGO_TABLA}"). ` +
      'Ejecuta el script BD/catalogo_normalizado_seed.sql antes de cargar indicadores.'
    );
  }

  const [catalogo] = await pool.query(
    `SELECT cve_ent, cve_mun FROM ${escapeIdent(CATALOGO_TABLA)}`
  );
  if (!catalogo.length) {
    throw new Error(
      `El catalogo de municipios ("${CATALOGO_TABLA}") esta vacio. ` +
      'Ejecuta el script BD/catalogo_normalizado_seed.sql para poblarlo antes de cargar indicadores.'
    );
  }
  const paresCatalogo = new Set(catalogo.map((c) => `${parseInt(c.cve_ent, 10)}-${parseInt(c.cve_mun, 10)}`));

  const invalidos = [...paresArchivo].filter((p) => !paresCatalogo.has(p));
  if (invalidos.length) {
    throw new Error(
      `${invalidos.length} combinacion(es) de CVE_ENT/CVE_MUN no existen en el catalogo ` +
      `de municipios y no pueden referenciarse a ningun lugar. Ejemplos (ent-mun): ` +
      `${invalidos.slice(0, 8).join(', ')}${invalidos.length > 8 ? '...' : ''}`
    );
  }
}

// Logica principal: crear tabla nueva o fusionar con una existente.
// Devuelve un resumen de la operacion.
export async function applyUpload({ tabla, columnasDef, filas }) {
  if (!isValidIdentifier(tabla)) {
    throw new Error(`Nombre de tabla invalido: ${tabla}`);
  }
  // Estructura estandar: si el archivo trae CVE_ENT y CVE_MUN pero no cve_geo,
  // se genera automaticamente cve_geo = ENT(2)+MUN(3) y se usa como clave primaria.
  const tieneGeo = columnasDef.some((c) => c.safe === 'cve_geo');
  const colEntDef = columnasDef.find((c) => c.safe === 'cve_ent');
  const colMunDef = columnasDef.find((c) => c.safe === 'cve_mun');
  if (!tieneGeo && colEntDef && colMunDef) {
    for (const f of filas) {
      const e = String(parseInt(f[colEntDef.safe], 10)).padStart(2, '0');
      const m = String(parseInt(f[colMunDef.safe], 10)).padStart(3, '0');
      f.cve_geo = e + m;
    }
    columnasDef = columnasDef.map((c) => ({ ...c, esId: false }));
    columnasDef.unshift({ original: 'cve_geo', safe: 'cve_geo', tipo: 'VARCHAR', esId: true });
  }

  // Clave primaria: puede ser una o varias columnas (PK compuesta).
  const idCols = columnasDef.filter((c) => c.esId);
  if (!idCols.length) {
    throw new Error('Debes marcar al menos una columna como id (clave primaria)');
  }

  // CVE_ENT y CVE_MUN son obligatorias y deben existir en el catalogo geografico.
  await verificarCatalogoGeografico(columnasDef, filas);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const existe = await tableExists(tabla);

    if (!existe) {
      await createTable(conn, tabla, columnasDef, idCols);
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
    const totalCols = existentes.length + columnasDef.length;
    const tablaAncha = totalCols > 40;
    const columnasAgregadas = [];
    for (const c of columnasDef) {
      if (!existentesSet.has(c.safe)) {
        let tipoSql = resolveSqlType(c.tipo);
        if (tablaAncha && String(c.tipo).toUpperCase() === 'VARCHAR') {
          tipoSql = ALLOWED_SQL_TYPES.TEXT;
        }
        await conn.query(
          `ALTER TABLE ${escapeIdent(tabla)} ADD COLUMN ${escapeIdent(c.safe)} ${tipoSql}`
        );
        columnasAgregadas.push(c.safe);
        existentesSet.add(c.safe);
      }
    }

    // 2) Por fila: si la clave (una o varias columnas) existe -> UPDATE; si no -> INSERT
    let filasInsertadas = 0;
    let filasActualizadas = 0;
    const idSafes = idCols.map((c) => c.safe);

    // Condicion WHERE por clave compuesta: col1 = ? AND col2 = ? ...
    const whereSql = idCols.map((c) => `${escapeIdent(c.safe)} = ?`).join(' AND ');

    for (const fila of filas) {
      const idValores = idCols.map((c) => coerce(fila[c.safe], c.tipo));
      // si alguna parte de la clave es nula, se omite la fila
      if (idValores.some((v) => v === null)) continue;

      const [rows] = await conn.query(
        `SELECT 1 FROM ${escapeIdent(tabla)} WHERE ${whereSql} LIMIT 1`,
        idValores
      );

      if (rows.length) {
        // clave ya registrada -> solo actualizar atributos (no duplicar fila)
        const setCols = columnasDef.filter((c) => !idSafes.includes(c.safe));
        if (setCols.length) {
          const setSql = setCols.map((c) => `${escapeIdent(c.safe)} = ?`).join(', ');
          const valores = setCols.map((c) => coerce(fila[c.safe], c.tipo));
          valores.push(...idValores);
          await conn.query(
            `UPDATE ${escapeIdent(tabla)} SET ${setSql} WHERE ${whereSql}`,
            valores
          );
          filasActualizadas++;
        }
      } else {
        // clave nueva -> insertar registro
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
  const sistema = TABLAS_SISTEMA;
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
  if (TABLAS_SISTEMA.includes(tabla)) throw new Error('No se puede eliminar una tabla del sistema');
  await pool.query(`DROP TABLE IF EXISTS ${escapeIdent(tabla)}`);
  await pool.query(`DELETE FROM indicadores WHERE nombre_tabla = ?`, [tabla]);
  // Limpia metadatos asociados a la tabla.
  await pool.query('DELETE FROM diccionario_variables WHERE nombre_tabla = ?', [tabla]);
  await pool.query('DELETE FROM indicadores WHERE nombre_tabla = ?', [tabla]);
  return { tabla, eliminada: true };
}
