'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');

module.exports.controller = function(app) {

  /**
   * GET /currenices/
   * Return list of all the artists whose displayName matches the searchString
   **/
  app.get('/pricesTable/', function(req, res) {

    model.ConvertedPrice.findAll().then(function(priceList) {
      res.send(priceList);
    });
  });

  app.get('/pricesMasterTable/', function(req, res) {

    model.MasterPrice.findAll().then(function(priceList) {
      res.send(priceList);
    });
  });



  /**
   * GET /currenices/:id
   * Return the currency associated with the specified ID
   **/
  app.get('/pricesTable/:currencyId', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var currencyId = req.params.currencyId;
    model.ConvertedPrice.findAll({
      where: {
        CurrencyId: currencyId
      }

    }).then(function(priceList) {
      res.send(priceList);
    });
  });

  /**
   * POST /pricesTable/
   * Return
   **/
  app.post('/pricesTable/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    console.log("REQUESTED ARRIVED", req.body.masterPrice, req.body.price, req.body.currencyId)
    var masterPrice = req.body.masterPrice;
    var price = req.body.price;
    var currencyId = req.body.currencyId;

    model.ConvertedPrice.find({
      where: {
        MasterPrice: masterPrice,
        CurrencyId: currencyId
      }
    }).then(function(convertedPrice) {
      if (!convertedPrice) {
        console.log("NEED TO BUILD")
        model.ConvertedPrice.create({
          price: price,
          MasterPrice: masterPrice,
          CurrencyId: currencyId
        }).success(function(newCurrency) {
          res.send(newCurrency);
        })
      } else {
        convertedPrice.updateAttributes({
          price: price
        }).then(function() {
          res.send(convertedPrice);
        })

      }

    });
  });
} /* End of currencies controller */
