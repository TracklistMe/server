'use strict';

var Q = require('q');
var xml2js = require('xml2js');

var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cdn/cloudstorage');
var fs = require('fs');

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
  var d = new Date();
  var n = d.getTime();
  var filename = 'temporaryFileName-' + n;
  var xmlCloudStream = cloudstorage.createReadStream(xmlPath);
  var writeFile = fs.createWriteStream(filename);

  xmlCloudStream.pipe(writeFile).on('error', function(err) {
    console.log('ERROR' + err);
  }).on('finish', function() {
    /* alternative asyncronous version 
    var stream = fs.createReadStream(filename);
    var xml = new xmlStream(stream);
    xml.on('end', function(item) {
        console.log('ENDED' + xml);
        console.log(xml)
    })
    */

    fs.readFile(filename, 'utf8', function(err, data) {

      try {
        var parser = new xml2js.Parser();
        parser.parseString(data, function(err, result) {
          // totalFileExpected = all the tracks + cover
          fs.unlink(filename);
          var totalFileExpected = result.release.tracks[0].track.length + 1;
          // remember that the parser always ask to refear to a field as an 
          // array, so if you can access a variable, try to att [0] at the end
          // CHECK IF THE COVER IS AVAILABLE
          //console.log(util.inspect(result, false, null))
          var coverFileName =
            result.release.coverArtFilename[0].split('.')[0];
          var coverExtension =
            result.release.coverArtFilename[0].split('.')[1];
          //console.log(result.release.tracks[0].track)
          var allAndObjects = [];
          var orObject = model.Sequelize.or();
          // ADD THE COVER 
          allAndObjects.push(model.Sequelize.and({
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
      }
    });
  });
  return deferred.promise;
}

function packRelease(xmlPath, idLabel) {
  console.log('PACK RELEASE @beatport.js');
  var promisesQueue = Q.defer();
  var d = new Date();
  var n = d.getTime();
  var filename = 'temporaryFileName-' + n;
  var xmlCloudStream = cloudstorage.createReadStream(xmlPath);
  var writeFile = fs.createWriteStream(filename);


  xmlCloudStream.pipe(writeFile)
    .on('error', function(err) {
      console.log('ERROR' + err);
    }).on('finish', function() {
      /* alternative asyncronous version 
      var stream = fs.createReadStream(filename);
      var xml = new xmlStream(stream);
      xml.on('end', function(item) {
          console.log('ENDED' + xml);
          console.log(xml)
      })
      */
      fs.readFile(filename, 'utf8', function(err, data) {

        var parser = new xml2js.Parser();
        parser.parseString(data, function(err, resultXML) {

          // USE LABEL AS PIVOTING FOR INNER JOINS 
          model.Label.find({
            where: {
              id: idLabel
            }
          }).then(function(label) {
            // CREATE THE RELEASE 
            var cdnCover =
              'dropZone/' +
              idLabel + '/' +
              resultXML.release.coverArtFilename[0];
            model.Release.create({
              title: resultXML.release.releaseTitle[0],
              cover: cdnCover,
              catalogNumber: resultXML.release.catalogNumber[0],
              status: 'TO_BE_PROCESSED',
              metadataFile: xmlPath
                /*
                ADD CLOUD LINK TO the cover image 
                UPC: result.release.UPC_EAN[0] || null,
                GRid: result.release.GRid[0] || null,
                description: result.release.description[0] || null,
                type: result.release.releaseSalesType[0]|| null 
                */
            }).then(function(release) {
              // TRANSFER ALL FILES

              var promises = [];
              //var xml = resultXML.release.catalogNumber[0] + '.xml';
              //var cover = resultXML.release.coverArtFilename[0];

              // PROCESS ALL THE DB 
              label.addReleases(release).then(function() {

                for (
                  var j = 0; j < resultXML.release.tracks[0].track.length; j++) {
                  promises.push(
                    wrapFunction(
                      addTrack,
                      this, [
                        resultXML.release.tracks[0].track[j],
                        release,
                        idLabel
                      ]));
                }

                // Temporarily disable cover in dropzone 
                promises.push(
                  wrapFunction(function() {
                    var def = Q.defer();
                    model.DropZoneFile.find({
                      where: {
                        path: cdnCover
                      }
                    }).then(function(file) {
                      file.status = 'TO_BE_PROCESSED';
                      def.resolve();
                      file.save();

                    });
                    return def.promise;
                  }, this, [])
                );

                // Temporarilu disable xml in dropzone 
                promises.push(
                  wrapFunction(function() {
                    var def = Q.defer();

                    model.DropZoneFile.find({
                      where: {
                        path: xmlPath
                      }
                    }).then(function(file) {
                      file.status = 'TO_BE_PROCESSED';
                      def.resolve();
                      file.save();
                      // ULTIMA CHIAMATA 
                    });
                    return def.promise;
                  }, this, [])
                );

                processQueueOfPromises(promises).then(function() {
                  promisesQueue.resolve(release);
                });
              });
            });
          });
        });
      });
      //labelPath = config.DATASTORE_PATH + '/' + idLabel + '/'
    });
  return promisesQueue.promise;
}

/* TODO: remove
function transferFile(fullFilename, destination) {
  var deferred = Q.defer();

  var fileName = fullFilename.split('.')[0];
  var extension = fullFilename.split('.')[1];
  var andObject = model.Sequelize.and({
    fileName: fileName
  }, {
    extension: extension
  });

  console.log(fullFilename);
  model.DropZoneFile.find({
      where: andObject
    }).then(function(file) {
      var originalPath = config.TEMPORARY_UPLOAD_FOLDER + file.path;
      var destinationPath = destination + '/' + fullFilename;
      fs.rename(originalPath, destinationPath, function(err) {
        if (err) { 
          throw err;
        }
        file.destroy().on('success', function(u) {
          deferred.resolve(u);
        });
      });
    });

  return deferred.promise;
}
*/

function addTrack(trackObject, release, idLabel) {
  var deferred = Q.defer();
  console.log(trackObject);
  var fileName = trackObject.trackAudioFile[0].audioFilename[0];

  var cdnPATH = 'dropZone/' + idLabel + '/' + fileName;

  model.Track.create({
    title: trackObject.trackTitle[0],
    version: trackObject.trackMixVersion[0],
    path: cdnPATH
  }).error(function(err) {
    console.log(err);
  }).then(function(track) {

    release.addTrack(track, {
      position: trackObject.trackNumber[0]
    }).then(function() {
      var artistInsertion = [];
      artistInsertion.push(
        wrapFunction(
          addGenre,
          this, [trackObject.trackGenre, track]));
      for (var j = 0; j < trackObject.trackArtists[0].artistName.length; j++) {
        console.log('----- Call Insertion of Artist for this track ');
        artistInsertion.push(
          wrapFunction(
            addArtist,
            this, [trackObject.trackArtists[0].artistName[j], track]));
      }

      if (trackObject.trackRemixers) {
        for (j = 0; j < trackObject.trackRemixers[0].remixerName.length; j++) {
          console.log('----- Call Insertion of Remixes for this track ');
          artistInsertion.push(
            wrapFunction(
              addRemixer,
              this, [trackObject.trackRemixers[0].remixerName[j], track]));
        }
      }

      // ADD THE LAST PROMISE THE RESOLVE THE CURRENT ONE 
      artistInsertion.push(
        wrapFunction(
          function() {

            var def = Q.defer();
            model.DropZoneFile.find({
              where: {
                path: cdnPATH
              }
            }).then(function(file) {
              file.status = 'TO_BE_PROCESSED';
              file.save().then(function(file) {
                console.log(
                  'Resolve the main promise for this track: ' +
                  trackObject.trackNumber[0]);
                def.resolve();
              });
            });
            return def.promise;
          }, this, []));

      processQueueOfPromises(artistInsertion).then(function() {
        deferred.resolve();
      });
      /*
      var result = Q();
      artistInsertion.forEach(function(f) {
          result = result.then(f);
      });

      */

    });
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
    });
  } else {
    deferred.resolve();
  }
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
    });
  });
  return deferred.promise;
}

function addArtist(artistName, trackObject) {
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
    });
  });

  return deferred.promise;
}

exports.addArtist = addArtist;

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
    });
  });
  return deferred.promise;
}
