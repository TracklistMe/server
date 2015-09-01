'use strict';

var fs = require('fs-extra');
var moment = require('moment');
var imagesController = rootRequire('controllers/images');
var helper = rootRequire('helpers/companies');
var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');

module.exports.controller = function(app) {
  var Sequelize = model.sequelize();


  /**
   * GET /companies/search/
   * Return the list of companies whose displayName resembles the search string
   * TODO: paginate request
   */
  app.get('/companies/search/:searchString',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var searchString = req.params.searchString;
      model.Company.find({
        where: {
          displayName: searchString
        }
      }).then(function(companies) {
        res.send(companies);
      });
    });

  /*
   * GET /companies/
   * Return list of all the companies
   * TODO: paginate request
   */
  app.get('/companies/',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      model.Company.findAll().then(function(companies) {
        res.send(companies);
      });
    });

  /**
   * POST /companies/
   * Add a new company, returns all the companies
   */
  app.post('/companies/',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {

      var companyName = req.body.companyName;

      model.Company.create({
        displayName: companyName
      }).then(function() {
        model.Company.findAll().then(function(companies) {
          res.send(companies);
        });
      });
    });

  /**
   * GET /companies/id/labels
   * Return all the labels owned by a given company
   */
  app.get('/companies/:id/labels',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var companyId = req.params.id;
      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        if (company) {
          company.getLabels().then(function(associatedLabels) {
            res.send(associatedLabels);
          });
        } else {
          res.send(company);
        }
      });
    });

  /**
   * GET /companies/id
   * Return the company with id passed as part of the path. An empty object if
   * no company exists.
   * This endpoint is limited to admin only. We may consider at some point to
   * release a lighter way for having an all user access (for promo proposal)
   */
  app.get('/companies/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var companyId = req.params.id;
      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        // rewrite with inclusion 
        if (company) {
          company.getUsers({
            attributes: ['displayName']
          }).then(function(associatedUsers) {
            company.dataValues.owners = (associatedUsers);
            res.send(company);
          });
        } else {
          res.send(company);
        }
      });
    });

  /**
   * PUT /companies/id
   * Update the company with given Id and return the updated company
   */
  app.put('/companies/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var companyId = req.params.id;

      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        if (company) { // if the record exists in the db
          company.updateAttributes(req.body).then(function() {
            res.send();
          });
        }
      });
    });

  /*
   * DELETE /companies/:idCompany/owners/:idUser
   * Delete the owner with id = idUser from the owners of the company with
   * id = idCompany
   */
  app.delete('/companies/:companyId/owners/:userId',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var ownerId = req.params.userId;
      var companyId = req.params.companyId;

      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        console.log('REMOVE USER FROM COMPANY');
        company.getUsers({
          where: {
            id: ownerId
          }
        }).then(function(users) {
          if (users && users.length === 1) {
            company.removeUser(users[0]).then(function() {
              res.send();
            });
          }
        });
      });
    });

  /**
   * POST /companies/:idCompany/owners/
   * POST {newOwner} - The id of the user to add
   * Add an owner to the company
   */
  app.post('/companies/:companyId/owners',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var newOwnerId = req.body.newOwner;
      var companyId = req.params.companyId;

      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        company.getUsers({
          where: {
            id: newOwnerId
          }
        }).then(function(users) {
          if (users.length === 0) {
            model.User.find({
              where: {
                id: newOwnerId
              }
            }).then(function(user) {
              company.addUsers(user).then(function() {
                res.send();
              });
            });
          } else {
            console.log('This user was already associated to this company!');
            // TODO, there was an error, need to handle it
          }
        });
      });
    });

  /**
   * POST /companies/:companyId/profilePicture/:width/:height
   * Add a profile picture for the company
   */
  app.post('/companies/:companyId/profilePicture/:width/:height/',
    authenticationUtils.ensureAuthenticated,
    fileUtils.uploadFunction(
      fileUtils.localImagePath, fileUtils.remoteImagePath),
    fileUtils.resizeFunction(
      fileUtils.localImagePath, fileUtils.remoteImagePath),
    function(req, res) {
      var companyId = req.params.companyId;
      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        var oldLogo = company.logo;
        var oldFullSizeLogo = company.fullSizeLogo;
        company.logo =
          fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
        company.fullSizeLogo =
          fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);

        company.save().then(function() {
          // we remove old avatars from the CDN
          cloudstorage.remove(oldLogo);
          cloudstorage.remove(oldFullSizeLogo);
          // We remove temporarily stored files
          fs.unlink(
            fileUtils.localImagePath(
              req,
              req.uploadedFile[0].filename));
          fs.unlink(
            fileUtils.localImagePath(
              req,
              req.uploadedFile[0].resizedFilename));

          res.send(JSON.stringify(req.uploadedFile));
        });
      });
    });


  /**
   * API FOR FETCHING REPORTS
   * All dates are expressed in MM-DD-YYYY
   */



  /*
    The total label's revenues, with possibility to filter by date.
  */
  app.get('/companies/:id/revenues/expanded/:startDate?/:endDate?',
    //   authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      console.log(req.params.startDate);
      var startDate = moment(req.params.startDate, "DD-MM-YYYY", true);
      var endDate = moment(req.params.endDate, "DD-MM-YYYY", true).endOf('day');

      console.log("IS VALID: " + startDate.isValid());
      if (startDate && startDate.isValid()) {
        //startDate is valid
        startDate = startDate.format();
        console.log(startDate);
        if (endDate && isValidDate(endDate)) {
          //end Date is Valid
          endDate = endDate.format();
        } else {
          endDate = moment().utcOffset(0).format();
        }
      } else {
        startDate = moment().startOf('quarter').format();
        //CloudSQL date is different that Cloud Engine 
        endDate = moment().utcOffset(0).format();
        console.log(endDate);
        // reset both startDate and endDate
      }
      var companyId = req.params.id;
      model.Transaction.findAll({
        attributes: ['LabelId', [Sequelize.fn('DATE_FORMAT',
            Sequelize.col('Transaction.createdAt'), '%d/%m/%y'), 'dataColumn'],
          [Sequelize.fn('SUM', Sequelize.col('finalPrice')), 'price']
        ],
        include: [{
          model: model.Label,
          attributes: ['displayName']
        }],
        where: {
          CompanyId: companyId,
          createdAt: {
            $between: [startDate, endDate],
          }
        },
        order: 'dataColumn',
        group: ['Transaction.LabelId', 'dataColumn']
      }).then(function(results) {
        res.send(results);
      });
    });

  /**
   * POST '/labels/:labelId/profilePicture/createFile'
   * Request a CDN policy to upload a new profile picture, if an update was
   * already in progress the old request is deleted from the CDN
   */
  app.post('/companies/:companyId/profilePicture/createFile',
    authenticationUtils.ensureAuthenticated,
    imagesController.createImageFactory('logo', helper));

  /**
   * POST '/labels/:labelId/profilePicture/confirmFile'
   * Confirm the upload of the requested new logo, store it in the database
   * as label information
   */
  app.post('/companies/:companyId/profilePicture/confirmFile',
    authenticationUtils.ensureAuthenticated,
    imagesController.confirmImageFactory(
      'logo', ['small', 'medium', 'large'], helper));

  /**
   * GET '/labels/:labelId/profilePicture/:size(small|large|medium)'
   * Get the label logo in the desired size, if it does not exist download the
   * original logo and resize it
   */
  app.get('/companies/:companyId/profilePicture/:size(small|medium|large)',
    imagesController.getImageFactory('logo', helper));


  function isValidDate(date) {
    var matches = /^(\d{2})[-](\d{2})[-](\d{4})$/.exec(date);
    if (matches == null) return false;
    var d = matches[2];
    var m = matches[1] - 1;
    var y = matches[3];

    var composedDate = new Date(y, m, d);
    return composedDate.getDate() == d &&
      composedDate.getMonth() == m &&
      composedDate.getFullYear() == y;
  }


}; /* End of companies controller */
