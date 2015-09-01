'use strict';

var Q = require('q');
var xml2js = require('xml2js');
var fs = require('fs');

var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var helper = rootRequire('helpers/labels');

var CORRECT = 'correct';
var FAIL = 'fail';

var wrapFunction = function(fn, context, params) {
  return function() {
    return fn.apply(context, params);
  };
};

/**
 * Accept an array of object with parameters path that point to the file .xml
 * check if the files pointed by the xml are available
 */
function validate(xmlArrayList) {

  var deferred = Q.defer();
  var processResults = {
    success: [],
    fail: []
  };
  var promises = [];

  for (var i = 0; i < xmlArrayList.length; i++) {
    console.log(xmlArrayList[i].path);
    promises.push(validateFile(xmlArrayList[i].path));
  } // close the for loop 
  Q.allSettled(promises)
    .then(function(results) {
      results.forEach(function(result) {
        if (result.value.status === CORRECT) {
          processResults.success.push(result.value);
        } else {
          processResults.fail.push(result.value);
        }
      });
      deferred.resolve(processResults);
    });
  return deferred.promise;
}

exports.validate = validate;

/**
 * Accept an array of object with parameters path that point to the file .xml
 * assumed a validate was run before! 
 */
function process(xmlArrayList, idLabel) {
  var deferred = Q.defer();
  var promises = [];
  console.log('START PROCESSING');
  for (var i = 0; i < xmlArrayList.length; i++) {
    promises.push(packRelease(xmlArrayList[i].path, idLabel));
  }

  // Joint of all the promises 
  Q.allSettled(promises)
    .then(function(results) {
      results.forEach(function(result) {
        console.log(' -----------------  Release Processed  ------------');
        console.log('RELEASE');
        console.log(result);

        /*
        controllerRelease.
          consolideJSON(result.value.dataValues.id).then(function(){
            console.log('JSON --- SALVATO')
          })
        */
      });

      deferred.resolve(results);
    });
  return deferred.promise;

}

exports.process = process;

function validateFile(xmlPath) {
  var deferred = Q.defer();
  var temporaryFilename = 'temporaryFileName-' + Date.now();
  var xmlCloudStream = cloudstorage.createReadStream(xmlPath);
  var xmlTempStream = fs.createWriteStream(temporaryFilename);

  xmlCloudStream.pipe(xmlTempStream).on('error', function(err) {
    console.log('ERROR' + err);
    deferred.reject(err);
  }).on('finish', function() {
    /* alternative asyncronous version 
    var stream = fs.createReadStream(filename);
    var xml = new xmlStream(stream);
    xml.on('end', function(item) {
        console.log('ENDED' + xml);
        console.log(xml)
    })
    */

    fs.readFile(temporaryFilename, 'utf8', function(err, data) {
      if (err) {
        deferred.reject(err);
        return;
      }

      try {
        var parser = new xml2js.Parser();
        parser.parseString(data, function(err, result) {
          // totalFileExpected = all the tracks + cover
          fs.unlink(temporaryFilename);
          var totalFileExpected = result.release.tracks[0].track.length + 1;
          // remember that the parser always ask to refear to a field as an 
          // array, so if you can access a variable, try to att [0] at the end
          // CHECK IF THE COVER IS AVAILABLE
          //console.log(util.inspect(result, false, null))

          // TODO this splitting might be wrong if the filename has dots in it
          var coverFileName = 
            result.release.coverArtFilename[0].split('.')[0];
          var coverExtension =
            result.release.coverArtFilename[0].split('.')[1];
          //console.log(result.release.tracks[0].track)
          var allAndObjects = [];
          var orObject = model.Sequelize.or();
          // ADD THE COVER 
          allAndObjects.push(model.Sequelize.and(
            {
              fileName: coverFileName
            }, {
              extension: coverExtension
            }));
          // ADD ALL THE OTHER TRACKS
          for (var j = 0; j < result.release.tracks[0].track.length; j++) {
            var fileName =
              result.release.tracks[0].track[j].trackAudioFile[0].
            audioFilename[0].split('.')[0];
            var extension =
              result.release.tracks[0].track[j].trackAudioFile[0].
            audioFilename[0].split('.')[1];
            var andObject = model.Sequelize.and({
                fileName: fileName
              }, {
                extension: extension
              }, {
                status: 'UPLOADED'
              });
            allAndObjects.push(andObject);
          }
          // TRICK TO ADD ALL THE AND IN OR BETWEEN THEM
          orObject = model.Sequelize.or.apply(null, allAndObjects);
          model.DropZoneFile.findAndCountAll({
            where: orObject
          }).then(function(files) {
            var releaseResult;
            console.log(totalFileExpected + '-' + files.count);
            if (totalFileExpected === files.count) {
              releaseResult = {
                release: result.release.catalogNumber[0],
                status: CORRECT
              };
            } else {
              releaseResult = {
                release: result.release.catalogNumber[0],
                status: FAIL
              };
            }
            deferred.resolve(releaseResult);
          });
        });
      } catch (err) {
        console.log(err.message);
        console.log(err);
        deferred.reject(err);
        return;
      }
    });
  });
  return deferred.promise;
}

