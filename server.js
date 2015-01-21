/**
 * Satellizer Node.js Example
 * (c) 2014 Sahat Yalkabov
 * License: MIT
 */

var path = require('path');
var fs = require('fs-extra');       //File System - for file manipulation
var util = require('util'); 
var busboy = require('connect-busboy'); 
var qs = require('querystring');
var config = require('libs/config/config');
var http = require('http');
var async = require('async'); 
var bodyParser = require('body-parser');
var express = require('express');
var logger = require('morgan');
var jwt = require('jwt-simple');
var moment = require('moment');
var mongoose = require('mongoose');
var request = require('request');
var beatportValidate = require('libs/beatport/beatportProxy')
var cloudstorage = require('libs/cloudstorage/cloudstorage');
var fileUtils = require('libs/utils/file-utils');
var multipart = require('connect-multiparty');
var im = require('imagemagick');
var Q = require('q');
/* DATA BASE */

var dbProxy = require('libs/database/databaseProxy');

console.log(process.env.HOST)

/*
User.beforeCreate(function(user, fn) {
      return "before Create"+user
      console.log(user)
      fn(null, user)
    } 
  )
 */

 
 
/*
var userSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  password: { type: String, select: false },
  displayName: String,
  facebook: String,
  foursquare: String,
  google: String,
  github: String,
  linkedin: String,
  live: String,
  yahoo: String,
  twitter: String
});

*/
/*
userSchema.pre('save', function(next) {
  var user = this;
  if (!user.isModified('password')) {
    return next();
  }
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(user.password, salt, function(err, hash) {
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function(password, done) {
  bcrypt.compare(password, this.password, function(err, isMatch) {
    done(err, isMatch);
  });
};

var User = mongoose.model('User', userSchema);

mongoose.connect(config.MONGO_URI);
*/


var app = express();
var server = require('http').Server(app)
var hostname;
console.log(process.env.HOST)
if(process.env.HOST == undefined){
  hostname = 'store.tracklist.me';
} else {
  hostname = process.env.HOST;
} 
console.log(hostname); 
app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://'+hostname);
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'my-header,X-Requested-With,content-type,Authorization');
    //res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// Force HTTPS on Heroku
if (app.get('env') === 'production') {
  app.use(function(req, res, next) {
    var protocol = req.get('x-forwarded-proto');
    protocol == 'https' ? next() : res.redirect('https://' + req.hostname + req.url);
  });
} 

/* ========================================================== 
Use busboy middleware
============================================================ */
app.use(busboy());

/**
 * Root api to check whether the server is up and running
 * TODO: remove
 **/ 
app.get('/', function(req, res, next) {
  cloudstorage.createSignedUrl("file.txt", "GET", 60, function(err, url) {
    if (err) {
      res.status(404)
      res.json({ status: 'ERROR', 
                 message: 'Signed url not found', 
                 url: url});
      return;
    }
    res.json({ status: 'RUNNING', 
               message: 'Server is working fine', 
               url: url});    
  });
});

app.get('/testUpload', function(req, res) {
  cloudstorage.upload('img/default.png', 
    __dirname + '/uploadFolder/img/1_1421078454067_KennyRandomWallpaper.jpg',
    function(err, filename) {
      if(err) {
        console.log(err);
        res.status = 500;
        res.json({ status: 'ERROR', 
                 message: 'Error uploading file', 
                 filename: filename});
        return;
      }
        res.status = 200;
        res.send();
    });
});

/**
 * TODO fix ugly redirect and check for authentication
 **/
app.get('/images/*', function(req, res) {

  console.log(req.originalUrl)

  var mimeTypes = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png"
  };
   
  var image = req.originalUrl.substring(8,req.originalUrl.length); 

  cloudstorage.createSignedUrl(image, "GET", 20, function(err, url) {
    if (err) {
      throw err;
      err.status = 404;
      err.message = "Image not found";
      return next(err);
    }
    res.redirect(url);  
  }); /* Cloud storage signed url callback*/
});

//app.use('/cover/', express.static(__dirname + '/../datastore'));
 
app.get('/cover/:labelId/:releaseNumber/:image', function(req, res) {
  var mimeTypes = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png"
  };
  var labelId = req.params.labelId;
  var releaseNumber = req.params.releaseNumber;
  var image = req.params.image;
  console.log(__dirname + '/../../datastore/'+labelId+"/"+releaseNumber+"/"+image);
 
  var mimeType = mimeTypes[path.extname(image).split(".")[1]];
  res.writeHead(200, {'Content-Type':mimeType});
  var fileStream = fs.createReadStream(__dirname + '/../../datastore/'+labelId+"/"+releaseNumber+"/"+image);
  fileStream.pipe(res);

});


/**
 * POST /upload/profilePicture/:width/:height/
 * Upload user profile picture to the CDN, original size and resized
 **/
app.post( '/upload/profilePicture/:width/:height/', 
  ensureAuthenticated, 
  uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  function (req, res, next) {

  dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
    // We store CDN address as avatar
    var oldAvatar = user.avatar;
    var oldFullSizeAvatar = user.fullSizeAvatar;
    user.avatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
    user.fullSizeAvatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);
    user.save().then(function (user) {
      // we remove old avatars from the CDN
      cloudstorage.remove(oldAvatar);
      cloudstorage.remove(oldFullSizeAvatar);
      // We remove temporarily stored files
      fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].filename));
      fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].resizedFilename));

      res.writeHead(200, {"content-type":"text/html"});   //http response header
      res.end(JSON.stringify(req.uploadedFile));
    });
  }); /* Database read callback */
}); /* POST /upload/profilePicture/:width/:height/ */
  
/**
 * Generator of upload functions
 * localPathBuilder: given a filename returns local file path
 * remotePathBuilder: given a filename return CDN file path
 * retuns: an upload function parameterized on localPathBuilder and cloudPathBuilder
 **/
