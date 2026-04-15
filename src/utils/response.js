function success(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

module.exports = {
  success,
  fail
};
