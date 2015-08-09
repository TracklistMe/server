'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');

module.exports.controller = function(app) {

  /**
   * GET /currenices/
   * Return list of curerncies
   */
  app.get('/currencies/', function(req, res) {
    model.Currency.findAll().then(function(currencies) {
      res.send(currencies);
    });
  });

  /**
   * GET /currenices/:id
   * Return the currency associated with the specified ID
   */
  app.get('/currencies/:id',
    authenticationUtils.ensureAdmin,
    function(req, res) {
      var currencyId = req.params.id;
      model.Currency.find({
        where: {
          id: currencyId
        }
      }).then(function(currency) {
        res.send(currency);
      });
    });

  /**
   * POST /currencies/
   * Add a new currency
   */
  app.post('/currencies/',
    authenticationUtils.ensureAdmin,
    function(req, res) {
      model.Currency.create({
        name: req.body.name,
        shortname: req.body.shortname,
        symbol: req.body.symbol
      }).success(function(currency) {
        res.send(currency);
      });
    });

}; /* End of currencies controller */
