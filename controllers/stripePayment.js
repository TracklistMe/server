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
  function findPriceTrack(idTrack, idCurrency, quantity) {
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
        //Return an object that include trackId, releaseId, labelId, trackPrice,
        // trackConvertedPrice, CurrencyId.
        var track = {
          trackId: idTrack,
          releaseId: 0,
          labelId: 0,
          trackConvertedPrice: convertedPrice.price,
          currencyId: idCurrency,
          quantity: quantity
        };
        deferred.resolve(track);
      });
    });
    return deferred.promise;
  }

  /**
   * Find the price of a release given idRelease and idCurrency
   * If the release doesn't have a price, return the sum of tracks prices
   * TODO: move to model
   */
  function findPriceRelease(idRelease, idCurrency, quantity) {

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
          // The release has a special bundle cost.
          // Distribute the price towards each track. 
          console.log(convertedPrice.price, release.Tracks.length);
          var distributedCost = convertedPrice.price / release.Tracks.length;
          var tracksList = [];
          for (var i = 0; i < release.Tracks.length; i++) {
            var track = {
              trackId: release.Tracks[i].id,
              releaseId: idRelease,
              labelId: 0, //TODO (bortignon@)
              trackConvertedPrice: distributedCost,
              currencyId: idCurrency,
              quantity: quantity
            };
            tracksList.push(track);
          }
          // Return the list of all the tracks including 
          // the price for each of them.
          deferred.resolve(tracksList);
        });
      } else {
        // A price for the release does not exist,
        // the total price is actually the sum of all the single track's price.
        var promisesArray = [];
        for (var t = 0; t < release.Tracks.length; t++) {
          promisesArray.push(
            findPriceTrack(release.Tracks[t].id, idCurrency, quantity));
        }
        // Sum the prices of all the tracks in the release
        Q.all(promisesArray).then(function(results) {
          deferred.resolve(promisesArray);
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


  function registerTrackTransaction(idTrack) {

  }


  /**
   * POST /payments/
   * Process the payment.
   * 1) Recalculate the price on the server side
   *    1A) Convert the Tracklistme Price into the Currency price
   *    1B) Aggregate costs
   * 
   * 2) Create the transaction for Stripe
   *
   * 3) if 2), move all the tracks in the user Library. Release are expanded,
   * and the tracks that belong to them added one by one. Tracks that was 
   * already purcheased are update.  
   *
   * 4) Create the transaction report.   
   *  
   */
  app.post('/payments',
    authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      var token = req.body.token;
      var userId = req.user;
      var currency = req.body.currency;
      var cart = req.body.cart;
      var taxRate = req.body.taxRate;
      // 1) Recompute the price for the currency.
      var promisesArray = [];
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].id.indexOf('track') > -1) {
          // Price of a track 
          // Get track ID
          promisesArray.push(
            findPriceTrack(
              parseInt(cart[i].id.split('-').pop()),
              currency.id,
              cart[i].quantity
            )
          );
        }
        if (cart[i].id.indexOf('release') > -1) {
          // Price of a release
          // Get release ID
          promisesArray.push(
            findPriceRelease(
              parseInt(cart[i].id.split('-').pop()),
              currency.id,
              cart[i].quantity
            )
          );
        }
      }

      Q.all(promisesArray).then(function(results) {
        var tracks = [];
        for (var r = 0; r < results.length; r++) {
          if (results[r].constructor === Array) {
            console.log("array")
            tracks = tracks.concat(results[r]);
          } else {
            console.log("traccia")
            tracks.push(results[r]);
          }
          console.log(tracks.length);
        }

        var sumPrices = 0.0;
        var totalTaxToPay = 0.0;
        var finalAmount = 0.0;
        for (var r = 0; r < tracks.length; r++) {
          // multiply by quantity
          console.log("++++++++");
          console.log(tracks[r]);
          sumPrices += (tracks[r].trackConvertedPrice * tracks[r].quantity);
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
        // Validate if the userId is a valid user
        // Todo(bortignon@):  we may want to prevent a user to purchease if 
        // he hasn't confirm his account now OR if has been tracked as malevolus
        // user.
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

          // Initialize the stripe checkout process.
          // first create a user. Composed by CARD Token (calculate client side)
          // and email of the user.
          stripe.customers.create({
            source: token,
            email: user.email
          }).then(function(customer) {
            console.log('CUSTOMER RECEIVED ');

            stripe.charges.create({
              amount: finalAmount,
              currency: currency.shortname,
              customer: customer.id,
              expand: ['balance_transaction'],
              metadata: {
                // TODO (bortignon@, mziccard@) consider if we want to have 
                // a TRANSACTION ID in our db
              },
            }, function(err, charge) {
              console.log(charge);
              console.log(charge.balance_transaction);
              if (!err) {
                // GOT IT ! 
                // PAYMENT as been done correctly, should move the just 
                // bought tracks to the library of the user
                // RELEASE should be expanded into tracks.  
                var cartToLibrary = [];
                // STEP 3: MOVE TRACKS TO USER LIBRARY 
                for (var i = 0; i < cart.length; i++) {
                  console.log(cart[i]);
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
                // STEP 4: Create the transaction REPORT 
                //PART THAT ADS THE INFORMATION TO THE TRANSACTIONS LIBRARY.
                /*id: PK, autoincrement
                    itemId: PK on trackID but should not be deleted if the 
                    Track is deleted.

                    originalPrice: decimal 10,2 //initial price selected by 
                    the user, if comes from the bundle is a fair split

                    taxPercentagePayed: 10,2 // should be integer, but let
                     keep it scalable
                    taxPayed: 10,2 // the amount of tax payed 

                    OriginalTransactionCurrencyId: PK on currency
                    country: // the country from where the user made the 
                    trunsaction

                    transactionCost: decimal 10,2 // transaction price equally 
                    split between all the tracks in the transaction
                    
                    finalPrice: decimal 10,2 // original price - 
                    
                    transactionPrice - tax
                    
                    storedTransactionCurrencyId: PK on currency
                    
                    stripeTransactionId: string, 64 char. Is the id used 
                    internally by stripe, useful for retrive information 
                    from them.

                    the following fields are for navigation purpose in 
                    the report system

                    releaseId: PK on releaseId but should not be deleted if 
                    the Release is deleted 
                    labelId: PK on labelId but should not be deleted if the 

                    Label is deleted
                    companyId: PK on companyId but should not be deleted if 
                    the Company is deleted
                */

                for (var i = 0; i < cart.length; i++) {
                  console.log(cart[i]);
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
