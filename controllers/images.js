'use strict';

var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');

function createImageFactory(fieldName, helper) {
  return function(req, res, next) {

    var fieldNameCapital =
      fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    var filename = req.body.filename;
    var extension = filename.split('.').slice(0).pop();
    if (extension) {
      extension = extension.toLowerCase();
    }
    if (extension !== 'png' && extension !== 'jpg' && extension !== 'jpeg') {
      var err = new Error();
      err.status = 500;
      err.message = 'Image must be in PNG or JPEG format';
      return next(err);
    }

    var newFieldName = 'new' + fieldNameCapital;

    helper.requestEntity(req, function(err, promise) {
      if (err) {
        return next(err);
      }
      promise.then(function(entity) {
        if (!entity) {
          var err = new Error();
          err.status = 404;
          err.message = 'Entity not found';
          return next(err);
        }
        if (entity[newFieldName]) {
          cloudstorage.remove(entity[newFieldName]);
        }
        var newFieldPath = helper.remoteImagePath(req, extension);
        entity[newFieldName] = newFieldPath;
        entity.save();
        cloudstorage.getSignedPolicy(newFieldPath, {
            expires: Date.now() + 60 * 1000,
            startsWith: ['$key', newFieldPath],
            contentLengthRange: {
              min: 0,
              max: 2097152 // 2MB
            }
          },
          function(err, body) {
            console.log(body);
            res.json(body);
          });
      });
    });
  };
}

exports.createImageFactory = createImageFactory;

function confirmImageFactory(fieldName, sizes, helper) {
  return function(req, res, next) {

    var fieldNameCapital =
      fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    var newFieldName = 'new' + fieldNameCapital;

    helper.requestEntity(req, function(err, promise) {
      if (err) {
        return next(err);
      }
      promise.then(function(entity) {
        if (!entity) {
          var err = new Error();
          err.status = 404;
          err.message = 'Entity not found';
          return next(err);
        }
        if (entity[newFieldName]) {
          var oldFieldPath = entity[fieldName];
          entity[fieldName] = entity[newFieldName];
          entity[newFieldName] = null;
          cloudstorage.remove(oldFieldPath);
          for (var i = 0; i < sizes.length; i++) {
            var sizeFieldName = sizes[i] + fieldNameCapital;
            if (entity[sizeFieldName]) {
              cloudstorage.remove(entity[sizeFieldName]);
              entity[sizeFieldName] = null;
            }
          }
          entity.save().then(function(entity) {
            if (!entity) {
              var err = new Error();
              err.status = 500;
              err.message = 'Failed saving entity';
              return next(err);
            }
            res.send(entity);
          });
        } else {
          var err = new Error();
          err.status = 500;
          err.message = 'No new image to confirm';
          return next(err);
        }
      });
    });
  };
}

exports.confirmImageFactory = confirmImageFactory;

function getImageFactory(fieldName, helper) {
  return function(req, res, next) {

    var fieldNameCapital =
      fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    var newFieldName = 'new' + fieldNameCapital;
    var size = req.params.size;

    helper.requestEntity(req, function(err, promise) {
      if (err) {
        return next(err);
      }
      promise.then(function(entity) {
        if (!entity) {
          var err = new Error();
          err.status = 404;
          err.message = 'Entity not found';
          return next(err);
        }
        var requestedField = size + fieldNameCapital;
        var requestedSize = helper.imageSize(size);
        if (entity[requestedField]) {
          cloudstorage.createSignedUrl(entity[requestedField], "GET", 50,
            function(err, url) {
              if (err) {
                //throw err;
                err.status = 404;
                err.message = "Image not found";
                return next(err);
              }
              res.redirect(url);
            }); /* Cloud storage signed url callback*/
        } else {
          // Should never happen
          if (!entity[fieldName]) {
            var err = new Error();
            err.status = 404;
            err.message = "Image not found";
            return next(err);
          }
          var resizedRemotePath =
            helper.resizedPath(
              entity[fieldName],
              requestedSize.width,
              requestedSize.height);
          helper.resizeInCDN(
            entity[fieldName],
            resizedRemotePath,
            requestedSize.width,
            requestedSize.height,
            function(err) {
              if (err) {
                err.status = 500;
                err.message = 'Failed resizing image';
                return next(err);
              }
              entity[requestedField] = resizedRemotePath;
              entity.save().then(function(entity) {
                if (!entity) {
                  err.status = 500;
                  err.message = 'Failed saving entity';
                  return next(err);
                }
                cloudstorage.createSignedUrl(resizedRemotePath, "GET", 50,
                  function(err, url) {
                    if (err) {
                      //throw err;
                      err.status = 404;
                      err.message = "Entity not found";
                      return next(err);
                    }
                    res.redirect(url);
                  }); /* Cloud storage signed url callback*/
              });
            });
        }
      });
    });
  };
}

exports.getImageFactory = getImageFactory;
