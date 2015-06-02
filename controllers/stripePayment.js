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
    app.post('/payments', authenticationUtils.ensureAuthenticated, function(req, res, next) {
        var token = req.body.token;
        var userId = req.user;
        var value = parseInt(req.body.value * 100); //Stripe works in cents.

        var currency = req.body.currency;
        var cart = req.body.cart;
        console.log(cart);

        model.User.find({
            where: {
                id: userId
            }
        }).then(function(user) {
            if (!user) {
                var err = new Error();
                err.status = 401;
                err.message = "You can't buy because you are not an user! ";
                return next(err);
            }
            console.log("token" + value)

            stripe.customers.create({
                source: token,
                email: user.email
            }).then(function(customer) {
                console.log("CUSTOMER RECEIVED ");
                // console.log(customer);

                var cloudURL = ''
                var packURL = ''

                console.log(value, currency, customer.id)
                stripe.charges.create({
                    amount: value,
                    currency: currency,
                    customer: customer.id,
                    metadata: {
                        // CHANCE TO PIGGHY BACK HERE SOME ADDITIONAL INFORMATION
                        // TODO consider if we want to have a TRANSACTION ID in our db

                    },
                }, function(err, charge) {
                    console.log(err)
                    if (!err) {
                        // GOT IT ! 
                        // 
                        console.log("PAYMENT RECEIVED! ")
                        res.send(charge);
                    }
                });


                // Here fetch the cloud link to the product that has been purcheased.

            });


        });



    });



} /* End of payment controller */