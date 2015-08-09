'use strict';

var model = rootRequire('models/model');
var Q = require('q');

/**
 * Add a Track to a Release
 */
function addTrack(trackObject, releaseDBObject) {
  var deferred = Q.defer();
  console.log('ADD TRACKS ============');
  console.log(trackObject);
  /*
  var fileName = trackObject.trackAudioFile[0].audioFilename[0];
  var cdnPATH = "dropZone/" + idLabel + "/" + fileName;
  */
  model.Track.create(trackObject).error(function(err) {
    console.log(err);
  }).success(function(track) {

    console.log('TRACK CREATED');
    releaseDBObject.addTrack(track, {
      position: trackObject.ReleaseTracks.position
    }).then(function() {
      /*
      var artistInsertion = []
      for (var j = 0; j < trackObject.trackArtists[0].artistName.length; j++) {
        artistInsertion.push(
          addArtist(trackObject.trackArtists[0].artistName[j], track));
      }
      if (trackObject.trackRemixers) {
        for (j = 0; j < trackObject.trackRemixers[0].remixerName.length; j++) {
          artistInsertion.push(
            addRemixer(trackObject.trackRemixers[0].remixerName[j], track));
        }
      }
      var result = Q();
      artistInsertion.forEach(function(f) {
        result = result.then(f);
      });
      model.DropZoneFile.find({
        where: {
          path: cdnPATH
        }
      }).on('success', function(file) {
        file.destroy().on('success', function(u) {
          deferred.resolve(result);
        });
      });
      */
      deferred.resolve();
    });
  });
  return deferred.promise;
}

exports.addTrack = addTrack;