function uploadFunction(localPathBuilder, remotePathBuilder) { 
  return function upload(req,res,next){
       
      var arr;
      var fstream;
      var fileSize = 0;
      req.pipe(req.busboy);

      req.busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {

        // File data received
        file.on('data', function(data) {});
        
        // End of file
        file.on('end', function() {});

        // Get actual file name and both local and remote paths
        var originalfilename = filename.split('.')[0];
        var extension = filename.split('.').slice(0).pop();
        filename = fileUtils.timestamp(filename);
        var localPath = localPathBuilder(req, filename);
        var remotePath = remotePathBuilder(req, filename);
       
        //populate array
        //I am collecting file info in data read about the file. It may be more correct to read 
        //file data after the file has been saved to img folder i.e. after file.pipe(stream) completes
        //the file size can be got using stats.size as shown below
        arr= [{originalfilename:originalfilename, extension: extension,filesize: fileSize, fieldname: fieldname, filename: filename, encoding: encoding, MIMEtype: mimetype}];
        //save files in the form of userID + timestamp + filenameSanitized
        //Path where image will be uploaded
        fstream = fs.createWriteStream(localPath);
        file.pipe(fstream);

        // When upload finished we save file information
        req.on('end', function () {      
          req.uploadedFile = arr;
        });

        // When file has been written to disk we collect statistics
        // and upload it to cloud storage
        fstream.on('finish', function () {

          // CDN upload
          cloudstorage.upload(remotePath, localPath,
            function(err, key) {
              // There was an error uploading the file
              if(err) {
                err.message = "Failed uploading file";
                return next(err);
              }
              //Get file stats (including size) for file and continue
              fs.stat(localPath, function(err, stats) {
                if(err || !stats.isFile()) {
                    err.message = "Failed uploading file";
                    return next(err);
                }   
                req.uploadedFile[0].filesize = stats.size; 
                next();           
              }); /* Stat callback */
            }); /* CDN upload callback */
          }); /* File stream finish callback */

        // We failed writing to disk
        fstream.on('error', function (err) {
          err.message = "Failed uploading file";
          return next(err);
        });    
      });  // @END/ .req.busboy
  } /* Upload function */
} /* Upload function builder */

/**
 * Generator of resize functions
 * localPathBuilder: given a filename returns local file path
 * remotePathBuilder: given a filename return CDN file path
 * retuns: a resize function parameterized on localPathBuilder and cloudPathBuilder
 **/
function resizeFunction(localPathBuilder, remotePathBuilder) {
  return function resize(req,res,next){
    var resizedFilename, filename = req.uploadedFile[0].filename
    var width = req.params.width
    var height = req.params.height
    if(!width) width = height
    if(!height) height = width
    if(width && height){ //only if both exists 
          resizedFilename = fileUtils.resized(filename, width, height);
          // resize image with Image Magick
          im.crop({
          srcPath: localPathBuilder(req, filename),
          dstPath: localPathBuilder(req, resizedFilename),
          width: width,
          height: height,
          quality: 1,
          gravity: 'Center'
          }, function(err, stdout, stderr) {
            if (err) {
              err.message = "Failed resizing file";
              return next(err);
            }
            // CDN upload
            cloudstorage.upload(remotePathBuilder(req, resizedFilename), 
              fileUtils.localImagePath(req, resizedFilename),
              function(err, key) {
                if(err) {
                  err.message = "Failed uploading file";
                  return next(err);
                }
                req.uploadedFile[0].resizedFilename = resizedFilename;
                next();
              }); /* CDN upload callback */
          }); /* Image resize callback */
    } /* If sizes are defined */
  } /* Resize function */
} /* Resize function builder*/

 


/*
 |--------------------------------------------------------------------------
 | Login Required Middleware
 |--------------------------------------------------------------------------
 */
function ensureAuthenticated(req, res, next) {
 
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Please make sure your request has an Authorization header' });
  }
  var token = req.headers.authorization.split(' ')[1];
  var payload = jwt.decode(token, config.TOKEN_SECRET);
  if (payload.exp <= moment().unix()) {
    return res.status(401).send({ message: 'Token has expired' });
  }
  
  req.user = payload.sub;
  next();
}

/*
 |--------------------------------------------------------------------------
 | Admin Middleware
 |--------------------------------------------------------------------------
 */
function ensureAdmin(req, res, next) {
  dbProxy.User.find({ where: dbProxy.Sequelize.and({id: req.user },{isAdmin: true}) }).then(function(user) {
    if(!user){
      return res.status(401).send({ message: 'You need to be an admin to access this endpoint' });
    }else{
      next();
    }
  })
}

/*
 |--------------------------------------------------------------------------
 | Generate JSON Web Token
 |--------------------------------------------------------------------------
 */
