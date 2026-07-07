// backend/src/controllers/variablesController.js
import { getColumns } from '../services/schemaService.js';
import { getVariablesConfig, saveVariablesConfig } from '../models/indicadorModel.js';

// Lista todas las columnas de la tabla con su etiqueta y direccion de colores.
export async function variablesGet(req, res, next) {
  try {
    const tabla = req.params.tabla;
    const cols = await getColumns(tabla);
    if (!cols.length) return res.status(404).json({ success: false, message: 'Tabla no encontrada' });
    const cfg = await getVariablesConfig(tabla);
    const porCol = Object.fromEntries(cfg.map((c) => [c.columna, c]));
    const data = cols
      .filter((c) => !['created_at', 'updated_at'].includes(c))
      .map((c) => ({
        columna: c,
        etiqueta: porCol[c]?.etiqueta || c,
        escala_invertida: porCol[c]?.escala_invertida ?? null,
      }));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

// Guarda etiquetas y direccion de colores por variable.
export async function variablesPut(req, res, next) {
  try {
    const { variables } = req.body;
    if (!Array.isArray(variables)) {
      return res.status(400).json({ success: false, message: 'Formato invalido' });
    }
    await saveVariablesConfig(req.params.tabla, variables);
    res.json({ success: true, message: 'Variables actualizadas' });
  } catch (e) { next(e); }
}
