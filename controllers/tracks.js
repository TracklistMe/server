'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');

module.exports.controller = function(app) {



    /**
     * GET /tracks/:id
     * Return the artist associated with the specified ID
     **/
    app.get('/tracks/:id', function(req, res) {

        var trackId = req.params.id;
        model.Track.find({
            where: {
                id: trackId
            },
            include: [{
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
        });
    });

    /**
     * GET /tracks/:id/waveform
     * Return the artist associated with the specified ID
     **/
    app.get('/tracks/:id', function(req, res) {

        var trackId = req.params.id;
        model.Track.find({
            where: {
                id: trackId
            },
            include: [{
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
        });
    });







} /* End of artists controller */