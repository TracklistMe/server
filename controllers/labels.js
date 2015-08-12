'use strict';

var fs = require('fs-extra');

var imagesController = rootRequire('controllers/images');
var helper = rootRequire('helpers/labels');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var beatport = rootRequire('libs/beatport/beatport');
var rabbitmq = rootRequire('rabbitmq/rabbitmq');

module.exports.controller = function(app) {

  /**
   * Ensures current user is the owner of the company
   * Company ID must be passed as req.body.companyId
   */
  function ensureCompanyOwner(req, res, next) {
    var companyId = req.body.companyId;
    var userId = req.user;
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
      company.getUsers({
        where: {
          id: userId
        }
      }).then(function(user) {
        if (!user) {
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
   * Ensure current user is an owner of the company who ows the label
   * Label ID must be passed as req.params.labelId
   */
  function ensureCompanyOwnerFromLabel(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
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
      label.getCompanies().then(function(companies) {
        if (!companies) {
          var err = new Error();
          err.status = 401;
          err.message = 'You don\'t have access to the requested resource';
          return next(err);
        }
        companies.forEach(function(company) {
          company.getUsers({
            where: {
              id: userId
            }
          }).then(function(user) {
            if (!user) {
              var err = new Error();
              err.status = 401;
              err.message =
                'You don\'t have access to the requested resource';
              return next(err);
            }
            return next();
          });
        });
      });
    });
  }

  /**
   * Ensure current user is a manager of the selected label
   * Label ID must be passed as req.params.labelId
   * TODO uncomment and add access control
  function ensureLabelManager(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
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
      label.getUsers({
        where: {
          id: userId
        }
      }).then(function(users) {
        if (!users) {
          var err = new Error();
          err.status = 401;
          err.message = 'You don\'t have access to the requested resource ';
          return next(err);
        }
        return next();
      });
    });
  } 
  */

  /**
   * Ensure current user is either company owner or label manager
   * Label ID must be passed as req.params.labelId
   */
  function ensureLabelManagerOrCompanyOwner(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
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
      label.getUsers({
        where: {
          id: userId
        }
      }).then(function(users) {
        if (!users) {
          // Current user is not label manager, check if he is company owner
          label.getCompanies().then(function(companies) {
            if (!companies) {
              var err = new Error();
              err.status = 401;
              err.message =
                'You don\'t have access to the requested resource ';
              return next(err);
            }
            companies.forEach(function(company) {
              company.getUsers({
                where: {
                  id: userId
                }
              }).then(function(user) {
                if (!user) {
                  var err = new Error();
                  err.status = 401;
                  err.message =
                    'You don\'t have access to the requested resource ';
                  return next(err);
                }
                return next();
              });
            });
          });
        }
        return next();
      });
    });
  }

  /**
   * GET /labels/search/:searchString
   * Return the list of labels whose displayName resambles the search string
   * TODO: paginate request
   */
  app.get('/labels/search/:searchString', function(req, res) {
    var searchString = req.params.searchString;
    model.Label.findAll({
      where: ['displayName LIKE ?', '%' + searchString + '%']
    }).then(function(labels) {
      res.send(labels);
    });
  });

  /**
   * GET /labels/search/:searchString
   * Return the list of labels whose displayName exactly matches the search 
   * string
   */
  app.get('/labels/searchExact/:searchString', function(req, res) {
    var searchString = req.params.searchString;
    model.Label.find({
      where: {
        displayName: searchString
      }
    }).then(function(labels) {
      res.send(labels);
    });
  });

  /**
   * GET /labels/:id
   * Return the label corresponding to the passed id
   */
  app.get('/labels/:labelId',
    authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      req.checkParams('labelId', 'Invalid search string').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }
      var LabelId = req.params.labelId;
      model.Label.find({
        where: {
          id: LabelId
        }
      }).then(function(label) {
        if (label) {
          label.getUsers({
            attributes: ['displayName']
          }).then(function(associatedUsers) {
            label.dataValues.labelManagers = (associatedUsers);
            res.send(label);
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      });
    });

  /**
   * GET /labels/:id/companies
   * Return all the companies the label with id = :id belongs to.
   */
  app.get('/labels/:labelId/companies',
    authenticationUtils.ensureAuthenticated,
    function(req, res, next) {
      req.checkParams('labelId', 'Invalid search string').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }
      var LabelId = req.params.labelId;
      model.Label.find({
        where: {
          id: LabelId
        }
      }).then(function(label) {
        if (label) {
          label.getCompanies({
            attributes: ['displayName', 'id']
          }).then(function(associatedCompany) {
            res.send(associatedCompany);
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      });
    });

  /**
   * POST /labels/
   * Add label in post payload to the label list of the company
   * TODO: permission controll, check current user is owner of the company and 
   * company owns the label
   */
  app.post('/labels/',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwner,
    function(req, res, next) {
      req.checkBody('companyId', 'Invalid company id').notEmpty().isInt();
      req.checkBody('labelName', 'Missing label name').notEmpty();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }
      var companyId = req.body.companyId;
      var labelName = req.body.labelName;

      console.log('companyId' + companyId);
      console.log('labelName' + labelName);

      model.Label.find({
        where: {
          displayName: labelName
        }
      }).then(function(label) {
        if (!label) {
          model.Label.create({
            displayName: labelName
          }).then(function(label) {
            model.Company.find({
              where: {
                id: companyId
              }
            }).then(function(company) {
              company.addLabels([label]).then(function() {
                //model.User.find({where: {id: req.user}})
                //.then(function(user) {
                //label.addUsers([user]).then(function(user) {
                res.send();
                //});
                //});                           
              });
            });
          });
        } else {
          var err = new Error();
          err.status = 409;
          err.message = 'Label name already in use';
          return next(err);
        }
      });
    });

  /**
   * POST /labels/:idLabel/dropZone
   * Upload a file to the dropZone for the label with id :idLabel
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
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var labelId = req.params.labelId;
      var filename = req.body.filename;
      var extension = req.body.extension;
      var size = req.body.size;

      var remotePath =
        helper.remoteDropZonePath(labelId, filename + '.' + extension);

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
          if (files.length === 0) {
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
                      var expiration = new Date(Date.now() + 60 * 1000);
                      cloudstorage.getSignedPolicy(remotePath, {
                          expiration: expiration.getTime(),
                          startsWith: ['$key', dropZoneFile.path],
                          contentLengthRange: {
                            min: 0,
                            max: 104857600
                          }
                        },
                        function(err, body) {
                          console.log(body);
                          res.json(body);
                        });
                    }
                  });
              });
            });
          } else {
            // update file
            var file = files[0];
            file.status = 'UPLOADING';
            file.size = size;
            file.path = remotePath;
            file.save().then(function() {
              var expiration = new Date(Date.now() + 60 * 1000);
              cloudstorage.getSignedPolicy(remotePath, {
                  expiration: expiration.getTime(),
                  startsWith: ['$key', file.path],
                  contentLengthRange: {
                    min: 0,
                    max: 104857600
                  }
                },
                function(err, body) {
                  console.log(body);
                  res.json(body);
                });
            }).error(function(err) {
              err.status = 500;
              err.message = 'File upload failed';
              return next(err);
            });
          }
        });
      });
    });

  /**
   * POST /labels/:idLabel/dropZone
   * Confirms the upload to the CDN of a file in the label's dropzone
   * If not confirmed the file is never shown to the user
   */
  app.post('/labels/:labelId/dropZone/confirmFile',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label is invalid').notEmpty().isInt();
      req.checkBody('filename', 'Missing filename').notEmpty();
      req.checkBody('extension', 'Missing extension').notEmpty().isAlpha();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
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

            // TODO check if file really exists in the CDN before confirming
            // TODO get metadata? compute filesize? MD5?

            var file = files[0];
            file.status = 'UPLOADED';
            // TODO get metadata and fill other fields?
            file.save().then(function() {
              res.send();
            }).error(function(err) {
              err.status = 500;
              err.message = 'File upload failed';
              console.log('File upload failed');
              return next(err);
            });
          } else {
            err.status = 404;
            err.message = 'File not found in label dropzone';
            console.log('File not found in label dropzone');
            return next(err);
          }
        });
      });
    });

  /**
   * DELETE /labels/:idLabel/dropZone
   * Delete a file from the dropZone (table and CDN) for the label with id 
   * :idLabel
   */
  app.delete('/labels/:labelId/dropZone/:id',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkParams('id', 'DropZoneFile id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var labelId = req.params.labelId;
      var id = req.params.id;

      model.Label.find({
        where: {
          id: labelId
        }
      }).then(function(label) {
        if (label) {
          label.getDropZoneFiles({
            where: {
              id: id
            }
          }).then(function(files) {
            if (files && files.length > 0) {
              var file = files[0];
              cloudstorage.remove(file.path, function(err) {
                if (err) {
                  console.log(
                    'Failed removing ' +
                    file.path +
                    ' from cloudstorage');
                }
                file.destroy();
                res.send();
              });
            } else {
              var err = new Error();
              err.status = 404;
              err.message = 'File not found in label dropzone';
              console.log('File not found in label dropzone');
              return next(err);
            }
          });
        }
      });
    });

  /**
   * GET /labels/:idLabel/processReleases/info
   * Validates the files in the dropZone to a beatport compliant playlist
   */
  app.get('/labels/:labelId/processReleases/info',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var idLabel = req.params.labelId;
      model.Label.find({
        where: {
          id: idLabel
        }
      }).then(function(label) {
        console.log('==================================================');
        console.log(
          'The label found for release infos is ' +
          JSON.stringify(label.dataValues));
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
          console.log(xmls);
          beatport.validate(xmls).then(function(results) {
            res.send(results);
          });
        });
      });
    });

  /**
   * POST /labels/:idLabel/processReleases/
   * Asks the server to process files in the dropZone as a new release
   */
  app.post('/labels/:labelId/processReleases/',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var idLabel = req.params.labelId;
      model.Label.find({
        where: {
          id: idLabel
        }
      }).then(function(label) {
        console.log('FOUND LABEL');
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
          console.log('XML parsing');
          beatport.process(xmls, idLabel).then(function(results) {
            console.log('--server response');
            results.forEach(function(result) {
              console.log('FOR EACH RESULT ');
              console.log(result);
              // TODO REDUNDANT SAVE JSON AND SEND RABBIT 
              // 
              model.Release.find({
                where: {
                  id: result.value.dataValues.id
                },
                attributes: ['id', 'title', 'catalogNumber', 'status'],
                order: 'position',
                include: [{
                  model: model.Track,
                  include: [{
                    model: model.Artist,
                    as: 'Remixer'
                  }, {
                    model: model.Artist,
                    as: 'Producer'
                  }]
                }, {
                  model: model.Label
                }]
              }).then(function(release) {
                console.log('FIND');
                console.log(result.value.dataValues.id);
                release.json = JSON.stringify(release);
                rabbitmq.sendReleaseToProcess(release);
                release.save();
              });
            });
            console.log('----');
            res.send(results);
          });
        });
      });
    });

  /**
   * POST /labels/:idLabel/labelManagers
   * Adds a new manager for the label
   */
  app.post('/labels/:labelId/labelManagers',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkBody(
        'newLabelManager',
        'newLabelManager id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var newLabelManagerId = req.body.newLabelManager;
      var labelId = req.params.labelId;
      console.log(labelId);

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

        label.getUsers({
          where: {
            id: newLabelManagerId
          }
        }).then(function(users) {

          if (users.length === 0) {
            model.User.find({
              where: {
                id: newLabelManagerId
              }
            }).then(function(user) {
              label.addUsers(user).then(function() {
                res.send();
              });
            });
          } else {
            console.log('This user was already associated to this label!');
            var err = new Error();
            err.status = 409;
            err.message =
              'The user is already a manager of the selected label';
            return next(err);
          }
        });
      });
    });

  /**
   * DELETE /labels/:idLabels/labelManagers/:idUser
   * Delete a manager from the label
   */
  app.delete('/labels/:labelId/labelManagers/:userId',
    authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      req.checkParams('userId', 'User id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
      }

      var userId = req.params.userId;
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
            id: userId
          }
        }).then(function(user) {
          if (!user) {
            var err = new Error();
            err.status = 404;
            err.message = 'Requested user does not exist';
            return next(err);
          }
          label.removeUser(user).then(function() {
            res.send();
          });
        });
      });
    });

  /**
   * GET /labels/:id/dropZoneFiles
   * Get the list of files in the dropZone
   */
  app.get('/labels/:labelId/dropZoneFiles',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
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
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      });
    });

  /**
   * GET /labels/id/catalog
   * Get all releases associated to the label
   */
  app.get('/labels/:labelId/catalog',
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    function(req, res, next) {

      req.checkParams('labelId', 'Label id is invalid').notEmpty().isInt();
      var errors = req.validationErrors();
      if (errors) {
        var err = new Error();
        err.status = 400;
        err.message = 'There have been validation errors';
        err.validation = errors;
        return next(err);
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
          });
        } else {
          var err = new Error();
          err.status = 404;
          err.message = 'Requested label does not exist';
          return next(err);
        }
      });
    });

  /**
   * POST '/labels/:labelId/profilePicture/createFile'
   * Request a CDN policy to upload a new profile picture, if an update was
   * already in progress the old request is deleted from the CDN
   */
  app.post('/labels/:labelId/profilePicture/createFile',
    authenticationUtils.ensureAuthenticated,
    imagesController.createImageFactory('logo', helper));

  /**
   * POST '/labels/:labelId/profilePicture/confirmFile'
   * Confirm the upload of the requested new logo, store it in the database
   * as label information
   */
  app.post('/labels/:labelId/profilePicture/confirmFile',
    authenticationUtils.ensureAuthenticated,
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
