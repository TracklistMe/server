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

module.exports.controller = function(app) {

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
