module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || 500;
  const payload = {
    ok: false,
    error: err.message || 'Error interno'
  };

  if (err.code) payload.code = err.code;
  if (err.details) payload.details = err.details;

  if (status >= 500) {
    console.error('symplia-share error:', err);
  }

  return res.status(status).json(payload);
};
