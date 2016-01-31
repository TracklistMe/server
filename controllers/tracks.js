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
   * Ensures current user has bought the track before downloading lossless
   * and mp3 full files (or that the user is admin).
   *
   * @param {object} req - The request object
   * @param {integer} req.params.trackId - The id of the track
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureUserOwnsTrack(req, res, next) {
    req.checkParams('trackId', 'Invalid track id').notEmpty().isInt();
    var errors = req.validationErrors();
    if (errors) {
      return throwValidationError(errors, next);
    }
    authenticationUtils.checkScopes(['admin'])(req, res, function(err) {
      if (!err) {
        return next();
      }
      var trackId = req.params.trackId;
      var userId = req.user;
      model.LibraryItem.find({
        where: {
          userId: userId,
          trackId: trackId
        }
      }).then(function(libraryItem) {
        if (!libraryItem) {
          var err = new Error();
          err.status = 401;
          err.message = 'You don\'t have access to the requested resource';
          return next(err);
        }
        return next();
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });
  }

  /**
   * Returns a signed URL for the requested track property.
   *
   * @param {integer} trackId - The id of the track for which to select the
   *     property
   * @param {string} property - The property to return a signed url for,
   *     expected values are ['snippetPath', 'oggSnippetPath', 'waveform',
   *     'path', 'mp3Path']
   * @param {function} callback - The callback function, must be of the form
   *     function(err, url)
   */
  function urlForProperty(trackId, property, callback) {
    model.Track.find({
      where: {
        id: trackId
      }
    }).then(function(track) {
      if (track[property]) {
        cloudstorage.createSignedUrl(track[property], 'GET', 20, callback);
      } else {
        var err = new Error();
        err.status = 404;
        err.message = 'Track property does not exist';
        callback(err);
      }
    }).catch(function(err) {
      err.status = 500;
      callback(err);
    });
  }

  /**
   * GET /tracks/:trackId
   * Returns full track information with Genre, Remixer, Producer, Artist,
   * Release and Release's label.
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   **/
  app.get('/tracks/:trackId', function(req, res, next) {

    var trackId = req.params.trackId;
    model.Track.find({
      where: {
        id: trackId
      },
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
    }).then(function(track) {
      res.send(track);
    }).catch(function(err) {
      err.status = 500;
      return next(err);
    });
  });

  /**
   * GET /tracks/:trackId/snippet/mp3
   * Return the snippet for the track in mp3 format.
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/tracks/:trackId/snippet/mp3', function(req, res, next) {

    var trackId = req.params.trackId;
    urlForProperty(trackId, 'snippetPath', function(err, url) {
      if (err) {
        return next(err);
      }
      res.redirect(url);
    }).catch(function(err) {
      err.status = 500;
      return next(err);
    });
  });

  /**
   * GET /tracks/:trackId/snippet/ogg
   * Return the snippet for the track in ogg format.
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/tracks/:trackId/snippet/ogg', function(req, res, next) {

    var trackId = req.params.trackId;
    urlForProperty(trackId, 'oggSnippetPath', function(err, url) {
      if (err) {
        return next(err);
      }
      res.redirect(url);
    });
  });

  /**
   * GET /tracks/:trackId/waveform
   * Return the waveform file for the track in json format
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   **/
  app.get('/tracks/:trackId/waveform', function(req, res, next) {

    var trackId = req.params.trackId;
    urlForProperty(trackId, 'waveform', function(err, url) {
      if (err) {
        return next(err);
      }
      res.redirect(url);
    });
  });

  /**
   * GET /tracks/:trackId/download/lossless
   * Return the complete lossless file for the track in wav format
   * TODO: Be sure that the authenticated user bought the track
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   **/
  app.get('/tracks/:trackId/download/lossless',
    authenticationUtils.ensureAuthenticated, ensureUserOwnsTrack,
    function(req, res, next) {

    var trackId = req.params.trackId;
    urlForProperty(trackId, 'path', function(err, url) {
      if (err) {
        return next(err);
      }
      res.redirect(url);
    });
  });

  /**
   * GET /tracks/:trackId/download/mp3
   * Return the complete file for the track in mp3 format
   * TODO: Be sure that the authenticated user bought the track
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   **/
  app.get('/tracks/:trackId/download/mp3',
    authenticationUtils.ensureAuthenticated, ensureUserOwnsTrack,
    function(req, res, next) {

    var trackId = req.params.trackId;
    urlForProperty(trackId, 'mp3Path', function(err, url) {
      if (err) {
        return next(err);
      }
      res.redirect(url);
    });
  });

}; /* End of tracks controller */
