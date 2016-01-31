'use strict';

var validator = require('validator');
var trackValidator = rootRequire('validators/tracks');

module.exports.validate = function(release) {
  if (!release) {
    return [{param: "release", msg: "required", value: release}];
  }
  if (!release.title || !validator.isAlphanumeric(release.title)) {
    return [{param: "release.title", msg: "required alphanumeric", value: release.title}];
  }
  if (!release.Tracks || !release.Tracks.length || release.Tracks.length < 1) {
    return [{param: "release.Tracks", msg: "required", value: release.Tracks}];
  }
  for (var i = 0; i < release.Tracks.length; i++) {
    var trackError = trackValidator.validate(release.Tracks[i]);
    if (trackError) {
      return trackError;
    }
  }

  delete release.cover;
  delete release.newCover;
  delete release.smallCover;
  delete release.mediumCover;
  delete release.largeCover;

  return;
}
