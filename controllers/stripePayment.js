'use strict';
var Q = require('q');
var config = rootRequire('config/config');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var stripe = require('stripe')(config.STRIPE_PRIVATE);

module.exports.controller = function(app) {



  /**
   * Find the price of a track given idTrack and idCurrency
   */
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
        console.log('FINAL CONVERTED PRICE FOR TRACK ' + convertedPrice.price);
        deferred.resolve(convertedPrice.price);
      });
    });
    return deferred.promise;
  }

  /**
   * Find the price of a release given idRelease and idCurrency
   * If the release doesn't have a price, return the sum of tracks prices
   * TODO: move to model
   */
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
      if (release.Price) {
        // A price for the release exists 
        // (check the behavior when PRICE in db is 0.00)
        model.ConvertedPrice.find({
          where: {
            CurrencyId: idCurrency,
            MasterPrice: release.Price
          }
        }).then(function(convertedPrice) {
          console.log(
            'FINAL CONVERTED PRICE FOR RELEASE ' +
            convertedPrice.price);
          deferred.resolve(convertedPrice.price);
        });
      } else {
        // A price for the release does not exist
        var promisesArray = [];
        for (var t = 0; t < release.Tracks.length; t++) {
          promisesArray.push(
            findPriceTrack(release.Tracks[t].id, idCurrency));
        }
        // Sum the prices of all the tracks in the release
        Q.all(promisesArray).then(function(results) {
          var sumPrices = 0;
          for (var r = 0; r < results.length; r++) {
            sumPrices += results[r];
          }
          deferred.resolve(sumPrices);
        }, console.error);
        /* 
        var groupPromise = Q.all([doThis(), doThat()])
        groupPromise.then(function(results) {}, console.error)
        */
      }
    });
    return deferred.promise;
  }

  function moveTrackToLibrary(idTrack, idUser) {
    var deferred = Q.defer();
    model.LibraryItem.upsert({
      TrackId: idTrack,
      UserId: idUser
    }).then(function() {
      deferred.resolve(idTrack);
    });
    return deferred.promise;
  }

  function moveReleaseToLibrary(idRelease, idUser) {
    var deferred = Q.defer();
    var tracksToAdd = [];
    model.Release.find({
      attributes: ['id'],
      where: {
        id: idRelease
      },
      include: {
        model: model.Track,
        attributes: ['id']
      }
    }).then(function(release) {

      for (var t = 0; t < release.Tracks.length; t++) {
        tracksToAdd.push(moveTrackToLibrary(release.Tracks[t].id, idUser));
      }
    });
    // call for each track.
    Q.all(tracksToAdd).then(function() {
      deferred.resolve();
    });
    return deferred.promise;
  }



  /**
   * POST /payment/:idToken
   * Return the list of labels whose displayName exactly matches the search
   * string
   */
  app.post('/payments',
    authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      var token = req.body.token;
      var userId = req.user;
      var currency = req.body.currency;
      var cart = req.body.cart;
      var taxRate = req.body.taxRate;

      // Recompute the price for the currency.
      var promisesArray = [];
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].id.indexOf('track') > -1) {
          // Price of a track 
          // Get track ID
          promisesArray.push(
            findPriceTrack(cart[i].id.split('-').pop(), currency.id));
        }
        if (cart[i].id.indexOf('release') > -1) {
          // Price of a release
          // Get release ID
          promisesArray.push(
            findPriceRelease(cart[i].id.split('-').pop(), currency.id));
        }
      }

      Q.all(promisesArray).then(function(results) {
        var sumPrices = 0.0;
        var totalTaxToPay = 0.0;
        var finalAmount = 0.0;
        for (var r = 0; r < results.length; r++) {
          // multiply by quantity
          sumPrices += (results[r] * cart[r].quantity);
        }
        // calculate the total taxes on the final amount
        console.log(sumPrices);
        totalTaxToPay = (sumPrices * (taxRate) / 100).toFixed(2);
        console.log(totalTaxToPay);
        // update the final billable amount
        finalAmount = parseInt(sumPrices * 100) +
          parseInt(totalTaxToPay * 100);
        //Multiply by 100.


        console.log('FINAL PRICE ' + finalAmount);

        model.User.find({
          where: {
            id: userId
          }
        }).then(function(user) {
          if (!user) {
            var err = new Error();
            err.status = 401;
            err.message = 'You can\'t buy because you are not an user!';
            return next(err);
          }

          stripe.customers.create({
            source: token,
            email: user.email
          }).then(function(customer) {
            console.log('CUSTOMER RECEIVED ');

            stripe.charges.create({
              amount: finalAmount,
              currency: currency.shortname,
              customer: customer.id,
              metadata: {
                // CHANCE TO PIGGY BACK HERE SOME ADDITIONAL INFORMATION
                // TODO consider if we want to have a TRANSACTION ID in our db
              },
            }, function(err, charge) {
              console.log(err);
              if (!err) {
                // GOT IT ! 
                // PAYMENT as been done correctly, should move the just 
                // bought tracks to the library of the user
                // RELEASE should be expanded into tracks.  
                var cartToLibrary = [];
                for (var i = 0; i < cart.length; i++) {
                  if (cart[i].id.indexOf('track') > -1) {
                    // Move the track to the library
                    cartToLibrary.push(
                      moveTrackToLibrary(cart[i].id.split('-').pop(),
                        userId));
                  }
                  if (cart[i].id.indexOf('release') > -1) {
                    // Move the release to the library, by adding all the tracks
                    // included in the release
                    cartToLibrary.push(
                      moveReleaseToLibrary(cart[i].id.split('-').pop(),
                        userId));
                  }
                }
                Q.all(cartToLibrary).then(function() {
                  res.send(charge);
                });

              }
            });
          });
        });
      }, console.error);

    });
}; /* End of payment controller */
