'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');

module.exports.controller = function(app) {

    /**
     * GET /currenices/
     * Return list of all the artists whose displayName matches the searchString
     **/
    app.get('/currencies/', function(req, res) {

        model.Currencies.findAll().then(function(currencies) {
            res.send(currencies);
        });
    });



    /**
     * GET /currenices/:id
     * Return the currency associated with the specified ID
     **/
    app.get('/currencies/:id', authenticationUtils.ensureAdmin, function(req, res) {
        var currencyId = req.params.id;
        model.Currencies.find({
            where: {
                id: currencyId
            }
        }).then(function(currency) {
            res.send(currency);
        });
    });
} /* End of currencies controller */