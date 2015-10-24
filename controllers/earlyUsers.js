'use strict';

var uuid = require('node-uuid');

var bcrypt = require('bcrypt');
var model = rootRequire('models/model');
var config = rootRequire('config/config');
var authenticationUtils = rootRequire('utils/authentication-utils');
var mailer = rootRequire('libs/mailer/sendgrid');

module.exports.controller = function(app) {

  /**
   * Send a verification email to the specified address with the specified
   * verification code
   */
  function sendVerificationEmail(email, verificationCode, referredBy, callback) {
    callback = callback || function(error, json) {
      console.log(email);
      console.log(err);
    };
    var message = 'Your verification code is ' + verificationCode;
    if (referredBy) {
      message = 'You have been referred by ' + referredBy.email + '\n' + message;
    } 
    mailer.sendEmail({
        to: email,
        from: 'noreply@tracklist.me',
        subject: 'Verify your email address',
        text: message
    });
  }


  /**
   * Adds an EarlyUser waiting for verification. If user is successfully
   * added res is sent, otherwise and error is returned
   */
  function addEarlyUser(email, verificationCode, referredBy, res, next) {
    var referredById = referredBy ? referredBy.id : null;
    var status = model.EarlyUserStatus.UNVERIFIED;
    if (referredBy) {
      var status =
        referredBy.status === model.EarlyUserStatus.VERIFIED ? 
          model.EarlyUserStatus.UNVERIFIED_FRIEND :
          model.EarlyUserStatus.NOT_INVITED_FRIEND;
    }
    model.EarlyUser.create({
      email: email,
      verificationCode: verificationCode,
      referredBy: referredById,
      status: status
    }).then(function(earlyUser) {
      if (status === model.EarlyUserStatus.UNVERIFIED_FRIEND ||
        status === model.EarlyUserStatus.UNVERIFIED) {
        // TODO send email to user with verification code
        sendVerificationEmail(email, verificationCode, referredBy);
      }
      res.send({
        id: earlyUser.id,
        email: earlyUser.email,
        status: earlyUser.status,
        isArtist: earlyUser.isArtist,
        isLabel: earlyUser.isLabel,
        referredBy: earlyUser.referredBy,
        referredCount: earlyUser.referredCount
      });
    }).catch(function(err) {
      err.status = 500;
      err.message = "Failed adding early user";
      return next(err);
    });
  }

  /**
   * If a user for the provided id exists its referredCount counter is
   * incremented.
   */
  function incrementReferredCount(earlyUserId) {
    if (earlyUserId) {
      model.EarlyUser.find({
        id: earlyUserId
      }).then(function(referringUser) {
        referringUser.referredCount = referringUser.referredCount + 1;
        referringUser.save();
      });
    }
  }

  /**
   * If a user invited friends while he was not verified once he verifies
   * his email address we can send out all invitations
   */
  function inviteAllFriends(earlyUser) {
    model.EarlyUser.findAll({
      where: {
        referredBy: earlyUser.id
      }
    }).then(function(friends) {
      if (friends) {
        for (var i=0; i<friends.length; i++){
          sendVerificationEmail(friends[i].email, friends[i].verificationCode, earlyUser);
          friends[i].status = model.EarlyUserStatus.UNVERIFIED_FRIEND;
          friends[i].save();
        }
      }
    });
  }

  /**
   * POST /earlyUsers
   * Add email for an early user
   */
  app.post('/earlyUsers', function(req, res, next) {

    req.checkBody('email', 'Invalid early user email').notEmpty().isEmail();
    req.checkBody('referredBy', 'Invalid reference id').optional().isInt();
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }

    var email = req.body.email;
    var referredBy = req.body.referredBy;
    model.EarlyUser.find({
      where: {
        email: email
      }
    }).then(function(existingEarlyUser) {
      if (existingEarlyUser) {
        return res.status(409).send({
          message: 'Email is already in use'
        });
      }
      var verificationCode = uuid.v4();
      if (referredBy) {
        model.EarlyUser.find({
          where: {
            id: referredBy
          }
        }).then(function(referringUser) {
          addEarlyUser(email, verificationCode, referringUser, res, next);
        });
      } else {
        addEarlyUser(email, verificationCode, null, res, next);
      }
    });
  });

  /**
   * POST /earlyUsers/:email/requestVerificationEmail
   * Request a new verification email
   */
  app.post('/earlyUsers/:email/requestVerificationEmail', function(req, res, next) {

    req.checkParams('email', 'Invalid early user email').notEmpty().isEmail();
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }

    var email = req.params.email;
    model.EarlyUser.find({
      where: {
        email: email,
        status: model.EarlyUserStatus.UNVERIFIED
      }
    }).then(function(earlyUser) {
      if (earlyUser) {
        var verificationCode = uuid.v4();
        earlyUser.verificationCode = verificationCode;
        earlyUser.save(function() {
          // TODO re-send verification email
          // TODO should update the code?
          return res.send(verificationCode); //TODO remove          
        }).catch(function(err) {
          err.status = 500;
          err.message = "Failed adding early user";
          return next(err);
        });
      } else {
        var err = {
          status: 404,
          message: 'No early user to verify'
        };
        console.log('No early user to verify');
        return next(err);
      }
    });
  });

  /**
   * PUT /earlyUsers/:id/verify/:verificationCode
   * Verify a user and save user data
   */
  app.put('/earlyUsers/:id/verify', function(req, res, next) {
    req.checkParams('id', 'Invalid early user id').notEmpty().isInt();
    req.checkBody('verificationCode', 'Invalid early user verification code').notEmpty().isUUID(4);
    req.checkBody('isLabel', 'Invalid isLabel field').optional().isBoolean();
    req.checkBody('isArtist', 'Invalid isArtist field').optional().isBoolean();
    req.checkBody('password', 'Missing password').notEmpty();
    req.checkBody('password', 'Passoword must be at least 6 characters').isLength(6);
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }

    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }
    var id = req.params.id;
    var submittedVerificationCode = req.body.verificationCode;
    var password = req.body.password;
    var isArtist = req.body.isArtist || false;
    var isLabel = req.body.isLabel || false;
    model.EarlyUser.find({
      where: {
        id: id,
        verificationCode: submittedVerificationCode,
      }
    }).then(function(earlyUser) {
      if (earlyUser) {
        if (earlyUser.status === model.EarlyUserStatus.UNVERIFIED ||
          earlyUser.status === model.EarlyUserStatus.UNVERIFIED_FRIEND) {
          bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(password, salt, function(err, passwordHash) {
              if (err) {
                err.status = 500;
                err.message = "Failed saving early user data";
                return next(err);
              }
              earlyUser.isArtist = isArtist;
              earlyUser.isLabel = isLabel;
              earlyUser.status = model.EarlyUserStatus.VERIFIED;
              earlyUser.password = passwordHash;
              earlyUser.save().then(function() {
                incrementReferredCount(earlyUser.referredBy);
                inviteAllFriends(earlyUser);
                res.send();
              }).catch(function(err) {
                err.status = 500;
                err.message = "Failed saving early user data";
                return next(err);
              });
            });
          });
        } else {
          var err = {
            status: 409,
            message: 'User already verified'
          };
          return next(err);
        }
      } else {
        var err = {
          status: 404,
          message: 'early user not found'
        };
        return next(err);
      }
    });
  });

  /**
   * POST /earlyUsers/login
   * Early user login with email and password, returns an authentication token
   */
  app.post('/earlyUsers/login', function(req, res, next) {

    req.checkParams('email', 'Invalid early user email').notEmpty().isEmail();
    req.checkBody('password', 'Missing password').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }
    model.EarlyUser.find({
      where: {
        email: req.body.email,
        status: model.EarlyUserStatus.VERIFIED
      }
    }).then(function(user) {
      if (!user) {
        var err = {
          status: 401,
          message: 'Wrong email and/or password'
        };
        return next(err);
      }
      bcrypt.compare(req.body.password, user.password, function(err, result) {
        if (err || result == false) {
          var err = {
            status: 401,
            message: 'Wrong email and/or password'
          };
          return next(err); 
        }
        return res.send({
          token: authenticationUtils.createEarlyToken(user)
        });
      });
    });
  });

  /**
   * POST /earlyUsers/:id/inviteFriend/:friendEmail
   * Invite a friend as a non-authenticated user
   */
  app.post('/earlyUsers/:id/inviteFriend/:friendEmail', function(req, res, next) {

    req.checkParams('id', 'Invalid early user id').notEmpty().isInt();
    req.checkParams('friendEmail', 'Invalid early user email').notEmpty().isEmail();
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }
    var friendEmail = req.params.friendEmail;
    var userId = req.params.id;
    model.EarlyUser.find({
      where: {
        email: friendEmail
      }
    }).then(function(existingEarlyUser) {
      if (existingEarlyUser) {
        return res.status(409).send({
          message: 'Email is already in use'
        });
      }
      var verificationCode = uuid.v4();
      model.EarlyUser.find({
        where: {
          id: userId
        }
      }).then(function(referringUser) {
        if (referringUser) {
          addEarlyUser(friendEmail, verificationCode, referringUser, res, next);
        } else {
          return res.status(404).send({
            message: 'Referring user not found'
          });         
        }
      });
    });
  });

  /**
   * GET /earlyUsers/
   * Get Early User information and his position in the waiting list
   */
  app.get('/earlyUsers/', authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['early-user']), function(req, res, next) {

    model.EarlyUser.find({
      attributes: ['email', 'isArtist', 'isLabel', 'referredBy', 'referredCount', 'status'],
      where: {
        id: req.user,
      }
    }).then(function(user) {
      return res.send(user);
    });
  });

  /**
   * POST /earlyUsers/
   * Invite a friend as an authenticated user
   */
  app.post('/earlyUsers/inviteFriend/:friendEmail', authenticationUtils.ensureAuthenticated,
    authenticationUtils.checkScopes(['early-user']), function(req, res, next) {

    req.checkParams('friendEmail', 'Invalid early user email').notEmpty().isEmail();
    var errors = req.validationErrors();
    if (errors) {
      var err = new Error();
      err.status = 400;
      err.message = 'There have been validation errors';
      err.validation = errors;
      return next(err);
    }
    var friendEmail = req.params.friendEmail;
    var userId = req.user;
    model.EarlyUser.find({
      where: {
        email: friendEmail
      }
    }).then(function(existingEarlyUser) {
      if (existingEarlyUser) {
        return res.status(409).send({
          message: 'Email is already in use'
        });
      }
      var verificationCode = uuid.v4();
      model.EarlyUser.find({
        where: {
          id: userId
        }
      }).then(function(referringUser) {
        addEarlyUser(friendEmail, verificationCode, referringUser, res, next);
      });
    });
  });
}
