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
 * Select an artist entity given request
 */
function requestEntity(req, callback) {
  req.checkParams('artistId', 'Artist id is invalid').notEmpty().isInt();
  var errors = req.validationErrors();
  if (errors) {
    var err = new Error();
    err.status = 400;
    err.message = 'There have been validation errors';
    err.validation = errors;
    return callback(err);
  }

  var artistId = req.params.artistId;
  var artistEntity = model.Artist.find({
    where: {
      id: artistId
    }
  });
  callback(null, artistEntity);
}

exports.requestEntity = requestEntity;

/**
 * Returns a possibile location for an artist avatar on the CDN
 */
function remoteImagePath(req, extension) {
  return 'artists/' + req.params.artistId +
    "/avatar_" + Date.now() + '.' + extension;
}

exports.remoteImagePath = remoteImagePath;

exports.uploadFunction = base.uploadFunction;

exports.resizedPath = base.resizedPath;

exports.resizeFunction = base.resizeFunction;

exports.resizeInCDN = base.resizeInCDN;