'use strict';
var Q = require('q');
var fs = require('fs-extra');
var config = rootRequire('config/config');
var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var stripe = require('stripe')(config.STRIPE_PRIVATE);


module.exports.controller = function(app) {

  // FIND THE PRICE OF A TRACK given trackID, and currencyID

  function findPriceTrack(idTrack, idCurrency) {
    var deferred = Q.defer();
    model.Track.find({
      where: {
        id: idTrack
      },
    }).then(function(track) {
      model.ConvertedPrice.find({
        where: {
          CurrencyId: idCurrency,
          MasterPrice: track.Price
        }
      }).then(function(convertedPrice) {
        console.log("FINAL CONVERTED PRICE FOR TRACK " + convertedPrice.price)
        deferred.resolve(convertedPrice.price)
      })
    })
    return deferred.promise;
  }

  // Find the price of a release given Id and currency ID
  // if the release doesn't have a price, lunches the search on all the subtracks
  function findPriceRelease(idRelease, idCurrency) {

    var deferred = Q.defer();
    model.Release.find({
      attributes: ['id', 'Price'],
      where: {
        id: idRelease
      },
      include: {
        model: model.Track,
        attributes: ['id', 'Price']
      }
    }).then(function(release) {
      if (release.Price) { // I have a price and is not null (check the behavior when PRICE in db is 0.00)
        model.ConvertedPrice.find({
          where: {

            CurrencyId: idCurrency,
            MasterPrice: release.Price
          }
        }).then(function(convertedPrice) {
          console.log("FINAL CONVERTED PRICE FOR RELEASE " + convertedPrice.price)
          deferred.resolve(convertedPrice.price)
        })
      } else {
        console.log("I DON'T HAVE A PRICE FOR THIS RELEASE")
        var promisesArray = [];
        for (var t = 0; t < release.Tracks.length; t++) {
          promisesArray.push(findPriceTrack(release.Tracks[t].id, idCurrency));

        }
        // SUM ALL THE TRACKS THAT BELONGS TO THE ARRAY
        Q.all(promisesArray).then(function(results) {
            var sumPrices = 0;
            for (var r = 0; r < results.length; r++) {
              sumPrices += results[r];
            }
            deferred.resolve(sumPrices);
          }, console.error)
          // THE RELEASE DOESN't HAVE A PRICE SO WE NEED TO CALCULATE THE SUB PRICES 
          /* 
          var groupPromise = Q.all([doThis(), doThat()])
          groupPromise.then(function(results) {}, console.error)
          */
      }
    })
    return deferred.promise;
  }

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
    var currency = req.body.currency;
    var cart = req.body.cart;


    // RECALCULATE THE PRICE - serverside.
    var promisesArray = [];
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id.indexOf('track') > -1) { // THIS IS A TRACK 
        promisesArray.push(findPriceTrack(cart[i].id.split("-").pop(), currency.id)) //get the ID from release
      }
      if (cart[i].id.indexOf('release') > -1) { // THIS IS A RELEASE 
        promisesArray.push(findPriceRelease(cart[i].id.split("-").pop(), currency.id)); //get the ID from release
      }
    }

    Q.all(promisesArray).then(function(results) {
      console.log("ALL SETTLEs")
      var sumPrices = 0.0;
      for (var r = 0; r < results.length; r++) {

        sumPrices += (results[r] * cart[r].quantity) // multiply by quantity ;
      }

      sumPrices = sumPrices.toFixed(2); // SET TO DECIMALS
      sumPrices = sumPrices * 100;

      // TODO REMEMBER TO ADD THE VAT 

      console.log("FINAL PRICE " + sumPrices)

      //I HAVE THE TOTAL PRICE 
      //
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

        stripe.customers.create({
          source: token,
          email: user.email
        }).then(function(customer) {
          console.log("CUSTOMER RECEIVED ");
          // console.log(customer);

          var cloudURL = ''
          var packURL = ''


          stripe.charges.create({
            amount: sumPrices,
            currency: currency.shortname, //ISO NAME
            customer: customer.id,
            metadata: {
              // CHANCE TO PIGGy BACK HERE SOME ADDITIONAL INFORMATION
              // TODO consider if we want to have a TRANSACTION ID in our db
            },
          }, function(err, charge) {

            if (!err) {
              // GOT IT ! 
              // PAYMENT as been done correctly, should move the just bought tracks to the library of the user
              // RELEASE should be expanded into tracks.
              // 
              console.log("PAYMENT RECEIVED! ")
              res.send(charge);
            }
          });


          // Here fetch the cloud link to the product that has been purcheased.

        });


      });




    }, console.error)






  });



} /* End of payment controller */