function packRelease(xmlPath, idLabel) {
  console.log('PACK RELEASE @beatport.js');
  var promisesQueue = Q.defer();
  var temporaryFilename = 'temporaryFileName-' + Date.now();
  var xmlCloudStream = cloudstorage.createReadStream(xmlPath);
  var xmlTempStream = fs.createWriteStream(temporaryFilename);


  xmlCloudStream.pipe(xmlTempStream)
    .on('error', function(err) {
      console.log('ERROR' + err);
      deferred.reject(err);
    }).on('finish', function() {
      /* alternative asyncronous version 
      var stream = fs.createReadStream(filename);
      var xml = new xmlStream(stream);
      xml.on('end', function(item) {
          console.log('ENDED' + xml);
          console.log(xml)
      })
      */
      fs.readFile(temporaryFilename, 'utf8', function(err, data) {
        if (err) {
          deferred.reject(err);
          return;
        }

        var parser = new xml2js.Parser();
        parser.parseString(data, function(err, resultXML) {

          // USE LABEL AS PIVOTING FOR INNER JOINS 
          model.Label.find({
            where: {
              id: idLabel
            }
          }).then(function(label) {
            // CREATE THE RELEASE 
            var cdnCover = helper.remoteDropZonePath(
              idLabel, 
              resultXML.release.coverArtFilename[0]);
            model.Release.create({
              title: resultXML.release.releaseTitle[0],
              cover: cdnCover,
              catalogNumber: resultXML.release.catalogNumber[0],
              status: model.ReleaseStatus.TO_BE_PROCESSED,
              metadataFile: xmlPath
              /*
              ADD CLOUD LINK TO the cover image 
              UPC: result.release.UPC_EAN[0] || null,
              GRid: result.release.GRid[0] || null,
              description: result.release.description[0] || null,
              type: result.release.releaseSalesType[0]|| null 
              */
            }).then(function(release) {

              var promises = [];
              label.addReleases(release).then(function() {

                // Promises that add tracks
                var tracksCount = resultXML.release.tracks[0].track.length;
                for (var j = 0; j < tracksCount; j++) {
                  promises.push(
                    wrapFunction(
                      addTrack, 
                      this, [
                        resultXML.release.tracks[0].track[j], 
                        release, 
                        idLabel
                      ]));
                }

                // Promise that disables dropzone files
                promises.push(
                  wrapFunction(disableDropZoneFile, this, [cdnCover])
                );

                // Promise that disables metadata files
                promises.push(
                  wrapFunction(disableDropZoneFile, this, [xmlPath])
                );

                processQueueOfPromises(promises).then(function() {
                  promisesQueue.resolve(release);
                });
              });
            });
          });
        });
      });
    });
  return promisesQueue.promise;
}

