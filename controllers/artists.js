'use strict';

var fileUtils             = require('utils/file-utils');
var authenticationUtils   = require('utils/authentication-utils');
var model                 = require('models/model');
var cloudstorage          = require('libs/cloudstorage/cloudstorage');
var fs                    = require('fs-extra');

module.exports.controller = function(app) {

  /**
   * GET /artists/search/:searchString 
   * Return list of all the artists whose displayName matches the searchString
   **/
  app.get('/artists/search/:searchString', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var searchString = req.params.searchString;
    model.Artist.findAll({ where: {displayName: searchString} }).then(function(artists) {
      res.send(artists);
    });
  });

  /**
   * GET /artists/   
   * Return list of all the artists
   * TODO: pagination
   **/
  app.get('/artists/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
   
    model.Artist.findAll().then(function(artists) {
      res.send(artists);
    });
  });

  /**
   * GET /artists/:id 
   * Return the artist associated with the specified ID
   **/
  app.get('/artists/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var artistId = req.params.id;
    model.Artist.find({ where: {id: artistId}, include: [
        {model: model.User}]
      }).then(function(artist) {
      res.send(artist);
    });
  });

  /**
   * PUT /artists/:id 
   * Update artist information
   * TODO check passed data
   **/
  app.put('/artists/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var artistId = req.params.id;
    console.log("Update artist")
    model.Artist.find({where: {id: artistId} }).then(function(artist) {
      if (artist) { // if the record exists in the db
       artist.updateAttributes(req.body).then(function(artist) {
          res.send();
        });
      }
    })
  });

  /**
   * Post /artists/
   * Create new artist
   **/
  app.post('/artists/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var artistName = req.body.displayName;
    
    model.Artist.find({ where: {displayName: artistName} }).then(function(artist) {
         if(!artist){
            model.Artist.create({
              displayName: artistName
            }).success(function(newArtist) {
              artist = newArtist;
            })  
         }
         res.send(artist);
    });
  });

  /**
   * POST /artists/:idArtist/owners/   
   * Add a new owner to the artist
   **/
  app.post('/artists/:artistId/owners', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var newOwnerId = req.body.newOwner;
    var artistId = req.params.artistId

    
    console.log(newOwnerId+" == "+artistId)
    model.Artist.find({where: {id: artistId}}).then(function(artist) {
      artist.getUsers({ where: {id: newOwnerId}}).success(function(users) {
        if(users.length == 0){
            model.User.find({where: {id: newOwnerId}}).then(function(user) {
              artist.addUsers(user).success(function() {
                res.send();
              })
            })
        }else{
          
          console.log("This user was already associated to this artist!")
          // TODO, there was an error, need to fix
        }
      })
    });
  }); 

} /* End of artists controller */