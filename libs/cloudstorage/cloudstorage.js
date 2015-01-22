'use strict';

var config            = rootRequire('config/config');

var crypto            = require("crypto");
var fs                = require("fs");
var gcloud            = require('gcloud')({
                          keyFilename: config.GOOGLE_DEVELOPER_KEY_PATH,
                          projectId: config.GOOGLE_PROJECT_NAME
                        });

var bucket = gcloud.storage().bucket(config.BUCKET_NAME);

/**
 * Function to create signed urls to google cloud storage
 * key: key of the object that we want to read (GET), write (PUT) or delete (DELETE)
 * method: HTTP method supported by the signed url (GET, PUT, DELETE)
 * timeToLive: is the time the signed url will last after being generated (in seconds)
 * callback: error first callback to handle the signed url
 */
function createSignedUrl(key, method, timeToLive, callback) {
  if (!key) {
    var err = new Error
    err.status = 404
    err.message = "File not found"
    callback(err);
    return;
  }
  var action;
  switch (method) {
    case 'GET':
      action = 'read';    
      break;
    case 'PUT':
      action = 'write';
      break;
    case 'DELETE':
      action = 'delete';
      break;
    default: 
      action = 'read';    
      break;
  }
  var file = bucket.file(key);
  file.getSignedUrl({
    action: action,
    expires: Math.round(Date.now() / 1000) + timeToLive
  }, callback);
}

exports.createSignedUrl = createSignedUrl;

/**
 * Uploads a file to Cloud Storage
 */
function upload(filename, filepath, callback) {
/*
  // Long way to upload a file  
  var file = bucket.file(filename);
  var error = false;
  var readStream = fs.createReadStream(filepath);
  readStream.on('open', function() {
      var writeStream = file.createWriteStream();
      writeStream.on('error', function(err) {
          error = true;
      });
      writeStream.on('close', function() {
        console.log("Closing write stream");
        if (!error) callback(null, filename);
        else callback("Error uploading file", filename);
      });

    });
  readStream.on('error', function(err) {
      callback("Error reading file", filename);
  });
*/
  // Short way to upload a file
  bucket.upload(filepath, {destination: filename}, function(err) {
    callback(err, filename);
  });
}

exports.upload = upload;

/**
 * Removes a file from cloud storage
 */
function remove(filename, callback) {
  if (filename)
    bucket.file(filename).delete(callback);
}

exports.remove = remove;
