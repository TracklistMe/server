'use strict';

var fs = require('fs-extra');
var config = rootRequire('config/config');
var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model'); 
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');
var stripe = require('stripe')(config.STRIPE_PRIVATE);


module.exports.controller = function(app) {

    /**
     * Ensures current user is the owner of the company
     * Company ID must be passed as req.body.companyId
    
    app.get('/labels/search/:searchString', function(req, res, next) {
        var searchString = req.params.searchString;
        model.Label.findAll({
            where: ["displayName LIKE ?", "%" + searchString + "%"]
        }).then(function(labels) {
            res.send(labels);
        });
    });

    /**
     * POST /payment/:idToken
     * Return the list of labels whose displayName exactly matches the search string
     */
    app.post('/payment/stripe', function(req, res, next) {
        var token = req.body.token;
        var email = req.body.email;
        var value = req.body.value;
        var currency = req.body.currency;
        var idproduct = req.body.idproduct;


        console.log("token"+value)
        stripe.customers.create({
          source: token,
          email: email
        }).then(function(customer) {
          var charge =  stripe.charges.create({
            amount: value,
            currency: currency,
            customer: customer.id,
            metadata: {product: idproduct}
          });

          // Here fetch the cloud link to the product that has been purcheased.
          res.send(charge);
        }).then(function(charge) {
          // New charge created on a new customer
        }, function(err) {
          // Deal with an error
        });
    });

 

} /* End of payment controller */
