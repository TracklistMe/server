/**
 * Satellizer Node.js Example
 * (c) 2014 Sahat Yalkabov
 * License: MIT
 */

/*
 * Used to require modules starting from root of the app
 */
global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
}


var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var busboy = require('connect-busboy');
var qs = require('querystring');
var http = require('http');
var async = require('async');
var bodyParser = require('body-parser');
var express = require('express');
var logger = require('morgan');
var request = require('request');
var multipart = require('connect-multiparty');
var expressValidator = require('express-validator')


var config = rootRequire('config/config');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');
var fileUtils = rootRequire('utils/file-utils');

/*
 * Require controllers
 */
var users = rootRequire('controllers/users.js');
var companies = rootRequire('controllers/companies.js');
var artists = rootRequire('controllers/artists.js');
var labels = rootRequire('controllers/labels.js');
var tracks = rootRequire('controllers/tracks.js');
var releases = rootRequire('controllers/releases.js');
var genres = rootRequire('controllers/genres.js');
var authenticators = rootRequire('controllers/authenticators.js');
var stripePayment = rootRequire('controllers/stripePayment.js');
/*
 * Require models
 */
var dbProxy = rootRequire('models/model');

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
if (process.env.HOST == undefined) {
    hostname = 'store.tracklist.me';
} else {
    hostname = process.env.HOST;
}
console.log(hostname);
app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(expressValidator());
app.use(function(req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://' + hostname);
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
            res.json({
                status: 'ERROR',
                message: 'Signed url not found',
                url: url
            });
            return;
        }
        res.json({
            status: 'RUNNING',
            message: 'Server is working fine',
            url: url
        });
    });
});

app.get('/testUpload', function(req, res) {
    cloudstorage.upload('img/default.png',
        __dirname + '/uploadFolder/img/1_1421078454067_KennyRandomWallpaper.jpg',
        function(err, filename) {
            if (err) {
                console.log(err);
                res.status = 500;
                res.json({
                    status: 'ERROR',
                    message: 'Error uploading file',
                    filename: filename
                });
                return;
            }
            res.status = 200;
            res.send();
        });
});

/**
 * TODO fix ugly redirect and check for authentication
 **/
app.get('/images/*', function(req, res, next) {

    console.log(req.originalUrl)

    var mimeTypes = {
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "png": "image/png"
    };

    var image = req.originalUrl.substring(8, req.originalUrl.length);

    cloudstorage.createSignedUrl(image, "GET", 20, function(err, url) {
        if (err) {
            //throw err;
            err.status = 404;
            err.message = "Image not found";
            return next(err);
        }
        console.log("ERR: ");
        console.log(err)
        console.log("URL")
        console.log(url)

        res.redirect(url);
    }); /* Cloud storage signed url callback*/
});


/**
 * SNIPPETS
 **/
app.get('/snippets/*', function(req, res, next) {

    console.log(req.originalUrl)

    var mimeTypes = {
        "mp3": "audio/mpeg",
        "ogg": "audio/ogg"
    };



    var snippet = req.originalUrl.substring(10, req.originalUrl.length);

    cloudstorage.createSignedUrl(snippet, "GET", 20, function(err, url) {
        if (err) {
            //throw err;
            err.status = 404;
            err.message = "Image not found";
            return next(err);
        }
        console.log("ERR: ");
        console.log(err)
        console.log("URL")
        console.log(url)

        res.redirect(url);
    }); /* Cloud storage signed url callback*/
});


app.get('/waveforms/*', function(req, res) {

    console.log(req.originalUrl)

    var mimeTypes = {
        "json": "application/javascript"
    };

    var json = req.originalUrl.substring(11, req.originalUrl.length);
    console.log("TRY TO FETCH ");
    console.log(json)
    console.log("-----")
    cloudstorage.createSignedUrl(json, "GET", 20, function(err, url) {
        if (err) {
            //throw err;
            err.status = 404;
            err.message = "Image not found";
            return next(err);
        }
        console.log("ERR: ");
        console.log(err)
        console.log("URL")
        console.log(url)

        res.redirect(url);
    }); /* Cloud storage signed url callback*/
});



//D.I.
users.controller(app);
companies.controller(app);
artists.controller(app);
labels.controller(app);
tracks.controller(app);
releases.controller(app);
genres.controller(app);
authenticators.controller(app);
stripePayment.controller(app);

/**
 * Error handlers have to be defined after all routes
 * development: prints stack traces
 * producetion: does not print stack traces
 **/

if (app.get('env') === 'development') {

    app.use(function(err, req, res, next) {
        console.log(err);
        res.status(err.status || 500);
        res.json({
            status: err.status,
            message: err.message,
            validation: err.validation,
            error: err
        });
    });

} else {

    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.json({
            status: "ERROR",
            message: err.message,
            validation: err.validation,
            error: {}
        });
    });

}

/*
 * Start the server
 */
server.listen(app.get('port'), app.get('host'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});