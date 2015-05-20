'use strict';

var fs = require('fs-extra');
var Q = require('q');
var path = require('path');
var util = require('util');
var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');
var beatport = rootRequire('libs/beatport/beatport');
var rabbitmq = rootRequire('rabbitmq/rabbitmq');

module.exports.controller = function(app) {


    // 1) Restore DropZoneFiles entries for metadataFile, lossless tracks and cover
    // 2) Remove tracks
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
                    databaseTrack.status = model.TrackStatus.PROCESSING_FAILED;
                    databaseTrack.errorMessage = track.errorMessage;
                    model.DropZoneFile.find({
                        where: {
                            path: track.path
                        }
                    }).then(function(file) {
                        if (file) {
                            file.status = "UPLOADED";
                            file.save();
                            console.log("Saving track " + databaseTrack.id + " Path " + track.path);
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
                file.status = "UPLOADED";
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
                file.status = "UPLOADED";
                file.save();
            }
        });

        databaseRelease.save();
    }

    function updateTrackPromise(track, releaseId, newCoverPath) {
        // Updated track
        var deferredUpdate = Q.defer();
        model.Track.find({
            where: {
                id: track.id
            }
        }).then(function(databaseTrack) {
            if (!databaseTrack) {
                console.log("Track does not exist, update promise rejected")
                deferredUpdate.reject(new Error("Track does not exist for release"));
            } else {
                // Update track paths
                databaseTrack.waveform = track.waveform;
                databaseTrack.snippetPath = track.snippetPath;
                databaseTrack.oggSnippetPath = track.oggSnippetPath;
                databaseTrack.mp3Path = track.mp3Path;
                databaseTrack.lengthInSeconds = track.lengthInSeconds;
                databaseTrack.status = model.TrackStatus.PROCESSED;
                databaseTrack.cover = newCoverPath;

                // Move lossless file
                var trackFilename = path.basename(databaseTrack.path);
                var newLosslessPath = fileUtils.remoteReleasePath(releaseId, trackFilename);
                cloudstorage.copy(databaseTrack.path, newLosslessPath, function(err) {
                    if (err) deferredUpdate.reject(err);
                    else {
                        databaseTrack.path = newLosslessPath;
                        databaseTrack.save();
                        deferredUpdate.resolve();
                    }
                })
            }
        });

        // return update promise
        return deferredUpdate.promise;
    }

    function deleteDropZoneFileTableEntryPromise(dropZonePath) {
        // Delete dropzone file
        var deferredDelete = Q.defer();
        model.DropZoneFile.find({
            where: {
                path: dropZonePath
            }
        }).then(function(file) {
            if (!file) {
                console.log("DropZoneFile does not exist, delete promise rejected");
                deferredDelete.reject(new Error("DropZoneFile does not exist"));
            } else {
                file.destroy().then(function() {
                    deferredDelete.resolve();
                });
            }
        });

        // Return delete promise
        return deferredDelete.promise;
    }

    function deleteDropZoneFilePromise(dropZonePath) {
        // Remove metadata file
        var deferredDelete = Q.defer();
        model.DropZoneFile.find({
            where: {
                path: dropZonePath
            }
        }).then(function(file) {
            if (file) {
                file.destroy().then(function() {
                    cloudstorage.remove(dropZonePath, function(err) {
                        if (err) deferredDelete.reject(err);
                        else deferredDelete.resolve();
                    });
                });
            } else {
                console.log("DropZoneFile does not exist, delete promise rejected")
                deferredDelete.reject(new Error("DropZoneFile does not exist"))
            }
        });

        // Return delete promise
        return deferredDelete;
    }

    // update of the json linked to the releases in the db
    function consolideJSON(releaseId) {
        var deferredUpdate = Q.defer();

        // WRITE THE JSON
        // 
        console.log("SAVE ------- JSON")
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
            console.log("PULLED THE OBJECT")
            release.save().then(function(savedRelease) {
                console.log("SAVED WITH SUCCESS")
                deferredUpdate.resolve(release.json);
            })


        });
        return deferredUpdate.promise
    }

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
                        if (err) deferredMove.reject(err);
                        else deferredMove.resolve();
                    });
                });
            } else {
                console.log("DropZoneFile does not exist, delete promise rejected");
                deferredMove.reject(new Error("DropZoneFile does not exist"));
            }
        });

        // Return move promise
        return deferredMove.promise
    }

    // 1) Store tracks paths
    // 2) Move tracks lossless files
    // 3) Move release cover
    // 4) Remove DropZoneFiles entries
    // 5) Remove metadata file, if any
    function commitRelease(release, databaseRelease) {

        databaseRelease.status = model.ReleaseStatus.PROCESSED;

        var updateTrackPromises = [];
        var oldCoverPath = databaseRelease.cover;
        var coverFilename = path.basename(oldCoverPath);
        var newCoverPath = fileUtils.remoteReleasePath(databaseRelease.id, coverFilename);

        for (var i = 0; i < release.Tracks.length; i++) {
            var track = release.Tracks[i];

            // Update track
            updateTrackPromises.push(updateTrackPromise(track, release.id, newCoverPath));

        }

        Q.allSettled(updateTrackPromises).then(function(results) {

            var error = false
            for (i = 0; i < results.length; i++) {
                if (results[i].state === "rejected") {
                    error = true;
                    break;
                }
            }

            if (!error) {
                console.log("All tracks have been updated and files moved");

                var deleteDropZoneFilePromises = [];
                for (var i = 0; i < release.Tracks.length; i++) {
                    var track = release.Tracks[i];
                    // Delete dropzone file table entry
                    deleteDropZoneFilePromises.push(deleteDropZoneFilePromise(track.path));
                }

                Q.allSettled(deleteDropZoneFilePromises).then(function(results) {

                    console.log("All track dropzone files deleted correctly");
                    var morePromises = []
                    if (databaseRelease.metadataFile)
                        morePromises.push(deleteDropZoneFilePromise(databaseRelease.metadataFile));

                    if (databaseRelease)
                        morePromises.push(moveCoverPromise(databaseRelease, newCoverPath));

                    Q.allSettled(morePromises).then(function(results) {
                        databaseRelease.metadataFile = "";
                        databaseRelease.save();
                    });
                });
            } else {
                console.log("Track update failed");
                rollbackRelease(release, databaseRelease);
                return;
            }
        })
    }

    /**
     * Callback to the release result message on rabbitmq
     **/
    rabbitmq.onReleaseResult(function(message, headers, deliveryInfo, messageObject) {

        if (deliveryInfo.contentType != "application/json") {
            console.log("Received status message is not in JSON format");
            return;
        }

        if (!message || !message.id) {
            console.log("Received status message is not a release");
            return;
        }

        var release = message;

        console.log('Got a result message for release with id ' + release.id);
        model.Release
            .find({
                where: {
                    id: release.id
                }
            }).then(function(databaseRelease) {
                if (!databaseRelease) return;

                if (release.status == model.ReleaseStatus.PROCESSED) {
                    console.log('Release with id ' + release.id + ' has been correctly processed');
                    commitRelease(release, databaseRelease);
                } else {
                    console.log('Release with id ' + release.id + ' processing failed');
                    rollbackRelease(release, databaseRelease);
                }
            });
    });


    app.get('/releases/', function(req, res) {


        model.Release.findAll({
            where: {
                isActive: 1
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
     * TODO why user has to be admin?
     **/
    app.get('/releases/:id', function(req, res) {
        var releaseId = req.params.id

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

    /** POST  /release/
      create a release
     */

    app.post('/releases/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {

        var release = req.body.release;
        var idLabel = req.body.idLabel;
        console.log("____________" + idLabel)
        console.log("ADD RELEASE")
        console.log(release)
        model.Label.find({
            where: {
                id: idLabel
            }
        }).then(function(label) {
            model.Release.create(release).
            then(function(newRelease) {
                label.addReleases(newRelease).then(function(association) {

                    consolideJSON(newRelease.id)
                    res.send(newRelease);
                })
            })
        })
    })

    /**
     * PUT /releases/:id
     * Update a release
     * TODO we should have POST FOR UPDATe and PUT FOR CREATE....
     **/
    app.put('/releases/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
        var releaseId = req.params.id

        var release = req.body.release;

        // update the 

        console.log('begin chain of sequelize commands');
        // UPDATE THE RELEASE
        model.Release
            .find({
                where: {
                    id: releaseId
                }
            }).then(function(newRelease) {
                // newRelease is the current release 
                newRelease.updateAttributes(release);
                var trackUpdatePromises = [];
                for (var i = release.Tracks.length - 1; i >= 0; i--) {
                    var addOrUpdateTrack = function(i) {

                        var currentTrack = release.Tracks[i];

                        trackUpdatePromises.push(

                            // SEARCH THE TRACK
                            model.Track.find({
                                where: {
                                    id: release.Tracks[i].id
                                }
                            }).then(function(track) {
                                console.log("_____________")
                                console.log("_____________")
                                console.log("_____________")
                                console.log("_____________")
                                console.log(currentTrack)
                                console.log("_____________")
                                console.log("_____________")
                                var deferred = Q.defer();
                                if (track) {
                                    // IF THE TRACK EXISTS 
                                    // UPDATE TRACK INFO:




                                    newRelease.addTrack(track, {
                                        position: currentTrack.ReleaseTracks.position
                                    })


                                    track.updateAttributes(currentTrack).then(function(newTrack) {
                                        // SET THE ARTISTS

                                        // list of promixes tu track 

                                        // 
                                        // 
                                        var newProducers = [];
                                        for (var i = currentTrack.Producer.length - 1; i >= 0; i--) {
                                            newProducers.push(currentTrack.Producer[i].id);
                                        };

                                        var newRemixers = [];
                                        for (var i = currentTrack.Remixer.length - 1; i >= 0; i--) {
                                            newRemixers.push(currentTrack.Remixer[i].id);
                                        };

                                        var newGenres = []
                                        for (var i = currentTrack.Genres.length - 1; i >= 0; i--) {
                                            newGenres.push(currentTrack.Genres[i]);
                                        };


                                        // Q.all  accept an array of promises functions. Call the done when all are successful
                                        Q.all([
                                            //  track.setGenres(newGenres),
                                            track.setRemixer(newRemixers),
                                            track.setProducer(newProducers)
                                        ]).done(function() {
                                            deferred.resolve();
                                        });

                                        //res.send();
                                    })


                                } else {

                                    console.log("CREO LA TRACCIA")
                                    model.Track.create({
                                        title: currentTrack.title,
                                        version: currentTrack.version,
                                        path: currentTrack.path
                                    }).then(function(track) {
                                        newRelease.addTrack(track, {
                                            position: currentTrack.ReleaseTracks.position
                                        })
                                        deferred.resolve();
                                    });




                                }


                                // I NEED TO RETURN HERE A promise 
                                return deferred.promise;

                            })) // push into trackUpdate Promises 
                    };
                    addOrUpdateTrack(i) //pass the id inside the scope of the function
                };

                Q.allSettled(trackUpdatePromises)
                    .then(function(results) {
                        results.forEach(function(result) {
                            console.log("Update Track Request Done")
                        });
                        consolideJSON(releaseId)


                        res.send(results);
                        // end of  release Fetch



                    })
            })
    });

}