function createToken(user) {
  var payload = {
    sub: user.id,
    iat: moment().unix(),
    exp: moment().add(14, 'days').unix()
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}

/*
 |--------------------------------------------------------------------------
 | GET /companies/search/
 |--------------------------------------------------------------------------
 */
app.get('/companies/search/:searchString', ensureAuthenticated, ensureAdmin, function(req, res) {
  var searchString = req.params.searchString;
  dbProxy.Company.find({ where: {displayName: searchString} }).then(function(companies) {
    res.send(companies);
  });
});

/*
 |--------------------------------------------------------------------------
 | GET /companies/   
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.get('/companies/', ensureAuthenticated, ensureAdmin, function(req, res) {
  var searchString = req.params.searchString;
  dbProxy.Company.findAll().then(function(companies) {
    res.send(companies);
  });
});


/*
 |--------------------------------------------------------------------------
 | GET /companies/id/labels   
 | return all the companies of the given company
 |--------------------------------------------------------------------------
 */
app.get('/companies/:id/labels', ensureAuthenticated, ensureAdmin, function(req, res) {
  var companyId = req.params.id;
  dbProxy.Company.find({ where: {id: companyId} }).then(function(company) {
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
app.get('/companies/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var companyId = req.params.id;
  dbProxy.Company.find({ where: {id: companyId} }).then(function(company) {
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
app.put('/companies/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var companyId = req.params.id;

  dbProxy.Company.find({where: {id: companyId} }).then(function(company) {
    if (company) { // if the record exists in the db
      company.updateAttributes(req.body).then(function(company) {
        res.send();
      });
    }
  })
});
/*
 |--------------------------------------------------------------------------
 | POST /companies/:idCompany/owners/   POST {the id of owner to add}
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/companies/:companyId/owners', ensureAuthenticated, ensureAdmin, function(req, res) {
  var newOwnerId = req.body.newOwner;
  var companyId = req.params.companyId

  
  console.log(newOwnerId+" == "+companyId)
  dbProxy.Company.find({where: {id: companyId}}).then(function(company) {
    company.getUsers({ where: {id: newOwnerId}}).success(function(users) {
      if(users.length == 0){
          dbProxy.User.find({where: {id: newOwnerId}}).then(function(user) {
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
  ensureAuthenticated, 
  uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
  function (req, res, next) {
    var idCompany = req.params.idCompany;
    dbProxy.Company.find({ where: {id: idCompany} }).then(function(company) {
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


/*
 |--------------------------------------------------------------------------
 | POST /companies/:idCompany/profilePicture/:width/:height   POST {the id of owner to add}
 | return List of all the companies
 |--------------------------------------------------------------------------
 */

app.post('/artists/:idArtist/profilePicture/:width/:height/', 
  ensureAuthenticated, 
  uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
  function (req, res, next) {

  var idArtist = req.params.idArtist;
  dbProxy.Artist.find({ where: {id: idArtist} }).then(function(artist) {
    // We store CDN address as avatar
    var oldAvatar = artist.avatar;
    var oldFullSizeAvatar = artist.fullSizeAvatar;
    artist.avatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
    artist.fullSizeAvatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);
    artist.save().then(function (artist) {
      // we remove old avatars from the CDN
      cloudstorage.remove(oldAvatar);
      cloudstorage.remove(oldFullSizeAvatar);
      // We remove temporarily stored files
      fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].filename));
      fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].resizedFilename));

      res.writeHead(200, {"content-type":"text/html"});   //http response header
      res.end(JSON.stringify(req.uploadedFile));
    });
  }); /* Database read callback */     
});





/*
 |--------------------------------------------------------------------------
 | DELETE /companies/:idCompany/owners/:idUser 
 | delete the owner idUser in the company idCompany
 |--------------------------------------------------------------------------
 */
app.delete('/companies/:companyId/owners/:userId', ensureAuthenticated, ensureAdmin, function(req, res) {
  var ownerId = req.params.userId;
  var companyId = req.params.companyId


  dbProxy.Company.find({where: {id: companyId}}).then(function(company) {
    console.log("REMOVE  USER FROM COMPANY")
    dbProxy.User.find({where: {id: ownerId}}).then(function(user) {
            company.removeUser(user).success(function() {
              res.send();
            })
          })
     
  });
 
 
}); 
/*
 |--------------------------------------------------------------------------
 | POST /companies/   
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/companies/', ensureAuthenticated, ensureAdmin, function(req, res) {
  var companyName = req.body.companyName;
  dbProxy.Company.find({where: {displayName: companyName}}).then(function(company) {
    if(!company){
          dbProxy.Company.create({
            displayName : companyName
          }).success(function(company) {
            res.send(company);
          })  
    }else{
      // TODO, there were an error, need to fix
    }
  });
}); 


/*
 |--------------------------------------------------------------------------
 | LABELS API
 |--------------------------------------------------------------------------
 |--------------------------------------------------------------------------
 | GET /labels/search/
 |--------------------------------------------------------------------------
 */
app.get('/labels/search/:searchString', ensureAuthenticated, ensureAdmin, function(req, res) {
  var searchString = req.params.searchString;
  dbProxy.Label.find({ where: {displayName: searchString} }).then(function(labels) {
    res.send(labels);
  });
});


/*
 |--------------------------------------------------------------------------
 | GET /labels/id   
 | return The company with id passed as part of the path. Empty object if it doesn't exists.
 | this function has been set to limited to admin only. We may consider at some point to release
 | a lighter way for having an all user access (for promo proposal)
 |--------------------------------------------------------------------------
 */

