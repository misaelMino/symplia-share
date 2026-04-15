const shareRepository = require('../repositories/shareRepository');
const { getClientIp, getUserAgent } = require('../utils/requestContext');

async function register(req, payload, client) {
  return shareRepository.insertAccessLog({
    idShareTemporal: payload.idShareTemporal,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    accion: payload.accion,
    resultado: payload.resultado,
    detalle: payload.detalle || null
  }, client);
}

module.exports = {
  register
};
