'use strict';

var fileUtils             = require('utils/file-utils');
var authenticationUtils   = require('utils/authentication-utils');
var model                 = require('models/model');
var cloudstorage          = require('libs/cloudstorage/cloudstorage');
var beatport              = require('libs/beatport/beatport');
var fs                    = require('fs-extra');
var Q                     = require('q');
var path                  = require('path');

module.exports.controller = function(app) {

  /**
   * GET /releases/:id   
   * Return the release associated to the id
   * TODO why user has to be admin?
   **/
  app.get('/releases/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var releaseId = req.params.id

     
    model.Release.find({where: {id:releaseId},
       include: [
        {model: model.Track, include: [
          {model: model.Artist, as: 'Remixer'},
          {model: model.Artist, as: 'Producer'}
        ]},{model: model.Label}
      ]


      }).then(function(release) {
   
      res.send(release);
    });
  });

  /**
   * PUT /releases/:id   
   * Update a release
   * TODO why user has to be admin?
   **/
  app.put('/releases/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var releaseId = req.params.id

    var release = req.body.release;
      // update the 
    
    console.log('begin chain of sequelize commands');
    // UPDATE THE RELEASE
    model.Release.find({where: {id:releaseId}}).then(function(newRelease) {
        var trackUpdatePromises = [];

        for (var i = release.Tracks.length - 1; i >= 0; i--) {
          trackUpdatePromises.push(
          model.Track.find({where: {id:release.Tracks[i].id}}).then(function(track){
             // UPDATE TRACK INFO:
                var deferred = Q.defer();

                var jsonTrack;
                for (var i = release.Tracks.length - 1; i >= 0; i--) {
                  if(release.Tracks[i].id == track.id){
                    jsonTrack = release.Tracks[i];
                  }
                }
               
                track.updateAttributes(jsonTrack).then(function(newTrack) {
                  // SET THE ARTISTS
                  
                  // list of promixes tu track 
                  
                  // 
                  // 
                  var newProducers = [];
                  for (var i = jsonTrack.Producer.length - 1; i >= 0; i--) {
                    newProducers.push(jsonTrack.Producer[i].id);
                  };
                  
                  var newRemixers = [];
                  for (var i = jsonTrack.Remixer.length - 1; i >= 0; i--) {
                    newRemixers.push(jsonTrack.Remixer[i].id);
                  };
                  
                  // Q.all  accept an array of promises functions. Call the done when all are successful
                  Q.all([track.setRemixer(newRemixers), track.setProducer(newProducers)]).done(function () {
                    deferred.resolve();
                  });
                 
                  //res.send();
                })
              // I NEED TO RETURN HERE A PROMIXE 
                return deferred.promise;
              
          })
          )  // push into trackUpdate Promises 
        }; 

        Q.allSettled(trackUpdatePromises)  
          .then(function (results) {
            results.forEach(function (result) {
              console.log("Update Track Request Done")
            });
            console.log("SENDING OUT")
            res.send(results);
          })
    })
  });

  /**
   * GET /cover/:labelId/:releaseNumber/:image
   * Get the cover image of release
   * TODO totally fix and possibly remove
   **/
  app.get('/cover/:labelId/:releaseNumber/:image', function(req, res) {
    var mimeTypes = {
      "jpeg": "image/jpeg",
      "jpg": "image/jpeg",
      "png": "image/png"
    };
    var labelId = req.params.labelId;
    var releaseNumber = req.params.releaseNumber;
    var image = req.params.image;
    console.log(__dirname + '/../../datastore/'+labelId+"/"+releaseNumber+"/"+image);
   
    var mimeType = mimeTypes[path.extname(image).split(".")[1]];
    res.writeHead(200, {'Content-Type':mimeType});
    var fileStream = fs.createReadStream(__dirname + '/../../datastore/'+labelId+"/"+releaseNumber+"/"+image);
    fileStream.pipe(res);

  });
}