app.get('/labels/:id', ensureAuthenticated, function(req, res) {
  var LabelId = req.params.id;
  dbProxy.Label.find({ where: {id: LabelId} }).then(function(label) {
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

/*
 |--------------------------------------------------------------------------
 | POST /labels/ add label in post payload to the label list of the company 
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/labels/', ensureAuthenticated, function(req, res) {
  var companyId = req.body.companyId;
  var labelName = req.body.labelName;

  console.log("companyId"+companyId)
  console.log("labelName"+labelName)

  dbProxy.Label.find({ where: {displayName: labelName}}).success(function(label) {
    if(!label){
       dbProxy.Label.create({
            displayName: labelName
          }).success(function(label) {
                dbProxy.Company.find({where: {id: companyId}}).then(function(company) {
                  company.addLabels([label]).success(function(labels) {
                            res.send();
                         
                });
              })  
          })
    }
  });
}); 


/*
 |--------------------------------------------------------------------------
 | POST /labels/:idLabel/profilePicture/:width/:height   POST {the avatar picture}
 | return TBD
 |--------------------------------------------------------------------------
 */
/*
  dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
    // We store CDN address as avatar
    var oldAvatar = user.avatar;
    var oldFullSizeAvatar = user.fullSizeAvatar;
    user.avatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
    user.fullSizeAvatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);
    user.save(function(){});
    // we remove old avatars from the CDN
    cloudstorage.remove(oldAvatar);
    cloudstorage.remove(oldFullSizeAvatar);
    // We remove temporarily stored files
    fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].filename));
    fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].resizedFilename));
    // We also return the signed url of the resized image
    cloudstorage.createSignedUrl(req.uploadedFile[0].resizedFilename, "GET", 60, function(err, url) {
      if (err) {
        err.status = 500;
        err.message = "Failed uploading file";
        return next(err);
      }
      req.uploadedFile[0].signedUrl = url;
      res.writeHead(200, {"content-type":"text/html"});   //http response header
      res.end(JSON.stringify(req.uploadedFile)); 
    }); /* Cloud storage signed url callback*/
  //}); /* Database read callback */


app.post('/labels/:idLabel/profilePicture/:width/:height/', 
  ensureAuthenticated, 
  uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),  
  function (req, res, next) {
    var idLabel = req.params.idLabel;
    dbProxy.Label.find({ where: {id: idLabel} }).then(function(label) {
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


/*
 |--------------------------------------------------------------------------
 | POST /labels/:idLabel/dropZone   POST {multiple data to upload picture}
 | return TBD
 |--------------------------------------------------------------------------
 */

app.post('/labels/:idLabel/dropZone/', 
  ensureAuthenticated, 
  uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath), 
  function (req, res, next) {

      var idLabel = req.params.idLabel;
      console.log("****************")
      console.log(req.uploadedFile) 
      console.log("****************")
       


        // orginalfilename:originalfilename, extension: extension,
     
      dbProxy.DropZoneFile.find({ where: dbProxy.Sequelize.and({fileName: req.uploadedFile[0].originalfilename},{extension: req.uploadedFile[0].extension} ) }).then(function(file) {
        if(file){
          // file exists .. Update file? 
          file.path = req.uploadedFile[0].filename;
          file.size = req.uploadedFile[0].filesize;
          file.save().success(function() { 
            res.send();
          })
        }else{
          dbProxy.DropZoneFile.create({
            fileName: req.uploadedFile[0].originalfilename,
            extension: req.uploadedFile[0].extension, 
            size: req.uploadedFile[0].filesize,
            path: req.uploadedFile[0].filename,
          }).success(function(dropZoneFile) {
            dbProxy.Label.find({ where: {id: idLabel}}).then(function(label){
              label.addDropZoneFiles(dropZoneFile).then(function(associationFile) {
                res.send();
              })
            });
            
          })  
        }
         
      });
     //res.send();
});

/*
 |--------------------------------------------------------------------------
 | GET /labels/:idLabel/processReleases/info
 |--------------------------------------------------------------------------
 */
app.get('/labels/:idLabel/processReleases/info', ensureAuthenticated, ensureAdmin, function(req, res) {
    var idLabel = req.params.idLabel;
    dbProxy.Label.find({ where: {id: idLabel}}).then(function(label){
       label.getDropZoneFiles({where: {extension: "xml"}}).then(function(xmls){
          beatportValidate.validate(xmls).then(function(results){
            res.send(results);
          })
           
        })

    })
});

/*
 |--------------------------------------------------------------------------
 | GET /labels/:idLabel/processReleases/
 |--------------------------------------------------------------------------
 */
app.post('/labels/:idLabel/processReleases/', ensureAuthenticated, ensureAdmin, function(req, res) {
    var idLabel = req.params.idLabel;
    dbProxy.Label.find({ where: {id: idLabel}}).then(function(label){
       label.getDropZoneFiles({where: {extension: "xml"}}).then(function(xmls){
          beatportValidate.process(xmls,idLabel).then(function(results){
            console.log("--server response")
            res.send(results);
          })
           
        })

    })
});




/*
 |--------------------------------------------------------------------------
 | POST /labels/:idLabel/labelManagers/   POST {the id of owner to add}
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/labels/:labelId/labelManagers', ensureAuthenticated, ensureAdmin, function(req, res) {
  var newLabelManagerId = req.body.newLabelManager;
  var labelId = req.params.labelId
  console.log(labelId);
 
  dbProxy.Label.find({where: {id: labelId}}).then(function(label) {

    label.getUsers({ where: {id: newLabelManagerId}}).then(function(users) {

      if(users.length == 0){
          dbProxy.User.find({where: {id: newLabelManagerId}}).then(function(user) {
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


/*
 |--------------------------------------------------------------------------
 | GET /labels/id/dropZoneFiles  
 | return The company with id passed as part of the path. Empty object if it doesn't exists.
 | this function has been set to limited to admin only. We may consider at some point to release
 | a lighter way for having an all user access (for promo proposal)
 |--------------------------------------------------------------------------
 */

app.get('/labels/:id/dropZoneFiles', ensureAuthenticated, function(req, res) {
  var LabelId = req.params.id;
  dbProxy.Label.find({ where: {id: LabelId} }).then(function(label) {
    if(label){
        label.getDropZoneFiles().success(function(dropZoneFiles) {
            res.send(dropZoneFiles);
        })
    }
  }); 
});


/*
 |--------------------------------------------------------------------------
 | GET /labels/id/catalog
 | return The company with id passed as part of the path. Empty object if it doesn't exists.
 | this function has been set to limited to admin only. We may consider at some point to release
 | a lighter way for having an all user access (for promo proposal)
 |--------------------------------------------------------------------------
 */

app.get('/labels/:id/catalog', ensureAuthenticated, function(req, res) {
  var LabelId = req.params.id;
  dbProxy.Label.find({ where: {id: LabelId} }).then(function(label) {
    if(label){
        label.getReleases().success(function(releases) {
            res.send(releases);
        })
    }
  }); 
});



/*
 |--------------------------------------------------------------------------
 | DELETE /labels/:idLabels/labelManagers/:idUser 
 | delete the owner idUser in the company idCompany
 |--------------------------------------------------------------------------
 */
app.delete('/labels/:labelId/labelManagers/:userId', ensureAuthenticated, ensureAdmin, function(req, res) {
  var userId = req.params.userId;
  var labelId = req.params.labelId


  dbProxy.Label.find({where: {id: labelId}}).then(function(label) {
    dbProxy.User.find({where: {id: userId}}).then(function(user) {
            label.removeUser(user).success(function() {
              res.send();
            })
          })
     
  });
 
 
}); 


/*
 |--------------------------------------------------------------------------
 | RELEASE API
 |--------------------------------------------------------------------------
 */
/*
 |--------------------------------------------------------------------------
 | GET /releases/:id   
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.get('/releases/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var releaseId = req.params.id

   
  dbProxy.Release.find({where: {id:releaseId},
     include: [
      {model: dbProxy.Track, include: [
        {model: dbProxy.Artist, as: 'Remixer'},
        {model: dbProxy.Artist, as: 'Producer'}
      ]},{model: dbProxy.Label}
    ]


    }).then(function(release) {
 
    res.send(release);
  });
});
/*
 |--------------------------------------------------------------------------
 | PUT /releases/:id   
 | return TBD 
 |--------------------------------------------------------------------------
 */
app.put('/releases/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var releaseId = req.params.id

  var release = req.body.release;
    // update the 
  
  console.log('begin chain of sequelize commands');
  // UPDATE THE RELEASE
  dbProxy.Release.find({where: {id:releaseId}}).then(function(newRelease) {
      var trackUpdatePromises = [];

      for (var i = release.Tracks.length - 1; i >= 0; i--) {
        trackUpdatePromises.push(
        dbProxy.Track.find({where: {id:release.Tracks[i].id}}).then(function(track){
           // UPDATE TRACK INFO:
              var deferred = Q.defer();

              var jsonTrack;
              for (var i = release.Tracks.length - 1; i >= 0; i--) {
                if(release.Tracks[i].id == track.id){
                  jsonTrack = release.Tracks[i];
                }
              }
             
              track.updateAttributes(jsonTrack).then(function(newTrack) {
                // SET THE ARTISTS
                
                // list of promixes tu track 
                
                // 
                // 
                var newProducers = [];
                for (var i = jsonTrack.Producer.length - 1; i >= 0; i--) {
                  newProducers.push(jsonTrack.Producer[i].id);
                };
                
                var newRemixers = [];
                for (var i = jsonTrack.Remixer.length - 1; i >= 0; i--) {
                  newRemixers.push(jsonTrack.Remixer[i].id);
                };
                
                // Q.all  accept an array of promises functions. Call the done when all are successful
                Q.all([track.setRemixer(newRemixers), track.setProducer(newProducers)]).done(function () {
                  deferred.resolve();
                });
               
                //res.send();
              })
            // I NEED TO RETURN HERE A PROMIXE 
              return deferred.promise;
            
        })
        )  // push into trackUpdate Promises 
      }; 

      Q.allSettled(trackUpdatePromises)  
        .then(function (results) {
          results.forEach(function (result) {
            console.log("Update Track Request Done")
          });
          console.log("SENDING OUT")
          res.send(results);
        })
  })


});

/*
 |--------------------------------------------------------------------------
 | ARTIST API
 |--------------------------------------------------------------------------
 */
/*
 |--------------------------------------------------------------------------
 | GET /artists/search/:searchString 
 | return list of all the artists that match the searchString
 |--------------------------------------------------------------------------
 */
app.get('/artists/search/:searchString', ensureAuthenticated, ensureAdmin, function(req, res) {
  var searchString = req.params.searchString;
  dbProxy.Artist.findAll({ where: {displayName: searchString} }).then(function(artists) {
    res.send(artists);
  });
});

/*
 |--------------------------------------------------------------------------
 | GET /artists/   
 | return List of all the artists
 | TODO: pagination
 |--------------------------------------------------------------------------
 */
app.get('/artists/', ensureAuthenticated, ensureAdmin, function(req, res) {
 
  dbProxy.Artist.findAll().then(function(artists) {
    res.send(artists);
  });
});

/*
 |--------------------------------------------------------------------------
 | GET /artists/:id 
 | return List of all the artists
 |--------------------------------------------------------------------------
 */
app.get('/artists/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var artistId = req.params.id;
  dbProxy.Artist.find({ where: {id: artistId}, include: [
      {model: dbProxy.User}]
    }).then(function(artist) {
    res.send(artist);
  });
});

/*
 |--------------------------------------------------------------------------
 | PUT /artists/:id 
 | return List of all the artists
 |--------------------------------------------------------------------------
 */
app.put('/artists/:id', ensureAuthenticated, ensureAdmin, function(req, res) {
  var artistId = req.params.id;
  console.log("Update artist")
  dbProxy.Artist.find({where: {id: artistId} }).then(function(artist) {
    if (artist) { // if the record exists in the db
     artist.updateAttributes(req.body).then(function(artist) {
        res.send();
      });
    }
  })
});


/*
 |--------------------------------------------------------------------------
 | Post /artists/
 |--------------------------------------------------------------------------
 */
app.post('/artists/', ensureAuthenticated, ensureAdmin, function(req, res) {
  var artistName = req.body.displayName;
  
  dbProxy.Artist.find({ where: {displayName: artistName} }).then(function(artist) {
       if(!artist){
          dbProxy.Artist.create({
            displayName: artistName
          }).success(function(newArtist) {
            artist = newArtist;
          })  
       }
       res.send(artist);
  });
});
/*
 |--------------------------------------------------------------------------
 | POST /artists/:idArtist/owners/   POST {the id of owner to add}
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/artists/:artistId/owners', ensureAuthenticated, ensureAdmin, function(req, res) {
  var newOwnerId = req.body.newOwner;
  var artistId = req.params.artistId

  
  console.log(newOwnerId+" == "+artistId)
  dbProxy.Artist.find({where: {id: artistId}}).then(function(artist) {
    artist.getUsers({ where: {id: newOwnerId}}).success(function(users) {
      if(users.length == 0){
          dbProxy.User.find({where: {id: newOwnerId}}).then(function(user) {
            artist.addUsers(user).success(function() {
              res.send();
            })
          })
      }else{
        
        console.log("This user was already associated to this artist!")
        // TODO, there were an error, need to fix
      }
    })
  });
}); 


/*
 |--------------------------------------------------------------------------
 | POST /companies/:idCompany/owners/   POST {the id of owner to add}
 | return List of all the companies
 |--------------------------------------------------------------------------
 */
app.post('/companies/:companyId/owners', ensureAuthenticated, ensureAdmin, function(req, res) {
  var newOwnerId = req.body.newOwner;
  var companyId = req.params.companyId

  
  console.log(newOwnerId+" == "+companyId)
  dbProxy.Company.find({where: {id: companyId}}).then(function(company) {
    company.getUsers({ where: {id: newOwnerId}}).success(function(users) {
      if(users.length == 0){
          dbProxy.User.find({where: {id: newOwnerId}}).then(function(user) {
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
 | USERS API
 |--------------------------------------------------------------------------
 */
/*
 |--------------------------------------------------------------------------
 | GET /users/search/
 |--------------------------------------------------------------------------
 */
app.get('/users/search/:searchString', ensureAuthenticated, ensureAdmin, function(req, res) {
  var searchString = req.params.searchString;
  dbProxy.User.findAll({ where: {displayName: searchString} }).then(function(users) {
       console.log(users)
    res.send(users);
  });
});







/*
 |--------------------------------------------------------------------------
 | GET /me
 |--------------------------------------------------------------------------
 */
app.get('/me', ensureAuthenticated, function(req, res) {
   
  dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
    
    res.send(user);
  });
});

/*
 |--------------------------------------------------------------------------
 | GET /me/companies/
 | Get all the companies of an autenticated account
 |--------------------------------------------------------------------------
 */
app.get('/me/companies', ensureAuthenticated, function(req, res) {
   
   dbProxy.User.find({where: {id: req.user}}).then(function(user) {
    if(user.isAdmin){
      dbProxy.Company.findAll().success(function(companies) { 
        res.send(companies);
      })
    } else {
      user.getCompanies().success(function(companies) { 
        res.send(companies);
      })
    }
       
    })
});

/*
 |--------------------------------------------------------------------------
 | GET /me/labels/
 | Get all the companies of an autenticated account
 |--------------------------------------------------------------------------
 */
app.get('/me/labels', ensureAuthenticated, function(req, res) {
   
   dbProxy.User.find({where: {id: req.user}}).then(function(user) {
      if(user.isAdmin){
        dbProxy.Label.findAll().success(function(labels) { 
          res.send(labels);
        })
      } else {
        user.getLabels().success(function(labels) { 
          res.send(labels);
        })
      }
    })
});


/*
 |--------------------------------------------------------------------------
 | GET /me/artists/
 | Get all the companies of an autenticated account
 |--------------------------------------------------------------------------
 */
app.get('/me/artists', ensureAuthenticated, function(req, res) {
   
   dbProxy.User.find({where: {id: req.user}}).then(function(user) {
      
        user.getArtists().success(function(artists) { 
          res.send(artists);
        })
      
    })
});



/*
 |--------------------------------------------------------------------------
 | PUT /api/me
 |--------------------------------------------------------------------------
 */
app.put('/me', ensureAuthenticated, function(req, res) {
  dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
    if (!user) {
      return res.status(400).send({ message: 'User not found' });
    }
    user.displayName = req.body.displayName || user.displayName;
    user.email = req.body.email || user.email;
    user.save(function(err) {
      res.status(200).end();
    });
  });
});


/*
 |--------------------------------------------------------------------------
 | Log in with Email
 |--------------------------------------------------------------------------
 */
app.post('/auth/login', function(req, res) {
  
  dbProxy.User.find({ where: {email: req.body.email} }).then(function(user) {
  // project will be the first entry of the Projects table with the title 'aProject' || null
    if (!user) {
      return res.status(401).send({ message: 'Wrong email and/or password' });
    } else {
      var isMatch = user.comparePassword(req.body.password)
      if (!isMatch) {
        return res.status(401).send({ message: 'Wrong email and/or password' });
      } else {
        res.send({ token: createToken(user) });
      }
    }
  })
});

/*
 |--------------------------------------------------------------------------
 | Create Email and Password Account
 |--------------------------------------------------------------------------
 */
app.post('/auth/signup', function(req, res) {
    dbProxy.User.find({ where: {email: req.body.email}}).then(function(existingUser) {
    if (existingUser) {
      return res.status(409).send({ message: 'Email is already taken' });
    }
    dbProxy.User.create({
      email: req.body.email,
      password: req.body.password, 
      displayName: req.body.displayName,
    }).success(function(user) {
      res.send({ token: createToken(user) });
    })  
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with Google
 |--------------------------------------------------------------------------
 */
app.post('/auth/google', function(req, res) {
  var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
  var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.GOOGLE_SECRET,
    redirect_uri: req.body.redirectUri,
    grant_type: 'authorization_code'
  };

  // Step 1. Exchange authorization code for access token.
  request.post(accessTokenUrl, { json: true, form: params }, function(err, response, token) {
    var accessToken = token.access_token;
    var headers = { Authorization: 'Bearer ' + accessToken };

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: peopleApiUrl, headers: headers, json: true }, function(err, response, profile) {

      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        dbProxy.User.findOne({ google: profile.sub }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a Google account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          dbProxy.User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.google = profile.sub;
            user.displayName = user.displayName || profile.name;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        dbProxy.User.findOne({ google: profile.sub }, function(err, existingUser) {
          if (existingUser) {
            return res.send({ token: createToken(existingUser) });
          }

           


          var user = new User();
          user.google = profile.sub;
          user.displayName = profile.name;
          user.save(function(err) {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with GitHub
 |--------------------------------------------------------------------------
 */
app.post('/auth/github', function(req, res) {
  var accessTokenUrl = 'https://github.com/login/oauth/access_token';
  var userApiUrl = 'https://api.github.com/user';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.GITHUB_SECRET,
    redirect_uri: req.body.redirectUri
  };

  // Step 1. Exchange authorization code for access token.
  request.get({ url: accessTokenUrl, qs: params }, function(err, response, accessToken) {
    accessToken = qs.parse(accessToken);
    var headers = { 'User-Agent': 'Satellizer' };

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: userApiUrl, qs: accessToken, headers: headers, json: true }, function(err, response, profile) {

      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        dbProxy.User.findOne({ github: profile.id }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a GitHub account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.github = profile.id;
            user.displayName = user.displayName || profile.name;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        dbProxy.User.findOne({ github: profile.id }, function(err, existingUser) {
          if (existingUser) {
            var token = createToken(existingUser);
            return res.send({ token: token });
          }
          var user = new User();
          user.github = profile.id;
          user.displayName = profile.name;
          user.save(function() {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with LinkedIn
 |--------------------------------------------------------------------------
 */
app.post('/auth/linkedin', function(req, res) {
  var accessTokenUrl = 'https://www.linkedin.com/uas/oauth2/accessToken';
  var peopleApiUrl = 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,email-address)';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.LINKEDIN_SECRET,
    redirect_uri: req.body.redirectUri,
    grant_type: 'authorization_code'
  };

  // Step 1. Exchange authorization code for access token.
  request.post(accessTokenUrl, { form: params, json: true }, function(err, response, body) {
    if (response.statusCode !== 200) {
      return res.status(response.statusCode).send({ message: body.error_description });
    }
    var params = {
      oauth2_access_token: body.access_token,
      format: 'json'
    };

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: peopleApiUrl, qs: params, json: true }, function(err, response, profile) {

      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        dbProxy.User.findOne({ linkedin: profile.id }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a LinkedIn account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.linkedin = profile.id;
            user.displayName = user.displayName || profile.firstName + ' ' + profile.lastName;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        dbProxy.User.findOne({ linkedin: profile.id }, function(err, existingUser) {
          if (existingUser) {
            return res.send({ token: createToken(existingUser) });
          }
          var user = new User();
          user.linkedin = profile.id;
          user.displayName = profile.firstName + ' ' + profile.lastName;
          user.save(function() {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with Windows Live
 | // Step 1. Exchange authorization code for access token.
 | // Step 2. Retrieve profile information about the current user.
 | // Step 3. [if] Link user accounts.
 | // Step 3. [else] Create a new user or return an existing account.
 |--------------------------------------------------------------------------
 */
app.post('/auth/live', function(req, res) {
  async.waterfall([
    function(done) {
      var accessTokenUrl = 'https://login.live.com/oauth20_token.srf';
      var params = {
        code: req.body.code,
        client_id: req.body.clientId,
        client_secret: config.WINDOWS_LIVE_SECRET,
        redirect_uri: req.body.redirectUri,
        grant_type: 'authorization_code'
      };
      request.post(accessTokenUrl, { form: params, json: true }, function(err, response, accessToken) {
        done(null, accessToken);
      });
    },
    function(accessToken, done) {
      var profileUrl = 'https://apis.live.net/v5.0/me?access_token=' + accessToken.access_token;
      request.get({ url: profileUrl, json: true }, function(err, response, profile) {
        done(err, profile);
      });
    },
    function(profile) {
      if (!req.headers.authorization) {
        User.findOne({ live: profile.id }, function(err, user) {
          if (user) {
            return res.send({ token: createToken(user) });
          }
          var newUser = new User();
          newUser.live = profile.id;
          newUser.displayName = profile.name;
          newUser.save(function() {
            var token = createToken(newUser);
            res.send({ token: token });
          });
        });
      } else {
        User.findOne({ live: profile.id }, function(err, user) {
          if (user) {
            return res.status(409).send({ message: 'There is already a Windows Live account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function(err, existingUser) {
            if (!existingUser) {
              return res.status(400).send({ message: 'User not found' });
            }
            existingUser.live = profile.id;
            existingUser.displayName = existingUser.name;
            existingUser.save(function() {
              var token = createToken(existingUser);
              res.send({ token: token });
            });
          });
        });
      }
    }
  ]);
});

/*
 |--------------------------------------------------------------------------
 | Login with Facebook
 |--------------------------------------------------------------------------
 */
app.post('/auth/facebook', function(req, res) {
  var accessTokenUrl = 'https://graph.facebook.com/oauth/access_token';
  var graphApiUrl = 'https://graph.facebook.com/me';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.FACEBOOK_SECRET,
    redirect_uri: req.body.redirectUri
  };

  // Step 1. Exchange authorization code for access token.
  request.get({ url: accessTokenUrl, qs: params, json: true }, function(err, response, accessToken) {
    if (response.statusCode !== 200) {
      return res.status(500).send({ message: accessToken.error.message });
    }
    accessToken = qs.parse(accessToken);

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: graphApiUrl, qs: accessToken, json: true }, function(err, response, profile) {
      if (response.statusCode !== 200) {
        return res.status(500).send({ message: profile.error.message });
      }


      if (req.headers.authorization) {
        User.findOne({ facebook: profile.id }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a Facebook account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          dbProxy.User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.facebook = profile.id;
            user.displayName = user.displayName || profile.name;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({ facebook: profile.id }, function(err, existingUser) {
          if (existingUser) {
            var token = createToken(existingUser);
            return res.send({ token: token });
          }
          var user = new User();
          user.facebook = profile.id;
          user.displayName = profile.name;
          user.save(function() {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with Yahoo
 |--------------------------------------------------------------------------
 */
app.post('/auth/yahoo', function(req, res) {
  var accessTokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
  var clientId = req.body.clientId;
  var clientSecret = config.YAHOO_SECRET;
  var formData = {
    code: req.body.code,
    redirect_uri: req.body.redirectUri,
    grant_type: 'authorization_code'
  };
  var headers = { Authorization: 'Basic ' + new Buffer(clientId + ':' + clientSecret).toString('base64') };

  // Step 1. Exchange authorization code for access token.
  request.post({ url: accessTokenUrl, form: formData, headers: headers, json: true }, function(err, response, body) {
    var socialApiUrl = 'https://social.yahooapis.com/v1/user/' + body.xoauth_yahoo_guid + '/profile?format=json';
    var headers = { Authorization: 'Bearer ' + body.access_token };

    // Step 2. Retrieve profile information about the current user.
    request.get({ url: socialApiUrl, headers: headers, json: true }, function(err, response, body) {

      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        User.findOne({ yahoo: body.profile.guid }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a Yahoo account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.yahoo = body.profile.guid;
            user.displayName = user.displayName || body.profile.nickname;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({ yahoo: body.profile.guid }, function(err, existingUser) {
          if (existingUser) {
            return res.send({ token: createToken(existingUser) });
          }
          var user = new User();
          user.yahoo = body.profile.guid;
          user.displayName = body.profile.nickname;
          user.save(function() {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with Twitter
 |--------------------------------------------------------------------------
 */
app.get('/auth/twitter', function(req, res) {
  var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
  var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
  var authenticateUrl = 'https://api.twitter.com/oauth/authenticate';

  if (!req.query.oauth_token || !req.query.oauth_verifier) {
    var requestTokenOauth = {
      consumer_key: config.TWITTER_KEY,
      consumer_secret: config.TWITTER_SECRET,
      callback: config.TWITTER_CALLBACK
    };

    // Step 1. Obtain request token for the authorization popup.
    request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
      var oauthToken = qs.parse(body);
      console.log(body)
      var params = qs.stringify({ oauth_token: oauthToken.oauth_token });

      // Step 2. Redirect to the authorization screen.
      res.redirect(authenticateUrl + '?' + params);
    });
  } else {
    var accessTokenOauth = {
      consumer_key: config.TWITTER_KEY,
      consumer_secret: config.TWITTER_SECRET,
      token: req.query.oauth_token,
      verifier: req.query.oauth_verifier
    };

    // Step 3. Exchange oauth token and oauth verifier for access token.
    request.post({ url: accessTokenUrl, oauth: accessTokenOauth }, function(err, response, profile) {
      console.log("----------------")
      console.log(profile)
      console.log("----------------")
      profile = qs.parse(profile);
 
      // Step 4a. Link user accounts.
      if (req.headers.authorization) {

        dbProxy.User.find({ where: {twitter: profile.user_id} }).then(function(existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a Twitter account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          console.log(profile)          

          dbProxy.User.find({ where: {id: payload.sub} }).then(function(user){
            if (!user) {
              return res.status(400).send({ message: 'Something went wrong in the linkage process' });
            }
            user.twitter = profile.user_id;
            // keep one of the two usernames 
            user.displayName = user.displayName || profile.screen_name;
            user.save().success(function() { 
              res.send({ token: createToken(user) });
            }).error(function(error) {
              // update fail ... :O
            })
          });
        });
      } else {
            console.log("step 4b")
        // Step 4b. Create a new user account or return an existing one.
        // 
        dbProxy.User.find({ where: {twitter: profile.user_id} }).then(function(existingUser) {
          if (existingUser) {
            var token = createToken(existingUser);
            return res.send({ token: token });
          }
          console.log(profile)
          dbProxy.User.create({
            twitter: profile.user_id,
            displayName: profile.screen_name
          }).success(function(user) {
            res.send({ token: createToken(user) });
          })  
 
        });
      }
    });
  }
});

/*
 |--------------------------------------------------------------------------
 | Login with Foursquare
 |--------------------------------------------------------------------------
 */
app.post('/auth/foursquare', function(req, res) {
  var accessTokenUrl = 'https://foursquare.com/oauth2/access_token';
  var profileUrl = 'https://api.foursquare.com/v2/users/self';
  var formData = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.FOURSQUARE_SECRET,
    redirect_uri: req.body.redirectUri,
    grant_type: 'authorization_code'
  };

  // Step 1. Exchange authorization code for access token.
  request.post({ url: accessTokenUrl, form: formData, json: true }, function(err, response, body) {
    var params = {
      v: '20140806',
      oauth_token: body.access_token
    };

    // Step 2. Retrieve information about the current user.
    request.get({ url: profileUrl, qs: params, json: true }, function(err, response, profile) {
      profile = profile.response.user;

      // Step 3a. Link user accounts.
      if (req.headers.authorization) {
        User.findOne({ foursquare: profile.id }, function(err, existingUser) {
          if (existingUser) {
            return res.status(409).send({ message: 'There is already a Foursquare account that belongs to you' });
          }
          var token = req.headers.authorization.split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function(err, user) {
            if (!user) {
              return res.status(400).send({ message: 'User not found' });
            }
            user.foursquare = profile.id;
            user.displayName = user.displayName || profile.firstName + ' ' + profile.lastName;
            user.save(function() {
              var token = createToken(user);
              res.send({ token: token });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({ foursquare: profile.id }, function(err, existingUser) {
          if (existingUser) {
            var token = createToken(existingUser);
            return res.send({ token: token });
          }
          var user = new User();
          user.foursquare = profile.id;
          user.displayName = profile.firstName + ' ' + profile.lastName;
          user.save(function() {
            var token = createToken(user);
            res.send({ token: token });
          });
        });
      }
    });
  });
});


/*
 |--------------------------------------------------------------------------
 | Unlink Provider
 |--------------------------------------------------------------------------
 */

app.get('/auth/unlink/:provider', ensureAuthenticated, function(req, res) {
  var provider = req.params.provider;

  dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
    if (!user) {
      return res.status(400).send({ message: 'User not found' });
    }
    user[provider] = undefined;
    user.save(function() {
      res.status(200).end();
    });
  });
});

/**
 * Error handlers have to be defined after all routes
 * development: prints stack traces
 * producetion: does not print stack traces
 **/
if (app.get('env') === 'development') {
 
  app.use(function(err, req, res, next) {
    console.log("CALLED ERROR HANDLING");
    res.status(err.status || 500);
    res.json( {
        status: "ERROR",
        message: err.message,
        error: err
    });
  });
 
}
 
// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    console.log("CALLED ERROR HANDLING");
    res.status(err.status || 500);
    res.json( {
        status: "ERROR",
        message: err.message,
        error: {}
    });
});

/*
 |--------------------------------------------------------------------------
 | Start the Server
 |--------------------------------------------------------------------------
 */
server.listen(app.get('port'), app.get('host'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

