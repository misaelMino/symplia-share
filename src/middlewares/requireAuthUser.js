const AppError = require('../utils/appError');

module.exports = function requireAuthUser(req, res, next) {
  if (!req.authUser?.idUsuario) {
    return next(new AppError('No se pudo resolver el idUsuario autenticado', 401, 'AUTH_USER_REQUIRED'));
  }
  next();
};
