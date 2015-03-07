var config = rootRequire('config/config');
var dbProxy = rootRequire('models/model');
var Q = require('q');

// attempted refactoring of the addTrack to a Release function.


function addTrack(trackObject, releaseDBObject, release) {
    var deferred = Q.defer();
    console.log("ADD TRACKS ============");
    console.log(trackObject)
        /*
        var fileName = trackObject.trackAudioFile[0].audioFilename[0];

        var cdnPATH = "dropZone/" + idLabel + "/" + fileName;
        */

    dbProxy.Track.create(trackObject).error(function(err) {
        console.log(err)
    }).success(function(track) {

        console.log("TRACK CREATED ")
        releaseDBObject.addTrack(track, {
            position: trackObject.ReleaseTracks.position
        }).then(function(associationTrackRelease) {
            /*
            var artistInsertion = []
            for (var j = 0; j < trackObject.trackArtists[0].artistName.length; j++) {

                artistInsertion.push(addArtist(trackObject.trackArtists[0].artistName[j], track))

            }

            if (trackObject.trackRemixers) {
                for (var j = 0; j < trackObject.trackRemixers[0].remixerName.length; j++) {
                    artistInsertion.push(addRemixer(trackObject.trackRemixers[0].remixerName[j], track))
                }
            }
            var result = Q();
            artistInsertion.forEach(function(f) {
                result = result.then(f);
            });
            dbProxy.DropZoneFile.find({
                where: {
                    path: cdnPATH
                }
            }).on('success', function(file) {
                file.destroy().on('success', function(u) {
                    deferred.resolve(result);
                })
            })
*/
            deferred.resolve()

        })
    });



    return deferred.promise;
}
exports.addTrack = addTrack;
