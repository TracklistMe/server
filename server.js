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

var multipart = require('connect-multiparty');
var im = require('imagemagick');

/* DATA BASE */

var dbProxy = require('libs/database/databaseProxy');




 

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

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:9000');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'my-header,X-Requested-With,content-type,Authorization');

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

app.use('/images', express.static(__dirname + '/uploadFolder/img/'));


app.post('/upload', ensureAuthenticated, function (req, res, next) {
    console.log("USER"+req.user)
    var arr;
    var fstream;
    var filesize = 0;
    req.pipe(req.busboy);

      //--------------------------------------------------------------------------
    req.busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      //uploaded file name, encoding, MIME type
      console.log('File [' + fieldname +']: filename:' + filename + ', encoding:' + encoding + ', MIME type:'+ mimetype);
      //uploaded file size
      file.on('data', function(data) {
      //console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
      fileSize = data.length;
      //console.log("fileSize= " + fileSize);
    });

    file.on('end', function() {
      console.log('File [' + fieldname + '] ENDed');
      console.log("-------------------------");
    });
    if (!Date.now) {
        Date.now = function() { return new Date().getTime(); }
    }
    var extension = filename.split('.').slice(0).pop(),
    filename = filename.replace(extension, '').replace(/\W+/g, '') + "." + extension;
    filename = req.user+"_"+Date.now()+"_"+filename;
   
    //populate array
    //I am collecting file info in data read about the file. It may be more correct to read 
    //file data after the file has been saved to img folder i.e. after file.pipe(stream) completes
    //the file size can be got using stats.size as shown below
    arr= [{fieldname: fieldname, filename: filename, encoding: encoding, MIMEtype: mimetype}];
    //save files in the form of userID + timestamp + filenameSanitized
    //Path where image will be uploaded
    fstream = fs.createWriteStream(__dirname + '/uploadFolder/img/' + filename); //create a writable stream
    file.pipe(fstream);   //pipe the post data to the file

   

    //stream Ended - (data written) send the post response
    req.on('end', function () {
      dbProxy.User.find({ where: {id: req.user} }).then(function(user) {
        user.avatar = 'cropped_' +filename,
        user.save(function(){
                       //http response body - send json data
        });
        res.writeHead(200, {"content-type":"text/html"});   //http response header
        res.end(JSON.stringify(arr)); 
          
      });

      
    });

    //Finished writing to stream
    fstream.on('finish', function () { 
      console.log('Finished writing!'); 
          // resize image with Image Magick
        im.crop({
        srcPath: __dirname + '/uploadFolder/img/' + filename,
        dstPath: __dirname + '/uploadFolder/img/cropped_' + filename,
        width: 500,
        height: 500,
        quality: 1,
        gravity: 'Center'
        }, function(err, stdout, stderr){
            if (err) throw err;
            console.log('Image resized')
        });
        //Get file stats (including size) for file saved to server
        fs.stat(__dirname + '/uploadFolder/img/' + filename, function(err, stats) {
            if(err) 
              throw err;      
            //if a file
            if (stats.isFile()) {
                //console.log("It\'s a file & stats.size= " + JSON.stringify(stats)); 
                 
                  
                console.log("File size saved to server: " + stats.size);  
                console.log("-----------------------");
            };
          });
    });


        // error
    fstream.on('error', function (err) {
      console.log(err);
    });

    
    });  // @END/ .req.busboy
  });  //  @END/ POST
  

 




/*
 |--------------------------------------------------------------------------
 | Upload Function
 |--------------------------------------------------------------------------
 */

function upload(req,res,next){
    var arr;
    var fstream;
    var filesize = 0;
    req.pipe(req.busboy);

      //--------------------------------------------------------------------------
    req.busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      //uploaded file name, encoding, MIME type
      console.log('File [' + fieldname +']: filename:' + filename + ', encoding:' + encoding + ', MIME type:'+ mimetype);
      //uploaded file size
      file.on('data', function(data) {
      //console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
      fileSize = data.length;
      //console.log("fileSize= " + fileSize);
    });

    file.on('end', function() {
      console.log('File [' + fieldname + '] ENDed');
      console.log("-------------------------");
    });
    if (!Date.now) {
        Date.now = function() { return new Date().getTime(); }
    }
    var extension = filename.split('.').slice(0).pop(),
    filename = filename.replace(extension, '').replace(/\W+/g, '') + "." + extension;
    filename = req.user+"_"+Date.now()+"_"+filename;
   
    //populate array
    //I am collecting file info in data read about the file. It may be more correct to read 
    //file data after the file has been saved to img folder i.e. after file.pipe(stream) completes
    //the file size can be got using stats.size as shown below
    arr= [{fieldname: fieldname, filename: filename, encoding: encoding, MIMEtype: mimetype}];
    //save files in the form of userID + timestamp + filenameSanitized
    //Path where image will be uploaded
    fstream = fs.createWriteStream(__dirname + '/uploadFolder/img/' + filename); //create a writable stream
    file.pipe(fstream);   //pipe the post data to the file

   

    //stream Ended - (data written) send the post response
    req.on('end', function () {
      req.user = 'cropped_' +filename;
      next();
    });

    //Finished writing to stream
    fstream.on('finish', function () { 
      console.log('Finished writing!'); 
          // resize image with Image Magick
        im.crop({
        srcPath: __dirname + '/uploadFolder/img/' + filename,
        dstPath: __dirname + '/uploadFolder/img/cropped_' + filename,
        width: 500,
        height: 500,
        quality: 1,
        gravity: 'Center'
        }, function(err, stdout, stderr){
            if (err) throw err;
            console.log('Image resized')
        });
        //Get file stats (including size) for file saved to server
        fs.stat(__dirname + '/uploadFolder/img/' + filename, function(err, stats) {
            if(err) 
              throw err;      
            //if a file
            if (stats.isFile()) {
                //console.log("It\'s a file & stats.size= " + JSON.stringify(stats)); 
                 
                  
                console.log("File size saved to server: " + stats.size);  
                console.log("-----------------------");
            };
          });
    });


        // error
    fstream.on('error', function (err) {
      console.log(err);
    });

    
    });  // @END/ .req.busboy


}


 


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

  dbProxy.Label.find({ where: {displayName: labelName}}).success(function(label) {
    if(!label){
       dbProxy.Label.create({
            displayName: labelName
          }).success(function(label) {
                dbProxy.Company.find({where: {id: companyId}}).then(function(company) {
                  company.setLabels([label]).success(function(labels) {
                            res.send();
                         
                });
              })  
          })
    }
  });
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

/*
 |--------------------------------------------------------------------------
 | Start the Server
 |--------------------------------------------------------------------------
 */
app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});