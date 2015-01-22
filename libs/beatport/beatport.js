
var Q = require('q');
var config = require('config/config');
var dbProxy = require('models/model');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var util = require('util');
var xml2js = require('xml2js');
var mkdir = require('mkdirp');

var CORRECT = "correct"
var FAIL = "fail"
/*
 |--------------------------------------------------------------------------
 | Accept an array of object with parameters path that point to the file .xml
 | check if the files pointed by the xml are available
 |--------------------------------------------------------------------------
 */
function validate(xmlArrayList){
  var deferred = Q.defer();
  var processResults = {success: [], fail:[]}
  var promises = []; 

  for(var i = 0; i<xmlArrayList.length;i++){ 
      promises.push(validateFile(xmlArrayList[i]));
    } // close the for loop 
    Q.allSettled(promises)  
    .then(function (results) {
        results.forEach(function (result) {
              if(result.value.status == CORRECT){
                processResults.success.push(result.value);
              }else{
                processResults.fail.push(result.value);
              }
        });
        deferred.resolve(processResults);
    });
    return deferred.promise;
}

exports.validate = validate;

/*
 |--------------------------------------------------------------------------
 | Accept an array of object with parameters path that point to the file .xml
 | assumed a validate was run before! 
 |--------------------------------------------------------------------------
 */
function process(xmlArrayList,idLabel){
  var deferred = Q.defer();
  var promises = []; 

  for(var i = 0; i<xmlArrayList.length;i++){
    promises.push(packRelease(xmlArrayList[i],idLabel));
 
  }


  // Joint of all the promises 
  Q.allSettled(promises)  
    .then(function (results) {
        results.forEach(function (result) {
          console.log("process Release ")      
        });

        deferred.resolve(results);
    });
  return deferred.promise;

}

exports.process = process;



function packRelease(releaseXML,idLabel){
  var promisesQueue = Q.defer();
  labelPath = config.DATASTORE_PATH+"/"+idLabel+"/"
 


  var parser = new xml2js.Parser();
    var releaseXMLPath = config.TEMPORARY_UPLOAD_FOLDER + releaseXML.path;
    fs.readFile(releaseXMLPath, function(err, data) {
      parser.parseString(data, function (err, resultXML) {
        var releaseFolderPath = labelPath+resultXML.release.catalogNumber[0];
        mkdir(labelPath+resultXML.release.catalogNumber[0], function (err) {
          if(!err){
            // USE LABEL AS PIVOTING FOR INNER JOINS 
            dbProxy.Label.find({where: {id:idLabel}}).then(function(label){
              // CREATE THE RELEASE 
              dbProxy.Release.create({
                title: resultXML.release.releaseTitle[0],
                cover: resultXML.release.coverArtFilename[0],
                catalogNumber: resultXML.release.catalogNumber[0] 
                /*
                UPC: result.release.UPC_EAN[0] || null,
                GRid: result.release.GRid[0] || null,
                description: result.release.description[0] || null,
                type: result.release.releaseSalesType[0]|| null 
                */
              }).success(function(release) {
                  // TRANSFER ALL FILES
 
                   
                  var promises = [];
                  var xml = resultXML.release.catalogNumber[0]+".xml";
                  var cover = resultXML.release.coverArtFilename[0];
                  promises.push(transferFile(xml,releaseFolderPath));
                  promises.push(transferFile(cover,releaseFolderPath));
                  for(var i = 0; i<resultXML.release.tracks[0].track.length;i++){
                    var trackName = resultXML.release.tracks[0].track[i].trackAudioFile[0].audioFilename[0];
                    promises.push(transferFile(trackName,releaseFolderPath));
                  }
 

                  // PROCESS ALL THE DB 
                  promises.push(
                  label.addReleases(release).then(function(associationRelease) {
                    var trackInsertion = [] 
                      for(var j=0; j<resultXML.release.tracks[0].track.length; j++){
                        trackInsertion.push(addTrack(resultXML.release.tracks[0].track[j],release)); 
                      } 
                    var result = Q();
                    trackInsertion.forEach(function (f) {
                      result = result.then(f);
                      console.log("another interaction")
                    });
 
                  }))

                  Q.allSettled(promises)  
                  .then(function (results) {
                      console.log("GOT A RESULT")
                      results.forEach(function (result) {
                         console.log("settle Request")
                      });

                      
                      promisesQueue.resolve(results);
                  })
                   
                  
                });
            })
          }
        })
    })
  });
  return promisesQueue.promise;
}

