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
    function rollbackRelease(databaseRelease) {

        databaseRelease.status = "PROCESSING_FAILED";
        
        for (var i =0; i < release.Tracks.length; i++) { 
            var track = release.Tracks[i];   
            
            // Restore track dropzone files
            model.Tracks.find({
                where: {
                    id: track.id
                }
            }).then(function(databaseTrack){
                model.DropZoneFile.find({
                    where: {
                        path: databaseTrack.path
                    }
                }).then(function(file) {
                    file.status = "UPLOADED";
                    file.save();
                });
            });
        }

        // Restore cover dropzone file
        model.DropZoneFile.find({
            where: {
                path: databaseRelease.cover
            }
        }).then(function(file) {
            file.status = "UPLOADED";
            file.save();
        });

        // Restore metadata file
        model.DropZoneFile.find({
            where: {
                path: databaseRelease.metadataFile
            }
        }).then(function(file) {
            file.status = "UPLOADED";
            file.save();
        });

        databaseRelease.save();
    }

    // 1) Store tracks paths
    // 2) Move tracks lossless files
    // 3) Move release cover
    // 4) Remove DropZoneFiles entries
    // 5) Remove metadata file, if any
    function commitRelease(release, databaseRelease) {

        databaseRelease.status = "PROCESSED";

        var promises = [];

        for (var i =0; i < release.Tracks.length; i++) { 
            var track = release.Tracks[i];   
            
            // Updated track
            var deferredUpdate = Q.defer();
            model.Tracks.find({
                where: {
                    id: track.id
                }
            }).then(function(databaseTrack){
                if (!databaseTrack) {
                    deferredUpdate.reject(new Error("Track does not exist for release"));
                    return;
                } 
                // Update track paths
                databaseTrack.waveform = track.waveform;
                databaseTrack.snippetPath = track.snippetPath;
                databaseTrack.mp3Path = track.mp3Path;
                databaseTrack.save();

                // Move lossless file
                var trackFilename = path.basename(databaseTrack.path);
                cloudstorage.move(databaseTrack.path, fileUtils.remoteReleasePath(databaseRelease.id, trackFilename), function(err) {
                    if(err) deferredUpdate.reject(err);
                    else deferredUpdate.resolve()
                })
            });

            // Add update promise
            promises.push(deferredUpdate.promise);

            // Delete dropzone file
            promises.push(
                dbProxy.DropZoneFile.find({
                    where: {
                        path: databaseTrack.path
                    }
                }).then(function(file) {
                    file.destroy()
                })
            );
        }

        Q.allSettled(promises).then(function(results) {
            var error = false;
            results.forEach(function (result) {
                if (!(result.state === "fulfilled")) {
                    error = true;
                }
            });
            if (!error) {

                var morePromises = []

                // Remove metadata file
                var deferredDelete = Q.defer();
                model.DropZoneFile.find({
                    where: {
                        path: databaseRelease.metadataFile
                    }
                }).then(function(file) {
                    file.destroy().then(function() {
                        cloudstorage.remove(metadataFile, function(err) {
                            if(err) deferredDelete.reject(err);
                            else deferredDelete.resolve()
                        })
                    });
                })

                morePromises.push(deferredDelete)

                // Move cover
                var deferredMove = Q.defer();
                model.DropZoneFile.find({
                    where: {
                        path: databaseRelease.cover
                    }
                }).then(function(file) {
                    file.destroy().then(function() {
                    // Move lossless file
                    var oldCoverPath = databaseRelease.cover
                    var coverFilename = path.basename(oldCoverPath);
                    databaseRelease.cover = fileUtils.remoteReleasePath(databaseRelease.id, coverFilename)
                    cloudstorage.move(oldCoverPath, databaseRelease.cover, function(err) {
                            if(err) deferredMove.reject(err);
                            else deferredMove.resolve()
                        });
                    });
                });

                morePromises.push(deferredMove)

                Q.allSettled(morePromises).then(function(results) {
                    databaseRelease.metadataFile = "";
                    databaseRelease.save();
                });
            } else {
                rollbackRelease(databaseRelease);
            }
        });
    }

    /**
     * Callback to the release result message on rabbitmq
     **/
    rabbitmq.onReleaseResult(function (message, headers, deliveryInfo, messageObject) {

        console.log("CALLBACK CALLED");
        var encoded_payload = unescape(message.data)

        var release;
        
        try {
            release = JSON.parse(encoded_payload)
        } catch(err) {
            console.log("Received status message is not in JSON format");
            return;
        }

        if (!release || !release.id) {
            console.log("Received status message is not a release");
            return;
        }

        console.log('Got a result message for release with id ' + release.id);
        model.Release
            .find({
                where: {
                    id: release.id
                }
            }).then(function(databaseRelease) {
                if (!databaseRelease) return;

                if (release.status == "PROCESSED") {
                    commitRelease(databaseRelease);
                } else {
                    rollbackRelease(databaseRelease);
                }
            });
    });

    /**
     * GET /releases/:id
     * Return the release associated to the id
     * TODO why user has to be admin?
     **/
    app.get('/releases/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
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
                }]
            }, {
                model: model.Label
            }]


        }).then(function(release) {
            console.log(release.dataValues)


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
                newRelease.updateAttributes(release);
                var trackUpdatePromises = [];
                for (var i = release.Tracks.length - 1; i >= 0; i--) {
                    trackUpdatePromises.push(
                            model.Track.find({
                                where: {
                                    id: release.Tracks[i].id
                                }
                            }).then(function(track) {

                                // UPDATE TRACK INFO:
                                var deferred = Q.defer();

                                var jsonTrack;
                                for (var i = release.Tracks.length - 1; i >= 0; i--) {
                                    if (release.Tracks[i].id == track.id) {
                                        jsonTrack = release.Tracks[i];
                                    }
                                }

                                newRelease.addTrack(track, {
                                    position: jsonTrack.ReleaseTracks.position
                                })


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
                                        Q.all([

                                            track.setRemixer(newRemixers),
                                            track.setProducer(newProducers)
                                        ]).done(function() {
                                            deferred.resolve();
                                        });

                                        //res.send();
                                    })
                                    // I NEED TO RETURN HERE A PROMIXE 
                                return deferred.promise;

                            })) // push into trackUpdate Promises 
                };

                Q.allSettled(trackUpdatePromises)
                    .then(function(results) {
                        results.forEach(function(result) {
                            console.log("Update Track Request Done")
                        });
                        console.log("SENDING OUT")
                        res.send(results);
                    })
            })
    });

}
