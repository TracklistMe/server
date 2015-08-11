'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var helper = rootRequire('helpers/artists');
var AVATAR_DEFAULT = 'img/default/avatar.gif';

module.exports.controller = function(app) {

  /**
   * GET /artists/search/:searchString
   * Return list of all the artists whose displayName matches the searchString
   **/
  app.get('/artists/search/:searchString', function(req, res) {
    var searchString = req.params.searchString;
    model.Artist.findAll({
      where: ['displayName LIKE ?', '%' + searchString + '%']
    }).then(function(artists) {
      res.send(artists);
    });
  });


  /**
   * GET /artists/searchExact/:searchString
   * Return the list of labels whose displayName exactly matches the search
   * string
   */
  app.get('/artists/searchExact/:searchString', function(req, res) {
    var searchString = req.params.searchString;
    model.Artist.find({
      where: {
        displayName: searchString
      }
    }).then(function(artists) {
      res.send(artists);
    });
  });

  /**
   * GET /artists/
   * Return list of all the artists
   * TODO: pagination
   **/
  app.get('/artists/',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      model.Artist.findAll().then(function(artists) {
        res.send(artists);
      });
    });

  /**
   * GET /artists/:id
   * Return the artist associated with the specified ID
   **/
  app.get('/artists/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var artistId = req.params.id;
      model.Artist.find({
        where: {
          id: artistId
        },
        include: [{
          model: model.User
        }]
      }).then(function(artist) {
        res.send(artist);
      });

    });

  /**
   * PUT /artists/:id
   * Update artist information
   * TODO check passed data
   **/
  app.put('/artists/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var artistId = req.params.id;
      console.log('Update artist');
      model.Artist.find({
        where: {
          id: artistId
        }
      }).then(function(artist) {
        if (artist) { // if the record exists in the db
          artist.updateAttributes(req.body).then(function() {
            res.send();
          });
        }
      });
    });

  /**
   * Post /artists/
   * Create new artist
   **/
  app.post('/artists/',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var artistName = req.body.displayName;

      model.Artist.find({
        where: {
          displayName: artistName
        }
      }).then(function(artist) {
        if (!artist) {
          model.Artist.create({
            displayName: artistName
          }).then(function(newArtist) {
            artist = newArtist;
          });
        }
        res.send(artist);
      });
    });

  /**
   * POST /artists/:idArtist/owners/
   * Add a new owner to the artist
   **/
  app.post('/artists/:artistId/owners',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var newOwnerId = req.body.newOwner;
      var artistId = req.params.artistId;

      console.log(newOwnerId + ' == ' + artistId);
      model.Artist.find({
        where: {
          id: artistId
        }
      }).then(function(artist) {
        artist.getUsers({
          where: {
            id: newOwnerId
          }
        }).success(function(users) {
          if (users.length === 0) {
            model.User.find({
              where: {
                id: newOwnerId
              }
            }).then(function(user) {
              artist.addUsers(user).success(function() {
                res.send();
              });
            });
          } else {

            console.log('This user was already associated to this artist!');
            // TODO, there was an error, need to fix
          }
        });
      });
    });

  /**
   * POST /artists/:artistId/profilePicture/:width/:height/
   * Upload artist profile picture to the CDN, original size and resized
   **/
  app.post('/artists/:artistId/profilePicture/:width/:height/',
    authenticationUtils.ensureAuthenticated,
    fileUtils.uploadFunction(
      helper.localImagePath,
      helper.remoteImagePath),
    fileUtils.resizeFunction(
      helper.localImagePath,
      helper.remoteImagePath),
    function(req, res) {
      var artistId = req.params.artistId;
      model.Artist.find({
        where: {
          id: artistId
        }
      }).then(function(artist) {

        var oldAvatar = artist.avatar;
        artist.avatar =
          helper.remoteImagePath(req, req.uploadedFile[0].resizedFilename);

        artist.save().then(function() {
          // we remove old avatars from the CDN
          if (oldAvatar !== AVATAR_DEFAULT) {
            cloudstorage.remove(oldAvatar);
          }
          // We remove temporarily stored files
          fs.unlink(
            helper.localImagePath(
              req,
              req.uploadedFile[0].filename));
          fs.unlink(
            helper.localImagePath(
              req,
              req.uploadedFile[0].resizedFilename));

          res.send(JSON.stringify(req.uploadedFile));
        });
      });
    });

}; /* End of artists controller */
