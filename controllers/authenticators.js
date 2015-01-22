'use strict';

var fileUtils             = require('utils/file-utils');
var authenticationUtils   = require('utils/authentication-utils');
var model                 = require('models/model');
var cloudstorage          = require('libs/cloudstorage/cloudstorage');
var beatport              = require('libs/beatport/beatport');
var fs                    = require('fs-extra');
var Q                     = require('q');
var path                  = require('path');

module.exports.controller = function(app) {

  /*
   |--------------------------------------------------------------------------
   | Create Email and Password Account
   |--------------------------------------------------------------------------
   */
  app.post('/auth/signup', function(req, res) {
      model.User.find({ where: {email: req.body.email}}).then(function(existingUser) {
      if (existingUser) {
        return res.status(409).send({ message: 'Email is already taken' });
      }
      model.User.create({
        email: req.body.email,
        password: req.body.password, 
        displayName: req.body.displayName,
      }).success(function(user) {
        res.send({ token: authenticationUtils.createToken(user) });
      })  
    });
  });

  /*
   |--------------------------------------------------------------------------
   | Log in with Email
   |--------------------------------------------------------------------------
   */
  app.post('/auth/login', function(req, res) {
    
    model.User.find({ where: {email: req.body.email} }).then(function(user) {
    // project will be the first entry of the Projects table with the title 'aProject' || null
      if (!user) {
        return res.status(401).send({ message: 'Wrong email and/or password' });
      } else {
        var isMatch = user.comparePassword(req.body.password)
        if (!isMatch) {
          return res.status(401).send({ message: 'Wrong email and/or password' });
        } else {
          res.send({ token: authenticationUtils.createToken(user) });
        }
      }
    })
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
          model.User.findOne({ google: profile.sub }, function(err, existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a Google account that belongs to you' });
            }
            var token = req.headers.authorization.split(' ')[1];
            var payload = jwt.decode(token, config.TOKEN_SECRET);
            model.User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }
              user.google = profile.sub;
              user.displayName = user.displayName || profile.name;
              user.save(function() {
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          model.User.findOne({ google: profile.sub }, function(err, existingUser) {
            if (existingUser) {
              return res.send({ token: authenticationUtils.createToken(existingUser) });
            }

             


            var user = new User();
            user.google = profile.sub;
            user.displayName = profile.name;
            user.save(function(err) {
              var token = authenticationUtils.createToken(user);
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
          model.User.findOne({ github: profile.id }, function(err, existingUser) {
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
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          model.User.findOne({ github: profile.id }, function(err, existingUser) {
            if (existingUser) {
              var token = authenticationUtils.createToken(existingUser);
              return res.send({ token: token });
            }
            var user = new User();
            user.github = profile.id;
            user.displayName = profile.name;
            user.save(function() {
              var token = authenticationUtils.createToken(user);
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
          model.User.findOne({ linkedin: profile.id }, function(err, existingUser) {
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
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          model.User.findOne({ linkedin: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.send({ token: authenticationUtils.createToken(existingUser) });
            }
            var user = new User();
            user.linkedin = profile.id;
            user.displayName = profile.firstName + ' ' + profile.lastName;
            user.save(function() {
              var token = authenticationUtils.createToken(user);
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
              return res.send({ token: authenticationUtils.createToken(user) });
            }
            var newUser = new User();
            newUser.live = profile.id;
            newUser.displayName = profile.name;
            newUser.save(function() {
              var token = authenticationUtils.createToken(newUser);
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
                var token = authenticationUtils.createToken(existingUser);
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
            model.User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }
              user.facebook = profile.id;
              user.displayName = user.displayName || profile.name;
              user.save(function() {
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ facebook: profile.id }, function(err, existingUser) {
            if (existingUser) {
              var token = authenticationUtils.createToken(existingUser);
              return res.send({ token: token });
            }
            var user = new User();
            user.facebook = profile.id;
            user.displayName = profile.name;
            user.save(function() {
              var token = authenticationUtils.createToken(user);
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
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ yahoo: body.profile.guid }, function(err, existingUser) {
            if (existingUser) {
              return res.send({ token: authenticationUtils.createToken(existingUser) });
            }
            var user = new User();
            user.yahoo = body.profile.guid;
            user.displayName = body.profile.nickname;
            user.save(function() {
              var token = authenticationUtils.createToken(user);
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

          model.User.find({ where: {twitter: profile.user_id} }).then(function(existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a Twitter account that belongs to you' });
            }
            var token = req.headers.authorization.split(' ')[1];
            var payload = jwt.decode(token, config.TOKEN_SECRET);
            console.log(profile)          

            model.User.find({ where: {id: payload.sub} }).then(function(user){
              if (!user) {
                return res.status(400).send({ message: 'Something went wrong in the linkage process' });
              }
              user.twitter = profile.user_id;
              // keep one of the two usernames 
              user.displayName = user.displayName || profile.screen_name;
              user.save().success(function() { 
                res.send({ token: authenticationUtils.createToken(user) });
              }).error(function(error) {
                // update fail ... :O
              })
            });
          });
        } else {
              console.log("step 4b")
          // Step 4b. Create a new user account or return an existing one.
          // 
          model.User.find({ where: {twitter: profile.user_id} }).then(function(existingUser) {
            if (existingUser) {
              var token = authenticationUtils.createToken(existingUser);
              return res.send({ token: token });
            }
            console.log(profile)
            model.User.create({
              twitter: profile.user_id,
              displayName: profile.screen_name
            }).success(function(user) {
              res.send({ token: authenticationUtils.createToken(user) });
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
                var token = authenticationUtils.createToken(user);
                res.send({ token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ foursquare: profile.id }, function(err, existingUser) {
            if (existingUser) {
              var token = authenticationUtils.createToken(existingUser);
              return res.send({ token: token });
            }
            var user = new User();
            user.foursquare = profile.id;
            user.displayName = profile.firstName + ' ' + profile.lastName;
            user.save(function() {
              var token = authenticationUtils.createToken(user);
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

  app.get('/auth/unlink/:provider', authenticationUtils.ensureAuthenticated, function(req, res) {
    var provider = req.params.provider;

    model.User.find({ where: {id: req.user} }).then(function(user) {
      if (!user) {
        return res.status(400).send({ message: 'User not found' });
      }
      user[provider] = undefined;
      user.save(function() {
        res.status(200).end();
      });
    });
  });

}