'use strict';

var config = rootRequire('config/config');

var gcloud = require('gcloud')({
  keyFilename: config.GOOGLE_DEVELOPER_KEY_PATH,
  projectId: config.GOOGLE_PROJECT_NAME
});

var credentials = require(config.GOOGLE_DEVELOPER_KEY_PATH);
var bucket = gcloud.storage().bucket(config.BUCKET_NAME);

var googleAccessEmail = credentials.client_email;

/**
 * Returns the https url of the bucket
 **/
function getBucketUrl() {
  return 'https://' + config.BUCKET_NAME + '.storage.googleapis.com';
}

exports.getBucketUrl = getBucketUrl;

/**
 * Returns the https url of the bucket
 **/
function getGoogleAccessEmail() {
  return googleAccessEmail;
}

exports.getGoogleAccessEmail = getGoogleAccessEmail;

/**
 * Function to create signed urls to google cloud storage
 * key: key of the object that we want to read (GET), write (PUT) or delete
 * (DELETE) method: HTTP method supported by the signed url (GET, PUT, DELETE)
 * timeToLive: is the time the signed url will last after being generated
 * (in seconds) callback: error first callback to handle the signed url
 */
function createSignedUrl(key, method, timeToLive, callback) {
  if (!key) {
    var err = new Error();
    err.status = 404;
    err.message = 'File not found';
    callback(err);
    return;
  }
  var options = {};
  switch (method) {
    case 'GET':
      options.action = 'read';
      break;
    case 'PUT':
      options.action = 'write';
      options.contentType = 'application/json;charset=utf-8';
      break;
    case 'DELETE':
      options.action = 'delete';
      break;
    default:
      options.action = 'read';
      break;
  }

  var file = bucket.file(key);
  options.expires = Math.round(Date.now() / 1000) + timeToLive;
  options.https = true;
  file.getSignedUrl(options, callback);

}

exports.createSignedUrl = createSignedUrl;

function getSignedPolicy(key, options, callback) {
  bucket.file(key).getSignedPolicy(options, function(err, policy) {
    callback(err, {
      Expires: new Date(options.expiration).toISOString(),
      action: getBucketUrl(),
      method: 'POST',
      key: key,
      GoogleAccessId: getGoogleAccessEmail(),
      policy: policy.base64,
      signature: policy.signature
    });
  });
}

exports.getSignedPolicy = getSignedPolicy;

/**
 * Uploads a file to Cloud Storage
 */
function upload(filename, filepath, callback) {
  bucket.upload(filepath, {
    destination: filename
  }, function(err) {
    callback(err, filename);
  });
}

exports.upload = upload;

/**
 * Moves a file to a new localtion in cloud storage
 */
function move(filename, newFilename, callback) {
  if (filename) {
    var file = bucket.file(filename);
    file.copy(newFilename, function(err) {
      if (err) {
        callback(err);
      } else {
        file.delete(callback);
      }
    });
  } else {
    callback(new Error('Filename not specified'));
  }
}

exports.move = move;

/**
 * Copies a file from cloud storage
 */
function copy(filename, newFilename, callback) {
  if (filename) {
    bucket.file(filename).copy(newFilename, function(err) {
      callback(err);
    });
  } else {
    callback(new Error('Filename not specified'));
  }
}

exports.copy = copy;


/**
 * Removes a file from cloud storage
 */
function remove(filename, callback) {
  if (!callback) {
    callback = function() {};
  }
  if (filename) {
    bucket.file(filename).delete(callback);
  } else {
    callback(new Error('Filename not specified'));
  }
}

exports.remove = remove;

/**
 * Create a read stream for a file corresponding to filename
 **/
function createReadStream(filename) {
  var file = bucket.file(filename);
  return file.createReadStream();
}

exports.createReadStream = createReadStream;

/**
 * Create a read stream for a file corresponding to filename
 **/
function createReadStream(filename) {
  var file = bucket.file(filename);
  return file.createReadStream();
}

exports.createReadStream = createReadStream;
