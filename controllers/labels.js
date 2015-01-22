'use strict';

var fileUtils             = require('utils/file-utils');
var authenticationUtils   = require('utils/authentication-utils');
var model                 = require('models/model');
var cloudstorage          = require('libs/cloudstorage/cloudstorage');
var beatport              = require('libs/beatport/beatport');
var fs                    = require('fs-extra');

module.exports.controller = function(app) {

  /**
   * GET /labels/search/:searchString
   * Return the list of labels whose displayName matches the search string
   */
  app.get('/labels/search/:searchString', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var searchString = req.params.searchString;
    model.Label.find({ where: {displayName: searchString} }).then(function(labels) {
      res.send(labels);
    });
  });


  /**
   * GET /labels/:id   
   * Return the label corresponding to the passed id
   */
  app.get('/labels/:id', authenticationUtils.ensureAuthenticated, function(req, res) {
    var LabelId = req.params.id;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
          label.getUsers({attributes: ['displayName']}).success(function(associatedUsers) {
              label.dataValues.labelManagers = (associatedUsers);
              res.send(label);
          })
      }else{
        res.send(label);
      }
    }); 
  });

  /**
   * POST /labels/ 
   * Add label in post payload to the label list of the company 
   * TODO: permission controll, check current user is owner of the company and company owns the label
   **/
  app.post('/labels/', authenticationUtils.ensureAuthenticated, function(req, res) {
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
                              res.send();
                           
                  });
                })  
            })
      }
    });
  }); 

  /**
   * POST /labels/:idLabel/profilePicture/:width/:height/
   * Upload label profile picture to the CDN, original size and resized
   **/
  app.post('/labels/:idLabel/profilePicture/:width/:height/', 
    authenticationUtils.ensureAuthenticated, 
    fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
    fileUtils.resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
    function (req, res, next) {
      var idLabel = req.params.idLabel;
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
  app.post('/labels/:idLabel/dropZone/', 
    authenticationUtils.ensureAuthenticated, 
    fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
    function (req, res, next) {

        var idLabel = req.params.idLabel;
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
  app.get('/labels/:idLabel/processReleases/info', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
      var idLabel = req.params.idLabel;
      model.Label.find({ where: {id: idLabel}}).then(function(label){
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
  app.post('/labels/:idLabel/processReleases/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
      var idLabel = req.params.idLabel;
      model.Label.find({ where: {id: idLabel}}).then(function(label){
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
  app.post('/labels/:labelId/labelManagers', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var newLabelManagerId = req.body.newLabelManager;
    var labelId = req.params.labelId
    console.log(labelId);
   
    model.Label.find({where: {id: labelId}}).then(function(label) {

      label.getUsers({ where: {id: newLabelManagerId}}).then(function(users) {

        if(users.length == 0){
            model.User.find({where: {id: newLabelManagerId}}).then(function(user) {
              label.addUsers(user).then(function(label) {
          
                res.send();
              })
            })
        }else{
          
          console.log("This user was already associated to this label!")
          // TODO, there were an error, need to fix
        }
      })
    });
  }); 

  /**
   * DELETE /labels/:idLabels/labelManagers/:idUser 
   * Delete a manager from the label
   **/
  app.delete('/labels/:labelId/labelManagers/:userId', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var userId = req.params.userId;
    var labelId = req.params.labelId


    model.Label.find({where: {id: labelId}}).then(function(label) {
      model.User.find({where: {id: userId}}).then(function(user) {
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
  app.get('/labels/:id/dropZoneFiles', authenticationUtils.ensureAuthenticated, function(req, res) {
    var LabelId = req.params.id;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
          label.getDropZoneFiles().success(function(dropZoneFiles) {
              res.send(dropZoneFiles);
          })
      }
    }); 
  });


  /**
   * GET /labels/id/catalog
   * Get all releases associated to the label
   **/
  app.get('/labels/:id/catalog', authenticationUtils.ensureAuthenticated, function(req, res) {
    var LabelId = req.params.id;
    model.Label.find({ where: {id: LabelId} }).then(function(label) {
      if(label){
          label.getReleases().success(function(releases) {
              res.send(releases);
          })
      }
    }); 
  });

} /* End of labels controller */