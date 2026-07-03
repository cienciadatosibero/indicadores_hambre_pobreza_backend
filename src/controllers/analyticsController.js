// backend/src/controllers/analyticsController.js
import { getAllRows } from '../models/indicadorModel.js';
import { isValidIdentifier } from '../utils/sqlSafe.js';

// Analiza cualquier tabla: detecta columnas numericas, calcula resumen
// (min, max, promedio, conteo) y prepara series para graficar.
export async function analizar(req, res, next) {
  try {
    const tabla = req.params.tabla;
    if (!isValidIdentifier(tabla)) {
      return res.status(400).json({ success: false, message: 'Nombre de tabla invalido' });
    }
    const rows = await getAllRows(tabla);
    if (!rows.length) {
      return res.json({ success: true, data: { tabla, columnas: [], numericas: [], resumen: {}, filas: [] } });
    }

    const columnas = Object.keys(rows[0]).filter((c) => !['created_at', 'updated_at'].includes(c));
    const numericas = [];
    const textuales = [];

    for (const col of columnas) {
      const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
      const sonNumeros = vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
      if (sonNumeros) numericas.push(col);
      else textuales.push(col);
    }

    // La primera columna textual se usa como etiqueta/categoria.
    const etiqueta = textuales[0] || columnas[0];

    const resumen = {};
    for (const col of numericas) {
      const nums = rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n));
      if (!nums.length) continue;
      const suma = nums.reduce((a, b) => a + b, 0);
      const prom = suma / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const varianza = nums.reduce((a, b) => a + (b - prom) ** 2, 0) / nums.length;
      resumen[col] = {
        conteo: nums.length,
        min,
        max,
        promedio: Number(prom.toFixed(4)),
        desviacion: Number(Math.sqrt(varianza).toFixed(4)),
      };
    }

    res.json({
      success: true,
      data: {
        tabla,
        columnas,
        numericas,
        textuales,
        etiqueta,
        resumen,
        filas: rows.map((r) => {
          const o = {};
          for (const c of columnas) o[c] = r[c];
          return o;
        }),
      },
    });
  } catch (e) {
    next(e);
  }
}
