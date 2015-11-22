'use strict';

var moment = require('moment');
var imagesController = rootRequire('controllers/images');
var helper = rootRequire('helpers/labels');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var beatport = rootRequire('libs/beatport/beatport');
var rabbitmq = rootRequire('libs/message_broker/rabbitmq');

module.exports.controller = function(app) {
  var Sequelize = model.sequelize();
  var MAX_FILE_SIZE = 104857600;
  var POLICY_DURATION_MILLIS = 60 * 1000;

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
   * Ensures current user is the owner of the company (or admin)
   *
   * @param {object} req - The request object
   * @param {integer} req.body.companyId - The id of the label's company
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureCompanyOwner(req, res, next) {
    req.checkBody('companyId', 'Invalid company id').notEmpty().isInt();
    var errors = req.validationErrors();
    if (errors) {
      return throwValidationError(errors, next);
    }
    authenticationUtils.checkScopes(['admin'])(req, res, function(err) {
      if (!err) {
        return next();
      }
      var companyId = req.body.companyId;
      var userId = req.user;
      model.Company.find({
        include: [{
          model: model.User,
          required: true,
          where: {
            id: userId
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
   * Ensure current user is an owner of the company who owns the label (or
   * admin)
   *
   * @param {object} req - The request object
   * @param {integer} req.body.labelId - The id of the label
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureCompanyOwnerFromLabel(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
    authenticationUtils.checkScopes(['admin'])(req, res, function(err) {
      if (!err) {
        return next();
      }
      model.Company.find({
        include: [{
          model: model.Label,
          required: true,
          where: {
            id: labelId
          }
        }, {
          model: model.User,
          required: true,
          where: {
            id: userId
          }
        }],
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
   * Ensure current user is a manager of the selected label (or admin)
   *
   * @param {object} req - The request object
   * @param {integer} req.body.labelId - The id of the label
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureLabelManager(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
    authenticationUtils.checkScopes(['admin'])(req, res, function(err) {
      if (!err) {
        return next();
      }
      model.Label.find({
        include: [{
          model: model.User,
          required: true,
          where: {
            id: userId
          }
        }],
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 401;
          err.message = 'You don\'t have access to the requested resource ';
          return next(err);
        }
        return next();
      });
    });
  }

  /**
   * Ensure current user is either admin, company owner or label manager. This
   * is implemented by composing ensureLabelManagerOrCompanyOwner and
   * ensureCompanyOwnerFromLabel. First we check the user is label manager, if
   * he is not we check he is a company owner.
   *
   * @param {object} req - The request object
   * @param {string} req.body.labelId - The id of the label
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  function ensureLabelManagerOrCompanyOwner(req, res, next) {
    ensureLabelManager(req, res, function(err) {
      if (err) {
        return ensureCompanyOwnerFromLabel(req, res, next);
      }
      return next();
    });
  }

  /**
   * GET /labels/search/:searchString
   * Return the list of labels whose displayName resambles the search string
   *
   * @param {object} req - The request object
   * @param {string} req.body.searchString - The string to search, supposed
   *     name of the label
   * @param {object} res - The response object
   */
  app.get('/labels/search/:searchString', function(req, res) {
    req.checkParams('searchString', 'Invalid search string')
      .notEmpty();
    var errors = req.validationErrors();
    if (errors) {
      return throwValidationError(errors, next);
    }
    var searchString = req.params.searchString;
    model.Label.findAll({
      where: ['displayName LIKE ?', '%' + searchString + '%']
    }).then(function(labels) {
      res.send(labels);
    }).catch(function(err) {
      err.status = 500;
      return next(err);
    });
  });

  /**
   * GET /labels/search/:searchString
   * Return the list of labels whose displayName exactly matches the search
   * string
   *
   * @param {object} req - The request object
   * @param {integer} req.body.searchString - The string to search, supposed
   *     name of the label
   * @param {object} res - The response object
   */
  app.get('/labels/searchExact/:searchString', function(req, res) {
    req.checkParams('searchString', 'Invalid search string')
      .notEmpty();
    var errors = req.validationErrors();
    if (errors) {
      return throwValidationError(errors, next);
    }
    var searchString = req.params.searchString;
    model.Label.find({
      where: {
        displayName: searchString
      }
    }).then(function(labels) {
      res.send(labels);
    }).catch(function(err) {
      err.status = 500;
      return next(err);
    });
  });

  /**
   * GET /labels/:labelId
   * Return the label corresponding to the passed id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/labels/:labelId', authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      req.checkParams('labelId', 'Invalid label id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var labelId = req.params.labelId;
      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (label) {
          label.getUsers({
            attributes: ['displayName']
          }).then(function(associatedUsers) {
            // todo(mziccard) Homogeneous naming?
            label.dataValues.labelManagers = associatedUsers;
            res.send(label);
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /labels/:labelId/companies
   * Return all the companies the provided label belongs to
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/labels/:labelId/companies',
    authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      req.checkParams('labelId', 'Invalid label id').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var labelId = req.params.labelId;
      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (label) {
          label.getCompanies({
            attributes: ['displayName', 'id']
          }).then(function(associatedCompanies) {
            res.send(associatedCompanies);
            }).catch(function(err) {
              err.status = 500;
              return next(err);
            });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST /labels/
   * Adds a new label (passed in POST) to the specified company (id in POST)
   *
   * @param {object} req - The request object
   * @param {integer} req.body.companyId - The company's id
   * @param {string} req.body.labelName - The new label's name
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/labels/',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwner,
    function(req, res, next) {
      req.checkBody('companyId', 'Invalid company id').notEmpty().isInt();
      req.checkBody('labelName', 'Missing label name').notEmpty();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }
      var companyId = req.body.companyId;
      var labelName = req.body.labelName;

      model.Label.findOrCreate({
        where: {
          displayName: labelName
        }
      }).then(function(label) {
        // findOrCreate promise returns an array where the first element is the
        // found/created entity, while the second element is true iff it has
        // just been created
        var created = label[1];
        label = label[0];
        if (created) {
          model.Company.find({
            where: {
              id: companyId
            }
          }).then(function(company) {
            company.addLabel(label).then(function() {
              res.send();                         
            }).catch(function(err) {
              err.status = 500;
              return next(err);
            });
          });
        } else {
          var err = new Error();
          err.status = 409;
          err.message = 'Label name already in use';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST /labels/:labelId/dropZone/createFile
   * Creates a file in the dropzone, sends in POST file information and gets a
   * signed policy to upload the file to the CDN
   *
   * @param {object} req - The request object
   * @param {string} req.body.filename - The new label's name
   * @param {string} req.body.extension - The file's extension
   * @param {integer} req.body.size - The file's size used to check whether it
   *     is valid and to create the signed policy (thus size cannot change)
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/labels/:labelId/dropZone/createFile',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkBody('filename', 'Missing filename').notEmpty();
      req.checkBody('extension', 'Missing extension').notEmpty();
      req.checkBody('extension', 'Extension not supported').isAlpha();
      req.checkBody('size', 'Filesize is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var labelId = req.params.labelId;
      var filename = req.body.filename;
      var extension = req.body.extension;
      var size = req.body.size;

      var remotePath =
        helper.remoteDropZonePath(labelId, filename + '.' + extension);
      model.Label.find({
        include: [{
          model: model.DropZoneFile,
          required: false,
          where: {
            fileName: filename,
            extension: extension
          }
        }],
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        if (label.DropZoneFiles.length === 0) {
          // Create file
          model.DropZoneFile.create({
            fileName: filename,
            extension: extension,
            status: 'UPLOADING',
            size: size,
            path: remotePath
          }).then(function(dropZoneFile) {
            model.Label.find({
              where: {
                id: labelId
              }
            }).then(function(label) {
              label.addDropZoneFiles(dropZoneFile)
                .then(function(associationFile) {
                  if (associationFile) {
                    cloudstorage.getSignedPolicy(remotePath, {
                      expires: Date.now() + POLICY_DURATION_MILLIS,
                      startsWith: ['$key', dropZoneFile.path],
                      contentLengthRange: {
                        min: 0,
                        max: MAX_FILE_SIZE
                      }
                    },
                    function(err, body) {
                      res.json(body);
                    });
                  }
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
        } else {
          // update file
          var file = label.DropZoneFiles[0];
          file.status = 'UPLOADING';
          file.size = size;
          file.path = remotePath;
          file.save().then(function() {
            cloudstorage.getSignedPolicy(remotePath, {
              expires: Date.now() + POLICY_DURATION_MILLIS,
              startsWith: ['$key', file.path],
              contentLengthRange: {
                min: 0,
                max: MAX_FILE_SIZE
              }
            },
            function(err, body) {
              res.json(body);
            });
          }).catch(function(err) {
            err.status = 500;
            err.message = 'File upload failed';
            return next(err);
          });
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * POST /labels/:idLabel/dropZone
   * Confirms the upload to the CDN of a file in the label's dropzone
   * If not confirmed the file is never shown to the user.
   *
   * @param {object} req - The request object
   * @param {string} req.body.filename - The new label's name
   * @param {string} req.body.extension - The file's extension
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/labels/:labelId/dropZone/confirmFile',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label is invalid').notEmpty().isInt();
      req.checkBody('filename', 'Missing filename').notEmpty();
      req.checkBody('extension', 'Missing extension').notEmpty().isAlpha();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var labelId = req.params.labelId;
      var filename = req.body.filename;
      var extension = req.body.extension;

      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        label.getDropZoneFiles({
          where: model.Sequelize.and({
            fileName: filename
          }, {
            extension: extension
          })
        }).then(function(files) {
          if (files.length > 0) {
            // todo(mziccard) check if file really exists in the CDN before
            // todo(mziccard) get metadata?
            var file = files[0];
            file.status = 'UPLOADED';
            file.save().then(function() {
              res.send();
            }).catch(function(err) {
              err.status = 500;
              err.message = 'File upload failed';
              console.log('File upload failed');
              return next(err);
            });
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'File not found in label dropzone';
            console.log('File not found in label dropzone');
            return next(err);
          }
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
   * DELETE /labels/:labelId/dropZone/:id
   * Delete a file from the dropZone (table and CDN) for the label with the
   * provided id
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.delete('/labels/:labelId/dropZone/:id',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkParams('id', 'DropZoneFile id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var labelId = req.params.labelId;
      var id = req.params.id;

      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        label.getDropZoneFiles({
          where: {
            id: id
          }
        }).then(function(files) {
          if (files && files.length > 0) {
            var file = files[0];
            file.destroy();
            cloudstorage.remove(file.path);
            res.send();
          } else {
            var err = new Error();
            err.status = 404;
            err.message = 'File not found in label dropzone';
            console.log('File not found in label dropzone');
            return next(err);
          }
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
   * GET /labels/:labelId/processReleases/info
   * Validates the files in the dropZone to a beatport compliant playlist
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/labels/:labelId/processReleases/info',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var labelId = req.params.labelId;
      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        label.getDropZoneFiles({
          where: model.Sequelize.and({
            extension: 'xml'
          }, {
            status: 'UPLOADED'
          })
        }).then(function(xmls) {
          beatport.validate(xmls).then(function(results) {
            res.send(results);
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
   * POST /labels/:labelId/processReleases/
   * Asks the server to process files in the dropZone as a new release
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/labels/:labelId/processReleases',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var labelId = req.params.labelId;
      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        label.getDropZoneFiles({
          where: {
            extension: 'xml'
          }
        }).then(function(xmls) {
          beatport.process(xmls, labelId).then(function(results) {
            results.forEach(function(result) {
              model.Release.consolideJSON(
                result.value.dataValues.id, 
                function(jsonRelease) {
                  rabbitmq.sendReleaseToProcess(jsonRelease);
              });
            });
            res.send(results);
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
   * POST /labels/:idLabel/labelManagers
   * Adds a new manager for the label
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.post('/labels/:labelId/labelManagers',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkBody( 'newLabelManager', 'New manager id is invalid')
        .notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var newLabelManagerId = req.body.newLabelManager;
      var labelId = req.params.labelId;

      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
        model.User.find({
          where: {
            id: newLabelManagerId
          }
        }).then(function(user) {
          if (!user) {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested user does not exist';
            return next(err);
          }
          label.addUsers(user).then(function() {
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
   * DELETE /labels/:labelId/labelManagers/:userId
   * Delete a manager from the label
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.delete('/labels/:labelId/labelManagers/:userId',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkParams('userId', 'User id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var userId = req.params.userId;
      var labelId = req.params.labelId;

      model.Label.find({
        where: {
          id: labelId
        },
        include: [{
          model: model.User,
          required: true,
          where: {
            id: userId
          }
        }]
      }).then(function(label) {
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested user is not a label manager';
          return next(err);
        }
        label.removeUser(label.Users[0]).then(function() {
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
   * GET /labels/:id/dropZoneFiles
   * Get the list of files in the dropZone
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/labels/:labelId/dropZoneFiles',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var LabelId = req.params.labelId;
      model.Label.find({
        where: {
          id: LabelId
        }
      }).then(function(label) {
        if (label) {
          label.getDropZoneFiles({
            where: {
              status: 'UPLOADED'
            }
          }).then(function(dropZoneFiles) {
            res.send(dropZoneFiles);
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /labels/id/catalog
   * Get all releases associated to the label
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   * @param {function} next - Middleware function to continue the call chain
   */
  app.get('/labels/:labelId/catalog',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        return throwValidationError(errors, next);
      }

      var LabelId = req.params.labelId;
      model.Label.find({
        where: {
          id: LabelId
        }
      }).then(function(label) {
        if (label) {
          label.getReleases({
            order: 'catalogNumber DESC'
          }).then(function(releases) {
            res.send(releases);
          }).catch(function(err) {
            err.status = 500;
            return next(err);
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /labels/:labelId/revenues/expanded/:startDate?/:endDate?
   * Get label's revenues, with filtering possibility, reported in expanded
   * version (that is grouped by Release and Date).
   * If startDate and endDate are not provided this endpoint returns the amount
   * for the last quarter
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   */
  app.get('/labels/:labelId/revenues/expanded/:startDate?/:endDate?',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res) {
      // Try to format input dates, if format does not match (stricly) then
      // startDate.isValid() and endDate.isValid() are false
      var startDate = moment(req.params.startDate, 'DD-MM-YYYY', true);
      var endDate = moment(req.params.endDate, 'DD-MM-YYYY', true).endOf('day');

      if (startDate && startDate.isValid()) {
        // startDate is valid
        startDate = startDate.format();
        if (endDate && endDate.isValid()) {
          // endDate is Valid
          endDate = endDate.format();
        } else {
          endDate = moment().utcOffset(0).format();
        }
      } else {
        startDate = moment().startOf('quarter').format();
        endDate = moment().utcOffset(0).format();
      }
      var labelId = req.params.labelId;
      model.Transaction.findAll({
        // todo(mziccard) change date format, change column name to dateFormat
        attributes: ['ReleaseId', [Sequelize.fn('DATE_FORMAT',
            Sequelize.col('Transaction.createdAt'), '%d/%m/%y'), 'dataColumn'],
          [Sequelize.fn('SUM', Sequelize.col('finalPrice')), 'price']
        ],
        include: [{
          model: model.Release,
          attributes: ['catalogNumber']
        }],
        where: {
          LabelId: labelId,
          createdAt: {
            $between: [startDate, endDate],
          }
        },
        order: 'dataColumn',
        group: ['ReleaseId', 'dataColumn']
      }).then(function(results) {
        res.send(results);
      }).catch(function(err) {
        err.status = 500;
        return next(err);
      });
    });

  /**
   * GET /labels/:labelId/revenues/total/:startDate?/:endDate?
   * The total label's revenues, with possibility to filter by date.
   *
   * @param {object} req - The request object
   * @param {object} res - The response object
   */
  app.get('/labels/:labelId/revenues/total/:startDate?/:endDate?',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res) {
      // Try to format input dates, if format does not match (stricly) then
      // startDate.isValid() and endDate.isValid() are false
      var startDate = moment(req.params.startDate, 'DD-MM-YYYY', true);
      var endDate = moment(req.params.endDate, 'DD-MM-YYYY', true).endOf('day');

      if (startDate && startDate.isValid()) {
        // startDate is valid
        startDate = startDate.format();
        if (endDate && endDate.isValid()) {
          // endDate is Valid
          endDate = endDate.format();
        } else {
          endDate = moment().utcOffset(0).format();
        }
      } else {
        startDate = moment().startOf('quarter').format();
        endDate = moment().utcOffset(0).format();
      }
      var labelId = req.params.labelId;
      model.Transaction.findAll({
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('finalPrice')), 'price']
        ],
        where: {
          LabelId: labelId,
          createdAt: {
            $between: [startDate, endDate],
          }
        },
        group: ['labelId']
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
  app.post('/labels/:labelId/profilePicture/createFile',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    imagesController.createImageFactory('logo', helper));

  /**
   * POST '/labels/:labelId/profilePicture/confirmFile'
   * Confirm the upload of the requested new logo, store it in the database
   * as label information
   */
  app.post('/labels/:labelId/profilePicture/confirmFile',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    imagesController.confirmImageFactory(
      'logo', ['small', 'medium', 'large'], helper));

  /**
   * GET '/labels/:labelId/profilePicture/:size(small|large|medium)'
   * Get the label logo in the desired size, if it does not exist download the
   * original logo and resize it
   */
  app.get('/labels/:labelId/profilePicture/:size(small|medium|large)',
    imagesController.getImageFactory('logo', helper));

}; /* End of labels controller */
