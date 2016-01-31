'use strict';

var validator = require('validator');

module.exports.validate = function(track) {
  if (!track) {
    return [{param: "track", msg: "required", value: track}];
  }
  if (!track.title || !validator.isAlphanumeric(track.title)) {
    return [{param: "track.title", msg: "required alphanumeric", value: track}];
  }
  return;
}
