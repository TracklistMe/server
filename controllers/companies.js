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
   * Jumps to next middleware function passing valiation errors
   *
   * @param {array} errors - An array of validation errors
   * @param {function} next - Middleware function to continue the call chain
   */
  function throwValidationError(errors, next) {
    var err = new Error();
    err.status = 400;
    err.message = 'There have been validation errors';
    err.validation = errors;
    return next(err);
  }

  /**
   * Ensures current user is the owner of the company (or an admin). Company Id
   * must be provided either in post or in get
   *
   * @param {object} req - The request object
   * @param {integer} req.params.companyId - The id of the company
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureCompanyOwner(req, res, next) {
    req.checkParams('companyId', 'Invalid company id').notEmpty().isInt();
    var errors = req.validationErrors();
    if (errors) {
      return throwValidationError(errors, next);
    }
    authenticationUtils.checkScopes(['admin'])(req, res, function(err) {
      if (!err) {
        return next();
      }
      var companyId = req.params.companyId;
      var userId = req.user;
      model.Company.find({
        include: [{
          model: model.User,
          required: true,
          where: {
            'id': userId
          }
        }],
        where: {
          id: companyId
        }
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 401;
          err.message = 'You don\'t have access to the requested resource';
          return next(err);
        }
        return next();
      });
    });
  }

  /**
   * GET /companies/search/:searchString
   * Return the list of companies whose displayName exactly matches the search
   * string
   *
   * @param {object} req - The request object
   * @param {string} req.body.searchString - The string to search, supposed
   *     name of the company
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/companies/search/:searchString',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {
      req.checkParams('searchString', 'Invalid search string').notEmpty();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var searchString = req.params.searchString;
      model.Company.find({
        where: {
          displayName: searchString
        }
      }).then(function(companies) {
        res.send(companies);
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /*
   * GET /companies/
   * Return list of all the companies
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   */
  app.get('/companies/',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {
      model.Company.findAll().then(function(companies) {
        res.send(companies);
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST /companies/
   * Add a new company, returns all the companies
   *
   * @param {object} req - The request object
   * @param {string} req.body.companyName - The new company's name
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/companies/',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {

      req.checkBody('companyName', 'Missing company name').notEmpty();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var companyName = req.body.companyName;

      model.Company.create({
        displayName: companyName
      }).then(function() {
        model.Company.findAll().then(function(companies) {
          res.send(companies);
        });
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /companies/:companyId/labels
   * Returns all the labels owned by a given company
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/companies/:companyId/labels',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {

      req.checkParams('companyId', 'Company id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var companyId = req.params.companyId;
      model.Company.find({
        where: {
          id: companyId
        },
        include: [{
          model: model.Label,
          required: false
        }]
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested company does not exist';
          return next(err);
        }
        res.send(company.Labels);
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /companies/id
   * Return the company with id passed as part of the path. An empty object if
   * no company exists.
   * This endpoint is limited to admin only. We may consider at some point to
   * release a lighter way for having an all user access (for promo proposal)
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/companies/:companyId',
    authenticationUtils.ensureAuthenticated,
    ensureCompanyOwner,
    function(req, res, next) {
      req.checkParams('companyId', 'Company id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var companyId = req.params.companyId;
      model.Company.find({
        where: {
          id: companyId
        },
        include: [{
          model: model.User,
          attributes: ['displayName'],
          required: false
        }]
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        res.send(company);
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * PUT /companies/:companyId
   * Update the company for the provided id. This method only updates isActive
   * and displayName fields.
   *
   * @param {object} req - The request object
   * @param {string} req.body.isActive - Whether the company is active or not
   * @param {string} req.body.displayName - The new company's name
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.put('/companies/:companyId',
    authenticationUtils.ensureAuthenticated,
    ensureCompanyOwner,
    function(req, res, next) {

      req.checkBody('isActive', 'isActive field must be boolean').notEmpty()
        .isBoolean();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var companyId = req.params.companyId;
      var isActive = req.body.isActive;
      var displayName = req.body.displayName;

      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested company does not exist';
          return next(err);
        }
        var isActiveDefined = typeof isActive !== 'undefined';
        company.isActive = isActiveDefined ? isActive : company.isActive;
        company.displayName = displayName ? displayName : company.displayName;
        company.save().then(function() {
          res.send();
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /*
   * DELETE /companies/:companyId/owners/:userId
   * Delete the owner with id = userId from the owners of the company with
   * id = companyId
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.delete('/companies/:companyId/owners/:userId',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {
      var userId = req.params.userId;
      var companyId = req.params.companyId;

      model.Company.find({
        where: {
          id: companyId
        },
        include: [{
          model: model.User,
          required: true,
          where: {
            id: userId
          }
        }]
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested user is not company owner';
          return next(err);
        }
        company.removeUser(company.Users[0]).then(function() {
          res.send();
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST /companies/:companyId/owners/
   * Adds an owner to the company
   *
   * @param {object} req - The request object
   * @param {integer} req.body.newOwner - The id of the new owner
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/companies/:companyId/owners',
    authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['admin']),
    function(req, res, next) {

      req.checkParams('companyId', 'Company id is invalid').notEmpty().isInt();
      req.checkBody( 'newOwner', 'New owner id is invalid')
        .notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var newOwnerId = req.body.newOwner;
      var companyId = req.params.companyId;

      model.Company.find({
        where: {
          id: companyId
        }
      }).then(function(company) {
        if (!company) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested company does not exist';
          return next(err);
        }
        model.User.find({
          where: {
            id: newOwnerId
          }
        }).then(function(user) {
          if (!user) {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested user does not exist';
            return next(err);
          }
          company.addUsers(user).then(function() {
            res.send();
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        }).catch(function(err) {
          err.status = 500;
          return next(err);
        });
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /labels/:companies/revenues/expantend/:startDate?/:endDate?
   * The total company's revenues, grouped by label and with possibility to
   * filter by date.
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/companies/:companyId/revenues/expanded/:startDate?/:endDate?',
    authenticationUtils.ensureAuthenticated,
    ensureCompanyOwner,
    function(req, res, next) {
      var startDate = moment(req.params.startDate, "DD-MM-YYYY", true);
      var endDate = moment(req.params.endDate, "DD-MM-YYYY", true).endOf('day');

      if (startDate && startDate.isValid()) {
        //startDate is valid
        startDate = startDate.format();
        console.log(startDate);
        if (endDate && endDate.isValid()) {
          //end Date is Valid
          endDate = endDate.format();
        } else {
          endDate = moment().utcOffset(0).format();
        }
      } else {
        startDate = moment().startOf('quarter').format();
        endDate = moment().utcOffset(0).format();
      }
      var companyId = req.params.companyId;
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
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST '/labels/:labelId/profilePicture/createFile'
   * Request a CDN policy to upload a new profile picture, if an update was
   * already in progress the old request is deleted from the CDN
   */
  app.post('/companies/:companyId/profilePicture/createFile',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwner,
    imagesController.createImageFactory('logo', helper));

  /**
   * POST '/labels/:labelId/profilePicture/confirmFile'
   * Confirm the upload of the requested new logo, store it in the database
   * as label information
   */
  app.post('/companies/:companyId/profilePicture/confirmFile',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwner,
    imagesController.confirmImageFactory(
      'logo', ['small', 'medium', 'large'], helper));

  /**
   * GET '/labels/:labelId/profilePicture/:size(small|large|medium)'
   * Get the label logo in the desired size, if it does not exist download the
   * original logo and resize it
   */
  app.get('/companies/:companyId/profilePicture/:size(small|medium|large)',
    imagesController.getImageFactory('logo', helper));

}; /* End of companies controller */
