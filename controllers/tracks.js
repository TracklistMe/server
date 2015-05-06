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

    function urlForProperty(trackId, property, callback) {
        model.Track.find({
            where: {
                id: trackId
            }
        }).then(function(track) {
            if (track[property]) {
                cloudstorage.createSignedUrl(track[property], "GET", 20, callback);
            } else {
                callback(new Error('Track property does not exist'));
            }
        });        
    }

    /**
     * GET /tracks/:id/snippet/mp3
     * Return the snippet for the track in mp3 format
     **/
    app.get('/tracks/:id/snippet/mp3', function(req, res) {

        var trackId = req.params.id;
        urlForProperty(trackId, 'snippetPath', function(err, url) {
            if (err) {
                //throw err;
                err.status = 404;
                err.message = "Snippet not found";
                return next(err);
            }
            res.redirect(url);
        });
    });

    /**
     * GET /tracks/:id/snippet/ogg
     * Return the snippet for the track in ogg format
     **/
    app.get('/tracks/:id/snippet/ogg', function(req, res) {

        var trackId = req.params.id;
        urlForProperty(trackId, 'oggSnippetPath', function(err, url) {
            if (err) {
                //throw err;
                err.status = 404;
                err.message = "Ogg snippet not found";
                return next(err);
            }
            res.redirect(url);
        });
    });

    /**
     * GET /tracks/:id/waveform
     * Return the waveform file for the track in json format
     **/
    app.get('/tracks/:id/waveform', function(req, res) {

        var trackId = req.params.id;
        urlForProperty(trackId, 'waveformPath', function(err, url) {
            if (err) {
                //throw err;
                err.status = 404;
                err.message = "Waveform file not found";
                return next(err);
            }
            res.redirect(url);
        });
    });

    /**
     * GET /tracks/:id/download/lossless
     * Return the complete lossless file for the track in wav format
     * TODO: Be sure that the authenticated user bought the track
     **/
    app.get('/tracks/:id/download/lossless', function(req, res) {

        var trackId = req.params.id;
        urlForProperty(trackId, 'path', function(err, url) {
            if (err) {
                //throw err;
                err.status = 404;
                err.message = "Lossless file not found";
                return next(err);
            }
            res.redirect(url);
        });
    });

    /**
     * GET /tracks/:id/download/mp3
     * Return the complete file for the track in mp3 format
     * TODO: Be sure that the authenticated user bought the track
     **/
    app.get('/tracks/:id/download/mp3', function(req, res) {

        var trackId = req.params.id;
        urlForProperty(trackId, 'mp3Path', function(err, url) {
            if (err) {
                //throw err;
                err.status = 404;
                err.message = "Mp3 file not found";
                return next(err);
            }
            res.redirect(url);
        });
    });

} /* End of tracks controller */