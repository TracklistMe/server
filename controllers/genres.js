'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');

module.exports.controller = function(app) {

    /**
     * GET /artists/searchExact/:searchString
     * Return the list of labels whose displayName exactly matches the search string
     */
    app.get('/genres/searchExact/:searchString', function(req, res, next) {
        var searchString = req.params.searchString;
        model.Genre.find({
            where: {
                name: searchString
            }
        }).then(function(genre) {
            res.send(genre);
        });
    });


    /**
     * GET /genres/
     * Return list of all the artists
     * TODO: pagination
     **/
    app.get('/genres/', function(req, res) {

        model.Genre.findAll().then(function(genres) {
            res.send(genres);
        });
    });

    /**
     * GET /artists/:id
     * Return the artist associated with the specified ID
     **/
    app.get('/genres/:id', function(req, res) {
        var genreId = req.params.id;
        model.Genre.find({
            where: {
                id: genreId
            }
        }).then(function(genre) {
            res.send(genre);
        });
    });

    /**
     * PUT /artists/:id
     * Update artist information
     * TODO check passed data
     **/
    app.put('/genres/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
        var genreId = req.params.id;
        console.log("Update artist")
        model.Genre.find({
            where: {
                id: genreId
            }
        }).then(function(genre) {
            if (genre) { // if the record exists in the db
                genre.updateAttributes(req.body).then(function(genre) {
                    res.send();
                });
            }
        })
    });

    /**
     * Post /artists/
     * Create new artist
     **/
    app.post('/genres/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
        var genreName = req.body.name;

        model.Genre.find({
            where: {
                name: genreName
            }
        }).then(function(genre) {
            if (!genre) {
                model.Genre.create({
                    name: genreName
                }).success(function(newGenre) {
                    genre = newGenre;
                })
            }
            res.send(genre);
        });
    });


} /* End of artists controller */