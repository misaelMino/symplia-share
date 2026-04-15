const { auth } = require('../config/env');

function parseNumeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = function resolveAuthUser(req, res, next) {
  const claimHeaders = {
    userId: req.headers[auth.userIdHeader],
    userSub: req.headers[auth.userSubHeader]
  };

  const claimPayloadRaw = req.headers['x-auth-user-claims'];
  let claimPayload = null;

  if (claimPayloadRaw) {
    try {
      claimPayload = JSON.parse(claimPayloadRaw);
    } catch (error) {
      claimPayload = null;
    }
  }

  let idUsuario = parseNumeric(claimHeaders.userId);

  if (!idUsuario && claimPayload) {
    for (const claimName of auth.userIdClaims) {
      idUsuario = parseNumeric(claimPayload[claimName]);
      if (idUsuario) break;
    }
  }

  req.authUser = {
    idUsuario,
    sub: claimHeaders.userSub || claimPayload?.sub || null,
    claims: claimPayload
  };

  next();
};