function addTrack(trackObject, release, idLabel) {
  var deferred = Q.defer();
  console.log(trackObject);
  var fileName = trackObject.trackAudioFile[0].audioFilename[0];

  var cdnPATH = helper.remoteDropZonePath(idLabel, fileName);

  // Create track object
  model.Track.create({
    title: trackObject.trackTitle[0],
    version: trackObject.trackMixVersion[0],
    path: cdnPATH
  }).then(function(track) {

    // Add track to release's tracks
    release.addTrack(track, {
      position: trackObject.trackNumber[0]
    }).then(function() {
      var artistInsertion = [];
      artistInsertion.push(
        wrapFunction(addGenre, this, [
          trackObject.trackGenre, 
          track
        ]));

      // Add artists to the track
      if (trackObject.trackArtists) {
        for (var j = 0; j < trackObject.trackArtists[0].artistName.length; j++) {
          console.log('----- Call Insertion of Artist for this track ');
          artistInsertion.push(
            wrapFunction(
              addProducer, 
              this, 
              [trackObject.trackArtists[0].artistName[j], track]));
        }
      }

      // Add remixers to the track
      if (trackObject.trackRemixers) {
        for (j = 0; j < trackObject.trackRemixers[0].remixerName.length; j++) {
          console.log('----- Call Insertion of Remixes for this track ');
          artistInsertion.push(
            wrapFunction(
              addRemixer,
              this, [trackObject.trackRemixers[0].remixerName[j], track]));
        }
      }

      // Disable track file in DropZone
      artistInsertion.push(
        wrapFunction(disableDropZoneFile, this, [cdnPATH])
      );

      processQueueOfPromises(artistInsertion).then(function() {
        deferred.resolve();
      }, function(err) {
        deferred.reject(err);
      });
    });
  }).fail(function(err) {
    deferred.reject(err);
  });
  return deferred.promise;
}

function processQueueOfPromises(promisesArray, deferred) {
  if (!deferred) {
    deferred = Q.defer();
  }
  if (promisesArray.length > 0) {
    var wrapFunction = promisesArray.shift();
    wrapFunction().then(function() {
      processQueueOfPromises(promisesArray, deferred);
    }, function(reason) {
      deferred.reject(reason);
    });
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

function disableDropZoneFile(cdnPath) {
  var deferred = Q.defer();
  model.DropZoneFile.find({
    where: {
      path: cdnPATH
    }
  }).then(function(file) {
    if (file) {
      file.status = 'TO_BE_PROCESSED';
      file.save().then(function() {
        deferred.resolve();
      });
    }
  });
  return deferred.promise;
}

function addGenre(genreName, track) {
  console.log('TRY TO ADD GENRE');
  var deferred = Q.defer();
  model.Genre.find({
    where: {
      name: genreName
    }
  }).then(function(genre) {
    console.log('ADDED GENRE');
    track.addGenre(genre).then(function(associationGenre) {
      deferred.resolve(associationGenre);
    }, function(err) {
      deferred.reject(err);
    });
  });
  return deferred.promise;
}

function addProducer(artistName, trackObject) {
  var deferred = Q.defer();
  console.log('ADDING AS ARTIST ' + artistName);
  model.Artist.findOrCreate({
    where: {
      displayName: artistName
    },
    defaults: {
      displayName: artistName
    }
  }).spread(function(artist) {
    console.log('ADDEDed PRODUCER ' + artistName);
    trackObject.addProducer(artist).then(function(associationArtist) {
      deferred.resolve(associationArtist);
    }, function(err) {
      deferred.reject(err);
    });
  });

  return deferred.promise;
}

exports.addProducer = addProducer;

function addRemixer(artistName, trackObject) {
  var deferred = Q.defer();
  console.log('ADDING AS REMIXER ' + artistName);
  model.Artist.findOrCreate({
    where: {
      displayName: artistName
    },
    defaults: {
      displayName: artistName
    }
  }).spread(function(artist) {
    console.log('ADDed REMIXER ' + artistName);
    trackObject.addRemixer(artist).then(function(associationArtist) {
      deferred.resolve(associationArtist);
    }, function(err) {
      deferred.reject(err);
    });
  });
  return deferred.promise;
}
