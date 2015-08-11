'use strict';

var path = require('path');
var uploadFolder = path.resolve(__dirname + "/../uploadFolder");

/**
 * Returns a possibile location for an artist image named filename on the
 * staging server
 */
function localImagePath(req, filename) {
  return uploadFolder + 
    '/img/' + req.user +
    '_' + req.params.artistId + 
    '_' + filename;
}

exports.localImagePath = localImagePath;

/**
 * Returns a possibile location for an artist image named filename on the
 * CDN
 */
function remoteImagePath(req, filename) {
  return 'artists/' + req.params.artistId + "/" + filename;
}

exports.remoteImagePath = remoteImagePath;