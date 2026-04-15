function pad(number, size) {
  return String(number).padStart(size, '0');
}

function formatShareCode(idShareTemporal, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1, 2);
  const d = pad(date.getUTCDate(), 2);
  return `SHR-${y}${m}${d}-${pad(idShareTemporal, 4)}`;
}

module.exports = {
  formatShareCode
};
