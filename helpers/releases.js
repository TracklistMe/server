'use strict';

var base = require('./base')
var path = require('path');
var model = rootRequire('models/model');

/**
 * Get size of the logo in pixels given its size as string
 */
function imageSize(size) {
  var width = 1200;
  var height = 1200;
  switch (size) {
    case 'small':
      width = 500;
      height = 500;
      break;
    case 'medium':
      width = 800;
      height = 800;
      break;
  }
  return {
    width: width,
    height: height
  };
}

exports.imageSize = imageSize;

/**
 * Select a release entity given request
 */
function requestEntity(req, callback) {
  req.checkParams('releaseId', 'Release id is invalid').notEmpty().isInt();
  var errors = req.validationErrors();
  if (errors) {
    var err = new Error();
    err.status = 400;
    err.message = 'There have been validation errors';
    err.validation = errors;
    return callback(err);
  }

  var releaseId = req.params.releaseId;
  var releaseEntity = model.Release.find({
    where: {
      id: releaseId
    }
  });
  callback(null, releaseEntity);
}

exports.requestEntity = requestEntity;

/**
 * Returns a possibile location for an image named <filename>
 * on the staging server
 */
function localImagePath(req, filename) {
  return base.uploadFolder + 
    '/img/' + req.user +
    '_' + req.params.releaseId + 
    '_' + filename;
}

exports.localImagePath = localImagePath;

/**
 * Returns a possibile location for a release cover on the CDN
 */
function remoteImagePath(req, extension) {
  return 'releases/' + req.params.releaseId +
    "/cover_" + Date.now() + '.' + extension;
}

exports.remoteImagePath = remoteImagePath;

function remoteReleasePath(releaseId, filename) {
  return 'releases/' + releaseId + "/" + filename;
}

exports.remoteReleasePath = remoteReleasePath;

exports.resizedPath = base.resizedPath;

exports.uploadFunction = base.uploadFunction;

exports.resizeFunction = base.resizeFunction;

exports.resizeInCDN = base.resizeInCDN;