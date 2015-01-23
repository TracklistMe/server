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

exports.createToken = createToken;