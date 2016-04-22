'use strict';

var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var authenticationUtils = rootRequire('utils/authentication-utils');

module.exports.controller = function(app) {

  /**
   * Jumps to next middleware function passing valiation errors
   *
   * @param {array} errors - An array of validation errors
   * @param {function} next - Middleware function to continue the call chain
   */
  function throwValidationError(errors, next) {
    var err = new Error();
    err.status = 400;
    err.message = 'There have been validation errors';
    err.validation = errors;
    return next(err);
  }

  /**
   * GET /tracklists/:tracklistId
   * Returns full tracklist information with Tracks
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   **/
  app.get('/tracklists/:tracklistId', function(req, res, next) {
    var tracklistId = req.params.tracklistId;
    model.Tracklist.find({
      where: {
        id: tracklistId
      },
      include:[
      {
        model: model.Track,
        include: [
        {
          model: model.Genre
        },
        {
          model: model.Artist,
          as: 'Remixer'
        }, {
          model: model.Artist,
          as: 'Producer'
        }, {
          model: model.Release,
          include: [{
            model: model.Label
          }]
        }]
      },{
        model: model.User
      }]
    }).then(function(tracklist) {
      res.send(tracklist);
    }).catch(function(err) {
      err.status = 500;
      return next(err);
    });
  });
}; /* End of tracks controller */
