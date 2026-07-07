// backend/src/services/colorService.js
// Escala divergente de 5 clases: rojo -> naranja -> amarillo -> verde claro -> verde
export const COLOR_SCALE = ['#D7191C', '#FDAE61', '#FFFFBF', '#A6D96A', '#1A9641'];
export const NO_DATA_COLOR = '#E0E0E0';

// Calcula 5 cortes de igual rango entre min y max y asigna color a cada valor.
// invertida=true -> rojo para valores ALTOS (util en pobreza/hambre).
export function buildScale(values, invertida = false) {
  const nums = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v))).map(Number);
  if (!nums.length) return { breaks: [], min: null, max: null };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const step = (max - min) / 5 || 1;
  const breaks = [];
  for (let i = 1; i < 5; i++) breaks.push(min + step * i);
  return { breaks, min, max, invertida };
}

export function colorFor(value, scale) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return NO_DATA_COLOR;
  const v = Number(value);
  let idx = 0;
  for (let i = 0; i < scale.breaks.length; i++) {
    if (v >= scale.breaks[i]) idx = i + 1;
  }
  const base = scale.palette && scale.palette.length === 5 ? scale.palette : COLOR_SCALE;
  const palette = scale.invertida ? [...base].reverse() : base;
  return palette[idx];
}
