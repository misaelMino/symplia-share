const shareService = require('../services/shareService');
const fileService = require('../services/fileService');
const { success } = require('../utils/response');
const ACCESS_ACTIONS = require('../constants/accessActions');

async function createShare(req, res) {
  const result = await shareService.createShareWithQr({
    authUser: req.authUser,
    body: req.body || {}
  });
  return success(res, result.data, 201);
}

async function listShares(req, res) {
  const filters = {
    estado: req.query.estado ? String(req.query.estado).trim() : null,
    activos: String(req.query.activos || '').toLowerCase() === 'true',
    expirados: String(req.query.expirados || '').toLowerCase() === 'true'
  };

  const data = await shareService.listSharesForUser(req.authUser.idUsuario, filters);
  return success(res, data);
}

async function getShareDetail(req, res) {
  const data = await shareService.getShareDetailForUser(Number(req.params.id), req.authUser.idUsuario);
  return success(res, data);
}

async function revokeShare(req, res) {
  const data = await shareService.revokeShare(Number(req.params.id), req.authUser.idUsuario, req);
  return success(res, data);
}

async function getPublicShare(req, res) {
  const data = await shareService.getPublicShareMetadata(req, req.params.token);
  return success(res, data);
}

async function validatePin(req, res) {
  const data = await shareService.validateSharePin(req, req.params.token, req.body?.pin);
  return success(res, data);
}

async function viewDocument(req, res) {
  const { document } = await shareService.resolvePublicDocumentAccess(
    req,
    req.params.token,
    Number(req.params.idHistorialDocumentoGuardado),
    {
      mode: 'view',
      forDownload: false,
      logAction: ACCESS_ACTIONS.VIEW
    }
  );

  return fileService.streamInlineFile(res, document);
}

async function downloadDocument(req, res) {
  const { document } = await shareService.resolvePublicDocumentAccess(
    req,
    req.params.token,
    Number(req.params.idHistorialDocumentoGuardado),
    {
      mode: 'download',
      forDownload: true,
      logAction: ACCESS_ACTIONS.DOWNLOAD
    }
  );

  return fileService.streamDownloadFile(res, document);
}

async function downloadZip(req, res) {
  const { share, documents } = await shareService.resolvePublicZipAccess(req, req.params.token);
  return fileService.streamZip(res, share, documents);
}

module.exports = {
  createShare,
  listShares,
  getShareDetail,
  revokeShare,
  getPublicShare,
  validatePin,
  viewDocument,
  downloadDocument,
  downloadZip
};
