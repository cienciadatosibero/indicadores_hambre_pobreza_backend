// backend/src/middlewares/errorHandler.js
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Error interno del servidor',
  });
}

export function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Recurso no encontrado' });
}
