'use strict';

var fs                    = require('fs-extra');

var fileUtils             = rootRequire('utils/file-utils');
var authenticationUtils   = rootRequire('utils/authentication-utils');
var model                 = rootRequire('models/model');
var cloudstorage          = rootRequire('libs/cloudstorage/cloudstorage');

module.exports.controller = function(app) {
  /*
   |--------------------------------------------------------------------------
   | GET /companies/search/
   |--------------------------------------------------------------------------
   */
  app.get('/companies/search/:searchString', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var searchString = req.params.searchString;
    model.Company.find({ where: {displayName: searchString} }).then(function(companies) {
      res.send(companies);
    });
  });

  /*
   |--------------------------------------------------------------------------
   | GET /companies/   
   | return List of all the companies
   |--------------------------------------------------------------------------
   */
  app.get('/companies/', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var searchString = req.params.searchString;
    model.Company.findAll().then(function(companies) {
      res.send(companies);
    });
  });


  /*
   |--------------------------------------------------------------------------
   | GET /companies/id/labels   
   | return all the companies of the given company
   |--------------------------------------------------------------------------
   */
  app.get('/companies/:id/labels', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var companyId = req.params.id;
    model.Company.find({ where: {id: companyId} }).then(function(company) {
      if(company){
          company.getLabels().success(function(associatedLabels) {
              res.send(associatedLabels);
          })
      }else{
        res.send(company);
      }
    }); 
  });



  /*
   |--------------------------------------------------------------------------
   | GET /companies/id   
   | return The company with id passed as part of the path. Empty object if it doesn't exists.
   | this function has been set to limited to admin only. We may consider at some point to release
   | a lighter way for having an all user access (for promo proposal)
   |--------------------------------------------------------------------------
   */
  app.get('/companies/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var companyId = req.params.id;
    model.Company.find({ where: {id: companyId} }).then(function(company) {
      // rewrite with inclusion 
      if(company){
          company.getUsers({attributes: ['displayName']}).success(function(associatedUsers) {
              company.dataValues.owners = (associatedUsers);
              res.send(company);
          })
      }else{
        res.send(company);
      }
    }); 
  });
  /*
   |--------------------------------------------------------------------------
   | PUT /companies/id   
   | return the update company
   | update the companies with id 
   |--------------------------------------------------------------------------
   */
  app.put('/companies/:id', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var companyId = req.params.id;

    model.Company.find({where: {id: companyId} }).then(function(company) {
      if (company) { // if the record exists in the db
        company.updateAttributes(req.body).then(function(company) {
          res.send();
        });
      }
    })
  });

  /*
   |--------------------------------------------------------------------------
   | DELETE /companies/:idCompany/owners/:idUser 
   | delete the owner idUser in the company idCompany
   |--------------------------------------------------------------------------
   */
  app.delete('/companies/:companyId/owners/:userId', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var ownerId = req.params.userId;
    var companyId = req.params.companyId


    model.Company.find({where: {id: companyId}}).then(function(company) {
      console.log("REMOVE  USER FROM COMPANY")
      company.getUsers({where: {id: ownerId}}).then(function(users) {
        if (users && users.length == 1) {
          company.removeUser(users[0]).success(function() {
            res.send();
          });
        }
      });         
    }); 
  }); 

  /*
   |--------------------------------------------------------------------------
   | POST /companies/:idCompany/owners/   POST {the id of owner to add}
   | return List of all the companies
   |--------------------------------------------------------------------------
   */
  app.post('/companies/:companyId/owners', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
    var newOwnerId = req.body.newOwner;
    var companyId = req.params.companyId

    
    console.log(newOwnerId+" == "+companyId)
    model.Company.find({where: {id: companyId}}).then(function(company) {
      company.getUsers({ where: {id: newOwnerId}}).success(function(users) {
        if(users.length == 0){
            model.User.find({where: {id: newOwnerId}}).then(function(user) {
              company.addUsers(user).success(function() {
                res.send();
              })
            })
        }else{
          
          console.log("This user waas already associated to this company!")
          // TODO, there were an error, need to fix
        }
      })
    });
  }); 

  /*
   |--------------------------------------------------------------------------
   | POST /companies/:idCompany/profilePicture/:width/:height   POST {the id of owner to add}
   | return List of all the companies
   |--------------------------------------------------------------------------
   */



  app.post('/companies/:idCompany/profilePicture/:width/:height/', 
    authenticationUtils.ensureAuthenticated, 
    fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
    fileUtils.resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
    function (req, res, next) {
      var idCompany = req.params.idCompany;
      model.Company.find({ where: {id: idCompany} }).then(function(company) {
        var oldLogo = company.logo;
        var oldFullSizeLogo = company.fullSizeLogo;
        company.logo = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
        company.fullSizeLogo = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);

        company.save().then(function (company) {
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

}