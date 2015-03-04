'use strict';

var config = rootRequire('config/config');

var crypto = require("crypto");
var fs = require("fs");
var gcloud = require('gcloud')({
    keyFilename: config.GOOGLE_DEVELOPER_KEY_PATH,
    projectId: config.GOOGLE_PROJECT_NAME
});

var credentials = require(config.GOOGLE_DEVELOPER_KEY_PATH);
var bucket = gcloud.storage().bucket(config.BUCKET_NAME);
var googlePrivateKey = credentials.private_key;
var googleAccessEmail = credentials.client_email;

/**
 * Returns the https url of the bucket
 **/
function getBucketUrl() {
    return "https://" + config.BUCKET_NAME + ".storage.googleapis.com";
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
            action = 'read';
            break;
    }
    var file = bucket.file(key);
    options.expires = Math.round(Date.now() / 1000) + timeToLive;
    file.getSignedUrl(options, callback);
}

exports.createSignedUrl = createSignedUrl;


/**
 * Creates a policy and its signature
 * TODO handle contentType
 **/
function createSignedPolicy(key, expiration, maxByteSize, contentType) {
    var policy = {
        expiration: expiration.toISOString(),
        conditions: [
            ["eq", "$key", key],
            ["content-length-range", 0, maxByteSize], {
                "bucket": config.BUCKET_NAME
            }
        ]
    };

    var policyString = JSON.stringify(policy);
    console.log(policyString);
    var policyBase64 = new Buffer(policyString).toString('base64');
    console.log(policyBase64);
    var sign = crypto.createSign('RSA-SHA256');
    sign.update(policyBase64);
    var signature = sign.sign(googlePrivateKey, 'base64');
    console.log(signature);

    return {
        policy: policyBase64,
        signature: signature
    };
}

exports.createSignedPolicy = createSignedPolicy;

/**
 * Uploads a file to Cloud Storage0
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
    bucket.upload(filepath, {
        destination: filename
    }, function(err) {
        callback(err, filename);
    });
}

exports.upload = upload;

/**
 * Removes a file from cloud storage
 */
function move(filename, newFilename, callback) {
    if (filename) {
        bucket.file(filename).copy(newFilename, function(err, newFile) {
            if (err) {
                callback(err)
            } else {
                file.delete(callback);
            } 
        });
    } else {
        callback(new Error("Filename not specified"))
    }
}

exports.remove = remove;

/**
 * Removes a file from cloud storage
 */
function remove(filename, callback) {
    if (filename)
        bucket.file(filename).delete(callback);
    else 
        callback(new Error("Filename not specified"))
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