function transferFile(fullFilename,destination){
  var deferred = Q.defer();

  var fileName = fullFilename.split(".")[0]
  var extension = fullFilename.split(".")[1]
  var andObject = dbProxy.Sequelize.and({fileName:fileName},{extension:extension})

  console.log(fullFilename)
  dbProxy.DropZoneFile.find({where: andObject}).then(function(file) {
    var originalPath = config.TEMPORARY_UPLOAD_FOLDER+file.path;
    var destinationPath = destination+"/"+fullFilename;
    fs.rename(originalPath,destinationPath, function (err) {
      if (err) throw err;
      file.destroy().on('success', function(u) {
        deferred.resolve(u);
        console.log("REMOVED FILE")
      })
    });
 
  })
  //setInterval(function(){ console.log("Transfer file"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);
  
  return deferred.promise; 
}

function addTrack(trackObject,release){
  var deferred = Q.defer();


  dbProxy.Track.create({
    title: trackObject.trackTitle[0],
    version: trackObject.trackMixVersion[0]
  }).success(function(track) {
    release.addTrack(track,{position: trackObject.trackNumber[0]}).then(function(associationTrackRelease ) {
        var artistInsertion = [] 
        for(var j=0; j<trackObject.trackArtists[0].artistName.length; j++){
           
          artistInsertion.push(addArtist(trackObject.trackArtists[0].artistName[j], track))
          
        } 
   
        if(trackObject.trackRemixers){
          for(var j=0; j<trackObject.trackRemixers[0].remixerName.length; j++){
            artistInsertion.push(addRemixer(trackObject.trackRemixers[0].remixerName[j], track))
          } 
        }
        var result = Q();
        artistInsertion.forEach(function (f) {
            result = result.then(f);
        });
        deferred.resolve(result);
    })
  });
  // setInterval(function(){ console.log("add track"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);
  
  return deferred.promise; 
}

function addArtist(artistName,trackObject){
  var deferred = Q.defer();
  dbProxy.Artist.find({ where: {displayName: artistName}})
  .then(function(artist) { 
    if(!artist){
        dbProxy.Artist.create({
          displayName: artistName
        }).success(function(newArtist) {
            trackObject.addProducer(newArtist).then(function(associationArtist){
              deferred.resolve(newArtist)
            })
        })
    } else {
      trackObject.addProducer(artist).then(function(associationArtist){
        deferred.resolve(artist);
      })
    } 
  })
   //setInterval(function(){ console.log("add artist"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);
  return deferred.promise;
}

exports.addArtist = addArtist;

function addRemixer(artistName,trackObject){
  var deferred = Q.defer();
  dbProxy.Artist.find({ where: {displayName: artistName}})
  .then(function(artist) { 
    if(!artist){
        dbProxy.Artist.create({
          displayName: artistName
        }).success(function(newArtist) {
            trackObject.addRemixer(newArtist).then(function(associationArtist){
              deferred.resolve(newArtist)
            })
        })
    } else {
      trackObject.addRemixer(artist).then(function(associationArtist){
        deferred.resolve(artist);
      })
    }
  })
   //setInterval(function(){ console.log("add remixer"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);
  
  return deferred.promise;
}

function validateFile(release){
  var deferred = Q.defer();
    var parser = new xml2js.Parser();
    fs.readFile(__dirname + '/../../../uploadFolder/img/' + release.path, function(err, data) {
          parser.parseString(data, function (err, result) {
              // totalFileExpected = all the tracks + cover
              var totalFileExpected = result.release.tracks[0].track.length  + 1; 
              // remember that the parser always ask to refear to a field as an array, 
              // so if you can access a variable, try to att [0] at the end
              // CHECK IF THE COVER IS AVAILABLE
              //console.log(util.inspect(result, false, null))
              var coverFileName = result.release.coverArtFilename[0].split(".")[0];
              var coverExtension = result.release.coverArtFilename[0].split(".")[1];
              //console.log(result.release.tracks[0].track)
              var allAndObjects = []
              var orObject = dbProxy.Sequelize.or();
              // ADD THE COVER 
              allAndObjects.push( dbProxy.Sequelize.and({fileName:coverFileName},{extension:coverExtension}))
              // ADD ALL THE OTHER TRACKS
              for(var j=0; j<result.release.tracks[0].track.length; j++){
                 var fileName = result.release.tracks[0].track[j].trackAudioFile[0].audioFilename[0].split(".")[0]
                var extension = result.release.tracks[0].track[j].trackAudioFile[0].audioFilename[0].split(".")[1]
                var andObject = dbProxy.Sequelize.and({fileName:fileName},{extension:extension})
                allAndObjects.push(andObject)
              }  
              // TRICK TO ADD ALL THE AND IN OR BETWEEN THEM
              var orObject =  dbProxy.Sequelize.or.apply(null,allAndObjects)
                dbProxy.DropZoneFile.findAndCountAll({where: orObject}).then(function(files) {
                  var releaseResult;
                  console.log(totalFileExpected+"-"+files.count)
                  if(totalFileExpected == files.count){
                      releaseResult = {release:release, status : CORRECT}
                  } else {
                      releaseResult = {release:release, status :  FAIL}
                  }
                  deferred.resolve(releaseResult);
                })  
            }) 
        }) 
    return deferred.promise;
}