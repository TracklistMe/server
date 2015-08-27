'use strict';

var Q = require('q');
var path = require('path');
var helper = rootRequire('helpers/releases');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var rabbitmq = rootRequire('rabbitmq/rabbitmq');
var imagesController = rootRequire('controllers/images');


module.exports.controller = function(app) {

  /**
   * Rollback a release back to the DropZone
   * 1) Restore DropZoneFiles entries for metadataFile, tracks and cover
   * 2) Remove tracks
   */
  function rollbackRelease(release, databaseRelease) {

    databaseRelease.status = model.ReleaseStatus.PROCESSING_FAILED;

    release.Tracks.forEach(function(track) {

      // Restore track dropzone files
      model.Track.find({
        where: {
          id: track.id
        }
      }).then(function(databaseTrack) {
        if (databaseTrack) {
          databaseTrack.path = track.path;
          databaseTrack.mp3Path = null;
          databaseTrack.snippetPath = null;
          databaseTrack.oggSnippetPath = null;
          databaseTrack.waveform = null;
          databaseTrack.lengthInSeconds = null;
          databaseTrack.bpm = null;
          databaseTrack.status = model.TrackStatus.PROCESSING_FAILED;
          databaseTrack.errorMessage = track.errorMessage;
          model.DropZoneFile.find({
            where: {
              path: track.path
            }
          }).then(function(file) {
            if (file) {
              file.status = 'UPLOADED';
              file.save();
              console.log(
                'Saving track ' + databaseTrack.id + ' Path ' + track.path);
              databaseTrack.save();
            }
          });
        }
      });
    });

    // Restore cover dropzone file
    model.DropZoneFile.find({
      where: {
        path: databaseRelease.cover
      }
    }).then(function(file) {
      if (file) {
        file.status = 'UPLOADED';
        file.save();
      }
    });

    // Restore metadata file
    model.DropZoneFile.find({
      where: {
        path: databaseRelease.metadataFile
      }
    }).then(function(file) {
      if (file) {
        file.status = 'UPLOADED';
        file.save();
      }
    });

    databaseRelease.save();
  }

  /**
   * Return a promise that updates a track given a track, a release Id and a
   * a new cover path
   */
  function updateTrackPromise(track, releaseId, newCoverPath) {
    // Updated track
    var deferredUpdate = Q.defer();
    model.Track.find({
      where: {
        id: track.id
      }
    }).then(function(databaseTrack) {
      if (!databaseTrack) {
        console.log('Track does not exist, update promise rejected');
        deferredUpdate.reject(new Error('Track does not exist for release'));
      } else {
        // Update track paths
        databaseTrack.waveform = track.waveform;
        databaseTrack.snippetPath = track.snippetPath;
        databaseTrack.oggSnippetPath = track.oggSnippetPath;
        databaseTrack.mp3Path = track.mp3Path;
        databaseTrack.lengthInSeconds = track.lengthInSeconds;
        databaseTrack.status = model.TrackStatus.PROCESSED;
        databaseTrack.cover = newCoverPath;
        databaseTrack.bpm = track.bpm;

        // Move lossless file
        var trackFilename = path.basename(databaseTrack.path);
        var newLosslessPath =
          helper.remoteReleasePath(releaseId, trackFilename);
        cloudstorage.copy(
          databaseTrack.path,
          newLosslessPath,
          function(err) {
            if (err) {
              deferredUpdate.reject(err);
            } else {
              databaseTrack.path = newLosslessPath;
              databaseTrack.save();
              deferredUpdate.resolve();
            }
          });
      }
    });

    // return update promise
    return deferredUpdate.promise;
  }

  /**
   * Returns a promise that removes a file from the DropZone's CDN
   */
  function deleteDropZoneFilePromise(dropZonePath) {
    var deferredDelete = Q.defer();
    model.DropZoneFile.find({
      where: {
        path: dropZonePath
      }
    }).then(function(file) {
      if (file) {
        file.destroy().then(function() {
          cloudstorage.remove(dropZonePath, function(err) {
            if (err) {
              deferredDelete.reject(err);
            } else {
              deferredDelete.resolve();
            }
          });
        });
      } else {
        console.log('DropZoneFile does not exist, delete promise rejected');
        deferredDelete.reject(new Error('DropZoneFile does not exist'));
      }
    });
    // Return delete promise
    return deferredDelete;
  }

  /**
   * Returns a promise that moves the cover of a release from the CDN to the
   * release directory
   */
  function moveCoverPromise(databaseRelease, newCoverPath) {
    var deferredMove = Q.defer();
    model.DropZoneFile.find({
      where: {
        path: databaseRelease.cover
      }
    }).then(function(file) {
      if (file) {
        file.destroy().then(function() {
          // Move lossless file
          var oldCoverPath = databaseRelease.cover;
          databaseRelease.cover = newCoverPath;
          cloudstorage.move(oldCoverPath, newCoverPath, function(err) {
            if (err) {
              deferredMove.reject(err);
            } else {
              deferredMove.resolve();
            }
          });
        });
      } else {
        console.log('DropZoneFile does not exist, delete promise rejected');
        deferredMove.reject(new Error('DropZoneFile does not exist'));
      }
    });

    // Return move promise
    return deferredMove.promise;
  }

  /**
   * Commits a release when its processing succeeded (A success message is 
   * received from RabbitMq)
   * 1) Store tracks paths
   * 2) Move tracks lossless files
   * 3) Move release cover
   * 4) Remove DropZoneFiles entries
   * 5) Remove metadata file, if any
   */
  function commitRelease(release, databaseRelease) {

    databaseRelease.status = model.ReleaseStatus.PROCESSED;

    var updateTrackPromises = [];
    var oldCoverPath = databaseRelease.cover;
    var coverFilename = path.basename(oldCoverPath);
    var newCoverPath =
      helper.remoteReleasePath(databaseRelease.id, coverFilename);

    for (var i = 0; i < release.Tracks.length; i++) {
      var track = release.Tracks[i];
      // Update track
      updateTrackPromises.push(
        updateTrackPromise(track, release.id, newCoverPath));
    }

    Q.allSettled(updateTrackPromises).then(function(results) {

      var error = false;
      for (i = 0; i < results.length; i++) {
        if (results[i].state === 'rejected') {
          error = true;
          break;
        }
      }

      if (!error) {
        console.log('All tracks have been updated and files moved');

        var deleteDropZoneFilePromises = [];
        for (i = 0; i < release.Tracks.length; i++) {
          var track = release.Tracks[i];
          // Delete dropzone file table entry
          deleteDropZoneFilePromises.push(
            deleteDropZoneFilePromise(track.path));
        }

        Q.allSettled(deleteDropZoneFilePromises).then(function() {

          console.log('All track dropzone files deleted correctly');
          var morePromises = [];
          if (databaseRelease.metadataFile) {
            morePromises.push(
              deleteDropZoneFilePromise(databaseRelease.metadataFile));
          }

          if (databaseRelease) {
            morePromises.push(
              moveCoverPromise(databaseRelease, newCoverPath));
          }

          Q.allSettled(morePromises).then(function() {
            databaseRelease.metadataFile = '';
            databaseRelease.save();
          });
        });
      } else {
        console.log('Track update failed');
        rollbackRelease(release, databaseRelease);
        return;
      }
    });
  }

  /**
   * Update the release json in the db
   */
  function consolideJSON(releaseId) {
    var deferredUpdate = Q.defer();

    console.log('SAVE ------- JSON');
    model.Release.find({
      where: {
        id: releaseId
      },
      attributes: ['id', 'catalogNumber', 'status'],
      order: 'position',
      include: [{
        model: model.Track,
        include: [{
          model: model.Artist,
          as: 'Remixer'
        }, {
          model: model.Artist,
          as: 'Producer'
        }]
      }, {
        model: model.Label
      }]
    }).then(function(release) {
      release.json = JSON.stringify(release);
      console.log('PULLED THE OBJECT');
      release.save().then(function() {
        console.log('SAVED WITH SUCCESS');
        deferredUpdate.resolve(release.json);
      });
    });
    return deferredUpdate.promise;
  }

  /**
   * Callback to the release result message on rabbitmq
   **/
  rabbitmq.onReleaseResult(
    function(message, headers, deliveryInfo) {

      if (deliveryInfo.contentType !== 'application/json') {
        console.log('Received status message is not in JSON format');
        return;
      }

      if (!message || !message.id) {
        console.log('Received status message is not a release');
        return;
      }

      var release = message;

      model.Release
        .find({
          where: {
            id: release.id
          }
        }).then(function(databaseRelease) {
          if (!databaseRelease) {
            return;
          }

          if (release.status === model.ReleaseStatus.PROCESSED) {
            console.log(
              'Release with id ' +
              release.id +
              ' has been correctly processed');
            commitRelease(release, databaseRelease);
          } else {
            console.log(
              'Release with id ' +
              release.id +
              ' processing failed');
            rollbackRelease(release, databaseRelease);
          }
        });
    });

  /**
   * GET /releases
   * Returns all releases
   * TODO pagination
   */
  app.get('/releases/', function(req, res) {

    model.Release.findAll({
      where: {
        isActive: true
      },
      order: 'position',
      include: [{
        model: model.Track,
        include: [{
          model: model.Artist,
          as: 'Remixer'
        }, {
          model: model.Artist,
          as: 'Producer'
        }]
      }, {
        model: model.Label
      }]
    }).then(function(releases) {
      res.send(releases);
    });
  });

  /**
   * GET /releases/:id
   * Return the release associated to the id
   */
  app.get('/releases/:id', function(req, res) {
    var releaseId = req.params.id;

    model.Release.find({
      where: {
        id: releaseId
      },
      order: 'position',
      include: [{
        model: model.Track,
        include: [{
          model: model.Artist,
          as: 'Remixer'
        }, {
          model: model.Artist,
          as: 'Producer'
        }, {
          model: model.Genre
        }]
      }, {
        model: model.Label
      }]
    }).then(function(release) {
      res.send(release);
    });
  });

  /**
   * POST /release/
   * Create a new release
   */
  app.post('/releases/',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.ensureAdmin,
    function(req, res) {

      var release = req.body.release;
      var idLabel = req.body.idLabel;
      console.log('____________' + idLabel);
      console.log('ADD RELEASE');
      console.log(release);
      model.Label.find({
        where: {
          id: idLabel
        }
      }).then(function(label) {
        model.Release.create(release).
        then(function(newRelease) {
          label.addReleases(newRelease).then(function() {
            consolideJSON(newRelease.id);
            res.send(newRelease);
          });
        });
      });
    });

  /**
   * PUT /releases/:id
   * Update a release
   */
  app.put('/releases/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var releaseId = req.params.id;
      var release = req.body.release;

      // Update the release
      model.Release
        .find({
          where: {
            id: releaseId
          }
        }).then(function(newRelease) {
          // newRelease is the current release 
          release.status = model.ReleaseStatus.TO_BE_PROCESSED;
          newRelease.updateAttributes(release);
          var trackUpdatePromises = [];
          for (var i = release.Tracks.length - 1; i >= 0; i--) {
            var addOrUpdateTrack = function(i) {

              var currentTrack = release.Tracks[i];
              trackUpdatePromises.push(
                model.Track.find({
                  where: {
                    id: release.Tracks[i].id
                  }
                }).then(function(track) {
                  console.log('Update track to udpate release');
                  console.log(currentTrack);
                  var deferred = Q.defer();
                  if (track) {
                    // If a track exists we update its data
                    newRelease.addTrack(track, {
                      position: currentTrack.ReleaseTracks.position
                    });

                    track.updateAttributes(currentTrack).then(function() {
                      var i = 0;
                      var newProducers = [];
                      for (i = currentTrack.Producer.length - 1; i >= 0; i--) {
                        newProducers.push(currentTrack.Producer[i].id);
                      }
                      var newRemixers = [];
                      for (i = currentTrack.Remixer.length - 1; i >= 0; i--) {
                        newRemixers.push(currentTrack.Remixer[i].id);
                      }
                      var newGenres = [];
                      for (i = currentTrack.Genres.length - 1; i >= 0; i--) {
                        newGenres.push(currentTrack.Genres[i]);
                      }
                      // Accept an array of promises functions. 
                      // Call the done when all are successful
                      track.status = model.TrackStatus.TO_BE_PROCESSED;
                      Q.all([
                        track.setRemixer(newRemixers),
                        track.setProducer(newProducers),
                        track.save()
                      ]).done(function() {
                        deferred.resolve();
                      });
                    });
                  } else {
                    console.log('Create the track');
                    model.Track.create({
                      title: currentTrack.title,
                      version: currentTrack.version,
                      path: currentTrack.path
                    }).then(function(track) {
                      newRelease.addTrack(track, {
                        position: currentTrack.ReleaseTracks.position
                      });
                      deferred.resolve();
                    });
                  }
                  // Return the promise
                  return deferred.promise;
                }));
            };
            addOrUpdateTrack(i);
          }

          Q.allSettled(trackUpdatePromises)
            .then(function(results) {
              results.forEach(function() {
                console.log('Update Track Request Done');
              });
              consolideJSON(releaseId).then(function(jsonRelease) {
                console.log('===LOGGING RELEASE IN JSON FORMAT====');
                console.log(jsonRelease);
              });
              //rabbitmq.sendReleaseToProcess(release);
              res.send(results);
            });
        });
    });

  /**
   * POST '/releases/:releaseId/cover/createFile'
   * Request a CDN policy to upload a new release cover, if an update was
   * already in progress the old request is deleted from the CDN
   */
  app.post('/releases/:releaseId/cover/createFile',
    authenticationUtils.ensureAuthenticated,
    imagesController.createImageFactory('cover', helper));

  /**
   * POST '/releases/:releaseId/cover/confirmFile'
   * Confirm the upload of the requested new cover, store it in the database
   * as release information
   */
  app.post('/releases/:releaseId/cover/confirmFile',
    authenticationUtils.ensureAuthenticated,
    imagesController.confirmImageFactory(
      'cover', ['small', 'medium', 'large'], helper));

  /**
   * GET '/releases/:releaseId/cover/:size(small|large|medium)'
   * Get the release cover in the desired size, if it does not exist download the
   * original avatar and resize it
   */
  app.get('/releases/:releaseId/cover/:size(small|medium|large)',
    imagesController.getImageFactory('cover', helper));
}; /* End of release controller */
