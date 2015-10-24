'use strict';

var jwt       = require('jwt-simple');
var moment    = require('moment');

var model     = rootRequire('models/model');
var config    = rootRequire('config/config');

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
  req.scopes = payload.scopes;
  next();
}

exports.ensureAuthenticated = ensureAuthenticated;

/*
 |--------------------------------------------------------------------------
 | Admin Middleware
 |--------------------------------------------------------------------------
 */
function ensureAdmin(req, res, next) {
  model.User.find({ where: model.Sequelize.and({id: req.user },{isAdmin: true}) }).then(function(user) {
    if(!user){
      return res.status(401).send({ message: 'You need to be an admin to access this endpoint' });
    }else{
      next();
    }
  })
}

exports.ensureAdmin = ensureAdmin;

/**
 * Check user has the required scopes
 */
function checkScopes(requiredScopes) {
  return function(req, res, next) {
    var authorized = true;
    if (req.scopes) {
      for (var j=0; j<requiredScopes.length && authorized; j++){
        if (req.scopes.indexOf(requiredScopes[j]) === -1) {
          authorized = false;
        }
      }
    }
    if (authorized) {
      return next();
    }
    console.log(req.scopes);
    return res.status(401).send({
      message: 'You don\'t have access to the requested resource'
    });
  }
}

exports.checkScopes = checkScopes;

/*
 |--------------------------------------------------------------------------
 | Generate JSON Web Token
 |--------------------------------------------------------------------------
 */
function createToken(user) {
  var payload = {
    sub: user.id,
    iat: moment().unix(),
    exp: moment().add(14, 'days').unix(),
    scopes: ['user']
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}

exports.createToken = createToken;

function createEarlyToken(user) {
  var payload = {
    sub: user.id,
    iat: moment().unix(),
    exp: moment().add(14, 'days').unix(),
    scopes: ['early-user']
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}

exports.createEarlyToken = createEarlyToken;