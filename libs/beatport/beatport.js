var Q = require('q');
var bcrypt = require('bcryptjs');
var util = require('util');
var xml2js = require('xml2js');
var mkdir = require('mkdirp');

var config = rootRequire('config/config');
var dbProxy = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');
var fs = require('fs');
var xmlStream = require('xml-stream');
 

var CORRECT = "correct"
var FAIL = "fail"
    /*
     |--------------------------------------------------------------------------
     | Accept an array of object with parameters path that point to the file .xml
     | check if the files pointed by the xml are available
     |--------------------------------------------------------------------------
     */
function validate(xmlArrayList) {

    var deferred = Q.defer();
    var processResults = {
        success: [],
        fail: []
    }
    var promises = [];

    for (var i = 0; i < xmlArrayList.length; i++) {
        console.log(xmlArrayList[i].path)
        promises.push(validateFile(xmlArrayList[i].path));
    } // close the for loop 
    Q.allSettled(promises)
        .then(function(results) {
            results.forEach(function(result) {
                if (result.value.status == CORRECT) {
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

/*
 |--------------------------------------------------------------------------
 | Accept an array of object with parameters path that point to the file .xml
 | assumed a validate was run before! 
 |--------------------------------------------------------------------------
 */
function process(xmlArrayList, idLabel) {
    var deferred = Q.defer();
    var promises = [];

    for (var i = 0; i < xmlArrayList.length; i++) {
        promises.push(packRelease(xmlArrayList[i].path, idLabel));

    }


    // Joint of all the promises 
    Q.allSettled(promises)
        .then(function(results) {
            results.forEach(function(result) {
                console.log("Release Processed --------")
                console.log("RELEASE"+result.value.dataValues.id)
               
             /*   controllerRelease.consolideJSON(result.value.dataValues.id).then(function(){
                    console.log("JSON --- SALVATO")
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
    var filename = "temporaryFileName-" + n
    var xmlCloudStream = cloudstorage.createReadStream(xmlPath)
    var writeFile = fs.createWriteStream(filename);




    xmlCloudStream.pipe(writeFile)
        .on('error', function(err) {
            console.log("ERROR" + err)
        }).on('finish', function() {


            /* alternative asyncronous version 
            var stream = fs.createReadStream(filename);
            var xml = new xmlStream(stream);
            xml.on('end', function(item) {
                console.log("ENDED" + xml);
                console.log(xml)
            })
            */

            fs.readFile(filename, "utf8", function(err, data) {
                console.log(data);

                try {
                    var parser = new xml2js.Parser();
                    parser.parseString(data, function(err, result) {
                        // totalFileExpected = all the tracks + cover
                        fs.unlink(filename)
                        var totalFileExpected = result.release.tracks[0].track.length + 1;
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
                        allAndObjects.push(dbProxy.Sequelize.and({
                                fileName: coverFileName
                            }, {
                                extension: coverExtension
                            }))
                            // ADD ALL THE OTHER TRACKS
                        for (var j = 0; j < result.release.tracks[0].track.length; j++) {
                            var fileName = result.release.tracks[0].track[j].trackAudioFile[0].audioFilename[0].split(".")[0]
                            var extension = result.release.tracks[0].track[j].trackAudioFile[0].audioFilename[0].split(".")[1]
                            var andObject = dbProxy.Sequelize.and({
                                fileName: fileName
                            }, {
                                extension: extension
                            }, {
                                status: "UPLOADED"
                            })
                            allAndObjects.push(andObject)
                        }
                        // TRICK TO ADD ALL THE AND IN OR BETWEEN THEM
                        var orObject = dbProxy.Sequelize.or.apply(null, allAndObjects)
                        dbProxy.DropZoneFile.findAndCountAll({
                            where: orObject
                        }).then(function(files) {
                            var releaseResult;
                            console.log(totalFileExpected + "-" + files.count)
                            if (totalFileExpected == files.count) {
                                releaseResult = {
                                    release: result.release.catalogNumber[0],
                                    status: CORRECT
                                }
                            } else {
                                releaseResult = {
                                    release: result.release.catalogNumber[0],
                                    status: FAIL
                                }
                            }
                            deferred.resolve(releaseResult);
                        })
                    })
                } catch (err) {
                    console.log(err.message);
                    console.log(err);
                }
            });

        });


    return deferred.promise;
}


function packRelease(xmlPath, idLabel) {
    var promisesQueue = Q.defer();
    var d = new Date();
    var n = d.getTime();
    var filename = "temporaryFileName-" + n
    var xmlCloudStream = cloudstorage.createReadStream(xmlPath)
    var writeFile = fs.createWriteStream(filename);



    xmlCloudStream.pipe(writeFile)
        .on('error', function(err) {
            console.log("ERROR" + err)
        }).on('finish', function() {


            /* alternative asyncronous version 
            var stream = fs.createReadStream(filename);
            var xml = new xmlStream(stream);
            xml.on('end', function(item) {
                console.log("ENDED" + xml);
                console.log(xml)
            })
            */

            fs.readFile(filename, "utf8", function(err, data) {

                var parser = new xml2js.Parser();
                parser.parseString(data, function(err, resultXML) {

                    // USE LABEL AS PIVOTING FOR INNER JOINS 
                    dbProxy.Label.find({
                        where: {
                            id: idLabel
                        }
                    }).then(function(label) {
                        // CREATE THE RELEASE 
                        var cdnCover = "dropZone/" + idLabel + "/" + resultXML.release.coverArtFilename[0];
                        dbProxy.Release.create({
                            title: resultXML.release.releaseTitle[0],
                            cover: cdnCover,
                            catalogNumber: resultXML.release.catalogNumber[0],
                            status: "PROCESSING",
                            metadataFile: xmlPath
                                /*
                                      
                                       ADD CLOUD LINK TO the cover image 
                                        UPC: result.release.UPC_EAN[0] || null,
                                        GRid: result.release.GRid[0] || null,
                                        description: result.release.description[0] || null,
                                        type: result.release.releaseSalesType[0]|| null 
                                        */
                        }).success(function(release) {
                            // TRANSFER ALL FILES


                            var promises = [];
                            var xml = resultXML.release.catalogNumber[0] + ".xml";
                            var cover = resultXML.release.coverArtFilename[0];



                            // PROCESS ALL THE DB 
                             
                            label.addReleases(release).then(function(associationRelease) {
                                    var trackInsertion = []
                                    for (var j = 0; j < resultXML.release.tracks[0].track.length; j++) {
                                        promises.push(  addTrack(resultXML.release.tracks[0].track[j], release, idLabel) );
                                    }
                                   

                               

                                    // Temporarily disable cover in dropzone 
                                    promises.push(

                                        dbProxy.DropZoneFile.find({
                                            where: {
                                                path: cdnCover
                                            }
                                        }).then(function(file) {
                                            file.status = "PROCESSING"
                                            file.save()
                                        })
                                    );

                                    // Temporarilu disable xml in dropzone 
                                    promises.push(

                                        dbProxy.DropZoneFile.find({
                                            where: {
                                                path: xmlPath
                                            }
                                        }).then(function(file) {
                                            file.status = "PROCESSING"
                                            file.save()
                                        })
                                    );

                                    Q.allSettled(promises)
                                        .then(function(results) {
                                            console.log("GOT A RESULT")
                                            results.forEach(function(result) {
                                                console.log("settle Request")
                                            });

                                            
                                            promisesQueue.resolve(release);
                                        })
                            })   

                        });
                    })
                })
            })

            //labelPath = config.DATASTORE_PATH + "/" + idLabel + "/"

        });
    return promisesQueue.promise;
}

function transferFile(fullFilename, destination) {
    var deferred = Q.defer();

    var fileName = fullFilename.split(".")[0]
    var extension = fullFilename.split(".")[1]
    var andObject = dbProxy.Sequelize.and({
        fileName: fileName
    }, {
        extension: extension
    })

    console.log(fullFilename)
    dbProxy.DropZoneFile.find({
            where: andObject
        }).then(function(file) {
            var originalPath = config.TEMPORARY_UPLOAD_FOLDER + file.path;
            var destinationPath = destination + "/" + fullFilename;
            fs.rename(originalPath, destinationPath, function(err) {
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

function addTrack(trackObject, release, idLabel) {
    var deferred = Q.defer();
    console.log("-- Called Add Track ");
    console.log(trackObject)
    var fileName = trackObject.trackAudioFile[0].audioFilename[0];

    var cdnPATH = "dropZone/" + idLabel + "/" + fileName;


    dbProxy.Track.create({
        title: trackObject.trackTitle[0],
        version: trackObject.trackMixVersion[0],
        path: cdnPATH
    }).error(function(err) {
        console.log(err)
    }).success(function(track) {

        console.log("---- Track Created ")
        release.addTrack(track, {
            position: trackObject.trackNumber[0]
        }).then(function(associationTrackRelease) {
            var artistInsertion = []
            for (var j = 0; j < trackObject.trackArtists[0].artistName.length; j++) {
                console.log("----- Call Insertion of Artist for this track ")
                artistInsertion.push(addArtist(trackObject.trackArtists[0].artistName[j], track))

            }

            if (trackObject.trackRemixers) {
                for (var j = 0; j < trackObject.trackRemixers[0].remixerName.length; j++) {
                     console.log("----- Call Insertion of Remixes for this track ")
                    artistInsertion.push(addRemixer(trackObject.trackRemixers[0].remixerName[j], track))
                }
            }




            Q.allSettled(artistInsertion)
                                .then(function(results) {
                                    console.log("GOT A RESULT")
                                    results.forEach(function(result) {
                                         
                                    });
                                    console.log("ALL INSERTION FOR THIS TRACK ARE SETTLED ")
                                    dbProxy.DropZoneFile.find({
                                        where: {
                                            path: cdnPATH
                                        }
                                    }).on('success', function(file) {
                                        file.status = "PROCESSING"
                                        file.save().on('success', function(u) {
                                            console.log("Resolve the main promise for this track")
                                            deferred.resolve(results);
                                        })
                                    }) 

                                  

 
            })    
        })
    });
    // setInterval(function(){ console.log("add track"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);

    return deferred.promise;
}

function addArtist(artistName, trackObject) {
    var deferred = Q.defer();
    dbProxy.Artist.find({
            where: {
                displayName: artistName
            }
        })
        .then(function(artist) {
            if (!artist) {
                dbProxy.Artist.create({
                    displayName: artistName
                }).success(function(newArtist) {
                    trackObject.addProducer(newArtist).then(function(associationArtist) {
                        deferred.resolve(newArtist)
                    })
                })
            } else {
                trackObject.addProducer(artist).then(function(associationArtist) {
                    deferred.resolve(artist);
                })
            }
        })
        //setInterval(function(){ console.log("add artist"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);
    return deferred.promise;
}

exports.addArtist = addArtist;

function addRemixer(artistName, trackObject) {
    var deferred = Q.defer();
    dbProxy.Artist.find({
            where: {
                displayName: artistName
            }
        })
        .then(function(artist) {
            if (!artist) {
                dbProxy.Artist.create({
                    displayName: artistName
                }).success(function(newArtist) {
                    trackObject.addRemixer(newArtist).then(function(associationArtist) {
                        deferred.resolve(newArtist)
                    })
                })
            } else {
                trackObject.addRemixer(artist).then(function(associationArtist) {
                    deferred.resolve(artist);
                })
            }
        })
        //setInterval(function(){ console.log("add remixer"); console.log(deferred.promise.inspect(util, { showHidden: true, depth: null })) }, 3000);

    return deferred.promise;
}
