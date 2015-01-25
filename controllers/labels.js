'use strict';

var fs                    = require('fs-extra');

var fileUtils             = rootRequire('utils/file-utils');
var authenticationUtils   = rootRequire('utils/authentication-utils');
var model                 = rootRequire('models/model');
var cloudstorage          = rootRequire('libs/cloudstorage/cloudstorage');
var beatport              = rootRequire('libs/beatport/beatport');

module.exports.controller = function(app) {

  /**
   * Ensures current user is the owner of the company 
   * Company ID must be passed as req.body.companyId
   **/
  function ensureCompanyOwner(req, res, next) {
    var companyId = req.body.companyId;
    var userId = req.user;
    model.Company.find({ where: {id: companyId} }).then(function(company) {
      if (!company) {
        var err = new Error();
        err.status=404;
        err.message="Requested company does not exist";
        return next(err);
      }
      company.getUsers({ where: {id: userId}}).then(function(user) {
        if (!user){
          var err = new Error();
          err.status=401;
          err.message="You don't have access to the requested resource";
          return next(err);                  
        } 
        return next();
      });
    });
  }

  /**
   * Ensure current user is an owner of the company who ows the label
   * Label ID must be passed as req.params.labelId
   **/
  function ensureCompanyOwnerFromLabel(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
    model.Label.find({ where: {id: labelId} }).then(function(label) {
      if (!label) {
        var err = new Error();
        err.status=404;
        err.message="Requested label does not exist";
        return next(err);
      }
      label.getCompanies().then(function(companies) {
        if (!companies) {
          var err = new Error();
          err.status=401;
          err.message="You don't have access to the requested resource";
          return next(err);          
        }
        companies.forEach(function(company) {
          company.getUsers({ where: {id: userId}}).then(function(user) {
            if (!user){
              var err = new Error();
              err.status=401;
              err.message="You don't have access to the requested resource";
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
   **/
  function ensureLabelManager(req, res, next) {
    var labelId = req.params.labelId;
    model.Label.find({ where: {id: labelId} }).then(function(label) {
      if (!label) {
        var err = new Error();
        err.status=404;
        err.message="Requested label does not exist";
        return next(err);
      }
      label.getUsers({ where: {id: userId}}).then(function(users) {
        if (!users) {
          var err = new Error();
          err.status=401;
          err.message="You don't have access to the requested resource";
          return next(err);          
        }
        return next();
      });      
    });
  }

  function ensureLabelManagerOrCompanyOwner(req, res, next) {
    var labelId = req.params.labelId;
    var userId = req.user;
    model.Label.find({ where: {id: labelId} }).then(function(label) {
      if (!label) {
        var err = new Error();
        err.status=404;
        err.message="Requested label does not exist";
        return next(err);
      }
      label.getUsers({ where: {id: userId}}).then(function(users) {
        if (!users) {
          // Current user is not label manager, check if he is company owner
          label.getCompanies().then(function(companies) {
            if (!companies) {
              var err = new Error();
              err.status=401;
              err.message="You don't have access to the requested resource";
              return next(err);          
            }
            companies.forEach(function(company) {
              company.getUsers({ where: {id: userId}}).then(function(user) {
                if (!user){
                  var err = new Error();
                  err.status=401;
                  err.message="You don't have access to the requested resource";
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
   * Return the list of labels whose displayName matches the search string
   */
  app.get('/labels/search/:searchString', authenticationUtils.ensureAuthenticated, function(req, res, next) {
    var searchString = req.params.searchString;
    model.Label.find({ where: {displayName: searchString} }).then(function(labels) {
      res.send(labels);
    });
  });


  /**
   * GET /labels/:id   
   * Return the label corresponding to the passed id
   */
  app.get('/labels/:labelId', authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, function(req, res, next) {
    var LabelId = req.params.labelId;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
        label.getUsers({attributes: ['displayName']}).success(function(associatedUsers) {
          label.dataValues.labelManagers = (associatedUsers);
          res.send(label);
        })
      } else {
        var err = new Error();
        err.status=404;
        err.message="Requested label does not exist";
        return next(err);
      }
    }); 
  });

  /**
   * POST /labels/ 
   * Add label in post payload to the label list of the company 
   * TODO: permission controll, check current user is owner of the company and company owns the label
   **/
  app.post('/labels/', authenticationUtils.ensureAuthenticated, ensureCompanyOwner, function(req, res, next) {
    var companyId = req.body.companyId;
    var labelName = req.body.labelName;

    console.log("companyId"+companyId)
    console.log("labelName"+labelName)

    model.Label.find({ where: {displayName: labelName}}).success(function(label) {
      if(!label){
         model.Label.create({
              displayName: labelName
            }).success(function(label) {
                  model.Company.find({where: {id: companyId}}).then(function(company) {
                    company.addLabels([label]).success(function(labels) {
                      //model.User.find({where: {id: req.user}}).then(function(user) {
                        //label.addUsers([user]).success(function(user) { 
                          res.send(); 
                        //});
                      //});                           
                  });
                })  
            })
      } else {
        var err = new Error();
        err.status = 409;
        err.message = "Label name already in use";
        return next(err);
      }
    });
  }); 

  /**
   * POST /labels/:idLabel/profilePicture/:width/:height/
   * Upload label profile picture to the CDN, original size and resized
   **/
  app.post('/labels/:labelId/profilePicture/:width/:height/', 
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, 
    fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
    fileUtils.resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
    function (req, res, next) {
      var idLabel = req.params.labelId;
      model.Label.find({ where: {id: idLabel} }).then(function(label) {
        var oldLogo = label.logo;
        var oldFullSizeLogo = label.fullSizeLogo;
        label.logo = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
        label.fullSizeLogo = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);

        label.save().then(function (label) {
          // we remove old avatars from the CDN
          cloudstorage.remove(oldLogo);
          cloudstorage.remove(oldFullSizeLogo);
          // We remove temporarily stored files
          fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].filename));
          fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].resizedFilename));

          res.writeHead(200, {"content-type":"text/html"});   //http response header
          res.end(JSON.stringify(req.uploadedFile));
        });
      }); 
    });

  /**
   * POST /labels/:idLabel/dropZone 
   * Upload a file to the dropZone for the label with id :idLabel
   **/
  app.post('/labels/:labelId/dropZone/', 
    authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner,
    fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
    function (req, res, next) {

        var idLabel = req.params.labelId;
        console.log("****************")
        console.log(req.uploadedFile) 
        console.log("****************")
               
        model.DropZoneFile.find({ where: model.Sequelize.and({fileName: req.uploadedFile[0].originalfilename},{extension: req.uploadedFile[0].extension} ) }).then(function(file) {
          if(file){
            // file exists .. Update file? 
            file.path = req.uploadedFile[0].filename;
            file.size = req.uploadedFile[0].filesize;
            file.save().success(function() { 
              res.send();
            })
          }else{
            model.DropZoneFile.create({
              fileName: req.uploadedFile[0].originalfilename,
              extension: req.uploadedFile[0].extension, 
              size: req.uploadedFile[0].filesize,
              path: req.uploadedFile[0].filename,
            }).success(function(dropZoneFile) {
              model.Label.find({ where: {id: idLabel}}).then(function(label){
                label.addDropZoneFiles(dropZoneFile).then(function(associationFile) {
                  res.send();
                })
              });
              
            })  
          }
           
        });
       //res.send();
  });

  /**
   * GET /labels/:idLabel/processReleases/info
   * Validates the files in the dropZone to a beatport compliant playlist
   **/
  app.get('/labels/:labelId/processReleases/info', authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, function(req, res, next) {
      var idLabel = req.params.labelId;
      model.Label.find({ where: {id: idLabel}}).then(function(label){
        console.log("The label found for release infos is " + label);
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = "Requested label does not exist";
          return next(err);
        }
        label.getDropZoneFiles({where: {extension: "xml"}}).then(function(xmls){

            beatport.validate(xmls).then(function(results){
              res.send(results);
            })
             
          })

      })
  });

  /**
   * POST /labels/:idLabel/processReleases/
   * Asks the server to process files in the dropZone as a new release
   **/
  app.post('/labels/:labelId/processReleases/', authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, function(req, res, next) {
      var idLabel = req.params.labelId;
      model.Label.find({ where: {id: idLabel}}).then(function(label){
        if (!label) {
          var err = new Error();
          err.status = 404;
          err.message = "Requested label does not exist";
          return next (err);
        }
        label.getDropZoneFiles({where: {extension: "xml"}}).then(function(xmls){
            beatport.process(xmls,idLabel).then(function(results){
              console.log("--server response")
              res.send(results);
            }) 
          })
      })
  });

  /**
   * POST /labels/:idLabel/labelManagers/   POST {the id of owner to add}
   * Adds a new manager for the label
   **/
  app.post('/labels/:labelId/labelManagers', authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel, function(req, res, next) {
    var newLabelManagerId = req.body.newLabelManager;
    var labelId = req.params.labelId
    console.log(labelId);
   
    model.Label.find({where: {id: labelId}}).then(function(label) {
      if (!label) {
        var err = new Error();
        err.status = 404;
        err.message = "Requested label does not exist";
        return next (err);
      }

      label.getUsers({ where: {id: newLabelManagerId}}).then(function(users) {

        if(users.length == 0){
            model.User.find({where: {id: newLabelManagerId}}).then(function(user) {
              label.addUsers(user).then(function(label) {
          
                res.send();
              })
            })
        }else{
          
          console.log("This user was already associated to this label!")
          var err = new Error();
          err.status = 409;
          err.message = "The user is already a manager of the selected label";
          return next (err);
          // TODO, there were an error, need to fix
        }
      })
    });
  }); 

  /**
   * DELETE /labels/:idLabels/labelManagers/:idUser 
   * Delete a manager from the label
   **/
  app.delete('/labels/:labelId/labelManagers/:userId', authenticationUtils.ensureAuthenticated, ensureCompanyOwnerFromLabel, function(req, res, next) {
    var userId = req.params.userId;
    var labelId = req.params.labelId


    model.Label.find({where: {id: labelId}}).then(function(label) {
        if (!label) {
        var err = new Error();
        err.status = 404;
        err.message = "Requested label does not exist";
        return next (err);
      }
      model.User.find({where: {id: userId}}).then(function(user) {
              if (!user) {
                var err = new Error();
                err.status = 404;
                err.message = "Requested user does not exist";
                return next (err);
              }
              label.removeUser(user).success(function() {
                res.send();
              })
            })
    });
  }); 

  /**
   * GET /labels/:id/dropZoneFiles  
   * Get the list of files in the dropZone
   **/
  app.get('/labels/:labelId/dropZoneFiles', authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, function(req, res, next) {
    var LabelId = req.params.labelId;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
          label.getDropZoneFiles().success(function(dropZoneFiles) {
              res.send(dropZoneFiles);
          })
      } else {
        var err = new Error();
        err.status = 404;
        err.message = "Requested label does not exist";
        return next (err);
      }
    }); 
  });


  /**
   * GET /labels/id/catalog
   * Get all releases associated to the label
   **/
  app.get('/labels/:labelId/catalog', authenticationUtils.ensureAuthenticated, ensureLabelManagerOrCompanyOwner, function(req, res, next) {
    var LabelId = req.params.labelId;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
          label.getReleases().success(function(releases) {
              res.send(releases);
          })
      } else {
        var err = new Error();
        err.status = 404;
        err.message = "Requested label does not exist";
        return next (err);
      }
    }); 
  });

} /* End of labels controller */