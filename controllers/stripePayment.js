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
      include: [{
        model: model.Release,
        include: [{
          model: model.Label,
          include: [{
            model: model.Company
          }]
        }]
      }]
    }).then(function(track) {
      model.ConvertedPrice.find({
        where: {
          CurrencyId: idCurrency,
          MasterPrice: track.Price
        }
      }).then(function(convertedPrice) {
        //Return an object that include trackId, releaseId, labelId, trackPrice,
        // trackConvertedPrice, CurrencyId.
        var trackObject = {
          trackId: idTrack,
          companyId: track.Releases[0].Labels[0].Companies[0].id,
          releaseId: track.Releases[0].id,
          labelId: track.Releases[0].Labels[0].id,
          trackConvertedPrice: convertedPrice.price,
          currencyId: idCurrency,
          quantity: quantity
        };
        deferred.resolve(trackObject);
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
      include: [{
        model: model.Track,
        attributes: ['id', 'Price']
      }, {
        model: model.Label,
        attributes: ['id'],
        include: [{
          model: model.Company,
          attributes: ['id']
        }]
      }]
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
          var distributedCost = convertedPrice.price / release.Tracks.length;
          var tracksList = [];
          for (var i = 0; i < release.Tracks.length; i++) {
            var track = {
              trackId: release.Tracks[i].id,
              releaseId: idRelease,
              labelId: release.Labels[0].id,
              companyId: release.Labels[0].Companies[0].id,
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

  function registerTrackTransaction(trackTransactionInfo) {
    var deferred = Q.defer();
    model.Transaction.create(
      trackTransactionInfo
    ).then(function(result) {
      deferred.resolve(result);
    });
    return deferred.promise;
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
            //it's a full array of tracks
            tracks = tracks.concat(results[r]);
          } else {
            //it's only a track.
            tracks.push(results[r]);
          }
        }

        var sumPrices = 0.0;
        var totalTaxToPay = 0.0;
        var finalAmount = 0.0;
        for (var r = 0; r < tracks.length; r++) {
          // multiply by quantity
          sumPrices += (tracks[r].trackConvertedPrice * tracks[r].quantity);
        }

        // calculate the total taxes on the final amount
        totalTaxToPay = (sumPrices * (taxRate) / 100).toFixed(2);

        // update the final billable amount
        finalAmount = parseInt(sumPrices * 100) +
          parseInt(totalTaxToPay * 100);


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

              if (!err) {
                // GOT IT ! 

                var stripeAmount = charge.balance_transaction.amount;
                var stripeNet = charge.balance_transaction.net;
                var stripeFee = charge.balance_transaction.fee;

                // Percentage [0/1] gone on stripe 3 digits precision.
                var feePercentage =
                  Math.ceil(stripeFee / stripeAmount * 1000) / 1000;


                // PAYMENT as been done correctly, should move the just 
                // bought tracks to the library of the user
                // RELEASE should be expanded into tracks.  
                var cartToLibrary = [];

                for (var i = 0; i < tracks.length; i++) {
                  // this is calculated in the currency payed by the user
                  var trackTaxAmountPayed = Math.ceil(100 *
                    taxRate *
                    tracks[i].trackConvertedPrice / 100) / 100;

                  var consumerCost = tracks[i].trackConvertedPrice +
                    trackTaxAmountPayed;

                  var ratioPayedOnTotal = consumerCost / charge.amount * 100;

                  // STEP 3: MOVE TRACKS TO USER LIBRARY
                  cartToLibrary.push(
                    moveTrackToLibrary(
                      tracks[i].trackId,
                      userId
                    )
                  );
                  // STEP 4: Create the transaction REPORT
                  // Pro Rata calculation:
                  // ProRata = TotalValue ITEMPRICE/TOTALPRICE
                  // Multiply this by the number of tracks bought 
                  // (tracks[i].quantity)
                  // STEP 4: Create the transaction REPORT 
                  //PART THAT ADS THE INFORMATION TO THE TRANSACTIONS LIBRARY.
                  /*id: PK, autoincrement
                    itemId: PK on trackID but should not be deleted if the 
                    Track is deleted.

                    originalPrice: decimal 10,2 //initial price selected by 
                    the user.

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
                  for (var q = 0; q < tracks[i].quantity; q++) {
                    cartToLibrary.push(
                      registerTrackTransaction({
                        ItemId: tracks[i].trackId, //itemID
                        // IN THE ORIGINAL CURRENCY 
                        originalPrice: tracks[i].trackConvertedPrice * 100,
                        taxPercentagePayed: taxRate,
                        taxAmountPayed: taxRate * tracks[i].trackConvertedPrice,
                        OriginalTransactionCurrencyId: currency.id,
                        // IN THE STRIPE CURRENCY FROM NOW ON
                        transactionCost: Math.ceil(stripeFee * ratioPayedOnTotal * 100) / 100,
                        finalPrice: Math.floor(stripeNet * ratioPayedOnTotal * 100) / 100,
                        stripeTransactionId: charge.id,
                        ReleaseId: tracks[i].releaseId,
                        LabelId: tracks[i].labelId,
                        CompanyId: tracks[i].companyId
                      })
                    );
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
