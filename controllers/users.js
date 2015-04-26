'use strict';

var fs = require('fs-extra');

var fileUtils = rootRequire('utils/file-utils');
var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');
var cloudstorage = rootRequire('libs/cloudstorage/cloudstorage');

module.exports.controller = function(app) {

    /**
     * GET /me
     * Get authenticated user profile information
     */
    app.get('/me', authenticationUtils.ensureAuthenticated, function(req, res) {

        model.User.find({
            where: {
                id: req.user
            }
        }).then(function(user) {
            res.send(user);
        });
    });

    /**
     * GET /me/companies/
     * Get all companies managed by the authenticated user or all companies in the system
     * if the user is admin
     */
    app.get('/me/companies', authenticationUtils.ensureAuthenticated, function(req, res) {

        model.User.find({
            where: {
                id: req.user
            }
        }).then(function(user) {
            if (user.isAdmin) {
                model.Company.findAll().success(function(companies) {
                    res.send(companies);
                })
            } else {
                user.getCompanies().success(function(companies) {
                    res.send(companies);
                })
            }

        })
    });

    /**
     * GET /me/labels/
     * Get all labels managed by the authenticated user or all labels in the system
     * if the user is admin
     */
    app.get('/me/labels', authenticationUtils.ensureAuthenticated, function(req, res) {

        model.User.find({
            where: {
                id: req.user
            }
        }).then(function(user) {
            if (user.isAdmin) {
                model.Label.findAll().success(function(labels) {
                    res.send(labels);
                })
            } else {
                user.getLabels().success(function(labels) {
                    res.send(labels);
                })
            }
        })
    });


    /**
     * GET /me/artists/
     * Get all artists managed by the authenticated user
     */
    app.get('/me/artists', authenticationUtils.ensureAuthenticated, function(req, res) {

        model.User.find({
            where: {
                id: req.user
            }
        }).then(function(user) {
            if (user.isAdmin) {
                model.Artist.findAll().success(function(artists) {
                    res.send(artists);
                })
            } else {
                user.getArtists().success(function(artists) {
                    res.send(artists);
                })
            }

        })
    });

    /**
     * PUT /api/me
     * Update the authenticated user profile information
     **/
    app.put('/me', authenticationUtils.ensureAuthenticated, function(req, res) {
        model.User.find({
            where: {
                id: req.user
            }
        }).then(function(user) {
            if (!user) {
                return res.status(400).send({
                    message: 'User not found'
                });
            }
            user.displayName = req.body.displayName || user.displayName;
            user.email = req.body.email || user.email;
            user.save(function(err) {
                res.status(200).end();
            });
        });
    });

    /**
     * POST /upload/profilePicture/:width/:height/
     * Upload user profile picture to the CDN, original size and resized
     **/
    app.post('/upload/profilePicture/:width/:height/',
        authenticationUtils.ensureAuthenticated,
        fileUtils.uploadFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),
        fileUtils.resizeFunction(fileUtils.localImagePath, fileUtils.remoteImagePath),
        function(req, res, next) {

            model.User.find({
                where: {
                    id: req.user
                }
            }).then(function(user) {
                // We store CDN address as avatar
                var oldAvatar = user.avatar;
                var oldFullSizeAvatar = user.fullSizeAvatar;
                user.avatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].resizedFilename);
                user.fullSizeAvatar = fileUtils.remoteImagePath(req, req.uploadedFile[0].filename);
                user.save().then(function(user) {
                    // we remove old avatars from the CDN
                    cloudstorage.remove(oldAvatar);
                    cloudstorage.remove(oldFullSizeAvatar);
                    // We remove temporarily stored files
                    fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].filename));
                    fs.unlink(fileUtils.localImagePath(req, req.uploadedFile[0].resizedFilename));

                    res.writeHead(200, {
                        "content-type": "text/html"
                    }); //http response header
                    res.end(JSON.stringify(req.uploadedFile));
                });
            }); /* Database read callback */
        }); /* POST /upload/profilePicture/:width/:height/ */

    /**
     * GET /users/search/
     * Look for a user by displayName
     **/
    app.get('/users/search/:searchString', authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin, function(req, res) {
        var searchString = req.params.searchString;
        model.User.findAll({
            where: {
                displayName: searchString
            }
        }).then(function(users) {
            console.log(users)
            res.send(users);
        });
    });

} /* End of users controller */