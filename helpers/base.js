'use strict';

var path = require('path');
var fs = require('fs-extra');
var im = require('imagemagick');

var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var config = rootRequire('config/config');

var uploadFolder = path.resolve(__dirname + '/../uploadFolder');

exports.uploadFolder = uploadFolder;

/**
 * Appends a timestamp to a filename
 **/
function timestampName(filename) {
  // Get timestamp
  if (!Date.now) Date.now = function() {
    return new Date().getTime()
  };
  var extension = filename.split('.').slice(0).pop();
  filename = filename.replace(extension, '').replace(/\W+/g, '') + '_' + Date.now() + '.' + extension;
  return filename;
}

exports.timestampName = timestampName;

/**
 * Returns a name for the resized image
 **/
function resizedName(filename, width, height) {
  var extension = filename.split('.').slice(0).pop();
  return filename.replace(extension, '').replace(/\W+/g, '') +
    '_resized_' + width + '-' + height + '.' + extension;
}

exports.resizedName = resizedName;

function nameFromPath(path) {
  return path.replace(/\W+/g, '');
}

exports.nameFromPath = nameFromPath;

function localTmpPath(path) {
  return uploadFolder + '/img/' + nameFromPath(path);
}

exports.localTmpPath = localTmpPath;

/**
 * Returns a path for the resized image
 **/
function resizedPath(filename, width, height) {
  var extension = filename.split('.').slice(0).pop();
  return filename.replace('.' + extension, '') +
    '_resized_' + width + '-' + height + '.' + extension;
}

exports.resizedPath = resizedPath;

/**
 * Returns a possibile location for an image named <filename>
 * on the staging server
 **/
function localImagePath(req, filename) {
  return uploadFolder + '/img/' + req.user + '_' + filename;
}

exports.localImagePath = localImagePath;

/**
 * Returns a possibile location for an image named <filename>
 * on the CDN
 * TODO avoid using req
 **/
function remoteImagePath(req, filename) {
  return 'img/' + req.user + '/' + filename;
}

exports.remoteImagePath = remoteImagePath;

/**
 * Generator of upload functions
 * localPathBuilder: given a filename returns local file path
 * remotePathBuilder: given a filename return CDN file path
 * retuns: an upload function parameterized on localPathBuilder and cloudPathBuilder
 **/
function uploadFunction(localPathBuilder, remotePathBuilder) {
  return function upload(req, res, next) {

    var arr;
    var fstream;
    var fileSize = 0;
    req.pipe(req.busboy);

    req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {

      // File data received
      file.on('data', function(data) {});

      // End of file
      file.on('end', function() {});

      // Get actual file name and both local and remote paths
      var originalfilename = filename.split('.')[0];
      var extension = filename.split('.').slice(0).pop();
      filename = timestampName(filename);
      var localPath = localPathBuilder(req, filename);
      var remotePath = remotePathBuilder(req, filename);

      //populate array
      //I am collecting file info in data read about the file. It may be more correct to read 
      //file data after the file has been saved to img folder i.e. after file.pipe(stream) completes
      //the file size can be got using stats.size as shown below
      arr = [{
        originalfilename: originalfilename,
        extension: extension,
        filesize: fileSize,
        fieldname: fieldname,
        filename: filename,
        encoding: encoding,
        MIMEtype: mimetype
      }];
      //save files in the form of userID + timestamp + filenameSanitized
      //Path where image will be uploaded
      fstream = fs.createWriteStream(localPath);
      file.pipe(fstream);

      // When upload finished we save file information
      req.on('end', function() {
        req.uploadedFile = arr;
      });

      // When file has been written to disk we collect statistics
      // and upload it to cloud storage
      fstream.on('finish', function() {

        // CDN upload
        cloudstorage.upload(remotePath, localPath,
          function(err, key) {
            // There was an error uploading the file
            if (err) {
              err.message = 'Failed uploading file';
              return next(err);
            }
            //Get file stats (including size) for file and continue
            fs.stat(localPath, function(err, stats) {
              if (err || !stats.isFile()) {
                err.message = 'Failed uploading file';
                return next(err);
              }
              req.uploadedFile[0].filesize = stats.size;
              next();
            }); /* Stat callback */
          }); /* CDN upload callback */
      }); /* File stream finish callback */

      // We failed writing to disk
      fstream.on('error', function(err) {
        err.message = 'Failed uploading file';
        return next(err);
      });
    }); // @END/ .req.busboy
  } /* Upload function */
} /* Upload function builder */

exports.uploadFunction = uploadFunction;

/**
 * Generator of resize functions
 * localPathBuilder: given a filename returns local file path
 * remotePathBuilder: given a filename return CDN file path
 * retuns: a resize function parameterized on localPathBuilder and cloudPathBuilder
 **/
function resizeFunction(localPathBuilder, remotePathBuilder) {
  return function(req, res, next) {
    var resizedFilename, filename = req.uploadedFile[0].filename
    var width = req.params.width
    var height = req.params.height
    if (!width) width = height
    if (!height) height = width
    if (width && height) { //only if both exists 
      resizedFilename = resizedName(filename, width, height);
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
          err.message = 'Failed resizing file';
          return next(err);
        }
        // CDN upload
        cloudstorage.upload(remotePathBuilder(req, resizedFilename),
          localPathBuilder(req, resizedFilename),
          function(err, key) {
            if (err) {
              err.message = 'Failed uploading file';
              return next(err);
            }
            req.uploadedFile[0].resizedFilename = resizedFilename;
            next();
          }); /* CDN upload callback */
      }); /* Image resize callback */
    } /* If sizes are defined */
  } /* Resize function */
} /* Resize function builder*/

exports.resizeFunction = resizeFunction;

/**
 * Resize a source image to the width and height specified and save it to the
 * dest path
 */
function resize(source, dest, width, height, callback) {
  im.crop({
    srcPath: source,
    dstPath: dest,
    width: width,
    height: height,
    quality: 1,
    gravity: 'Center'
  }, callback);
}

exports.resize = resize;

/**
 * Resize a source image in the CDN to the width and height specified and save
 * it again in CDN
 */
function resizeInCDN(source, dest, width, height, callback) {

  var localTempPath = localTmpPath(source);
  var resizedLocalTempPath = localTmpPath(dest);
  var cdnStream = cloudstorage.createReadStream(source);
  var localStream = fs.createWriteStream(localTempPath);

  cdnStream.pipe(localStream).on('error', function(err) {
    return callback(err);
  }).on('finish', function() {
    resize(localTempPath, resizedLocalTempPath, width, height,
      function(err) {
        if (err) {
          return callback(err);
        }
        // CDN upload
        cloudstorage.upload(dest, resizedLocalTempPath,
          function(err, key) {
            fs.unlink(localTempPath);
            fs.unlink(resizedLocalTempPath);
            // There was an error uploading the file
            if (err) {
              return callback(err);
            }
            return callback(null);
          });
      });
  });
}

exports.resizeInCDN = resizeInCDN;
