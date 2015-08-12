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
 * Select a label entity given request
 */
function requestEntity(req, callback) {
  req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
  var errors = req.validationErrors();
  if (errors) {
    var err = new Error();
    err.status = 400;
    err.message = 'There have been validation errors';
    err.validation = errors;
    return callback(err);
  }

  var labelId = req.params.labelId;
  var labelEntity = model.Label.find({
    where: {
      id: labelId
    }
  });
  callback(null, labelEntity);
}

exports.requestEntity = requestEntity;

/**
 * Returns a possibile location for a label logo on the CDN
 */
function remoteImagePath(req, extension) {
  return 'labels/' + req.params.labelId +
    "/logo_" + Date.now() + '.' + extension;
}

exports.remoteImagePath = remoteImagePath;

function remoteDropZonePath(labelId, filename) {
  return 'dropZone/' + labelId + "/" + filename;
}

exports.remoteDropZonePath = remoteDropZonePath;

exports.resizedPath = base.resizedPath;

exports.uploadFunction = base.uploadFunction;

exports.resizeFunction = base.resizeFunction;

exports.resizeInCDN = base.resizeInCDN;
