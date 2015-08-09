'use strict';

var authenticationUtils = rootRequire('utils/authentication-utils');
var model = rootRequire('models/model');

module.exports.controller = function(app) {

  /**
   * GET /genres/searchExact/:searchString
   * Return the list of genres whose displayName exactly matches the search 
   * string
   */
  app.get('/genres/searchExact/:searchString', function(req, res) {
    var searchString = req.params.searchString;
    model.Genre.find({
      where: {
        name: searchString
      }
    }).then(function(genre) {
      res.send(genre);
    });
  });

  /**
   * GET /genres/
   * Return list of all the genres
   * TODO: pagination
   */
  app.get('/genres/', function(req, res) {
    model.Genre.findAll().then(function(genres) {
      res.send(genres);
    });
  });

  /**
   * GET /genres/:id
   * Return the genre associated with the specified id
   */
  app.get('/genres/:id', function(req, res) {
    var genreId = req.params.id;
    model.Genre.find({
      where: {
        id: genreId
      }
    }).then(function(genre) {
      res.send(genre);
    });
  });

  /**
   * PUT /genres/:id
   * Update genre information
   * TODO check passed data
   */
  app.put('/genres/:id',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var genreId = req.params.id;
      console.log('Update artist');
      model.Genre.find({
        where: {
          id: genreId
        }
      }).then(function(genre) {
        if (genre) { // if the record exists in the db
          genre.updateAttributes(req.body).then(function() {
            res.send();
          });
        }
      });
    });

  /**
   * POST /genres/
   * Create new genre
   */
  app.post('/genres/',
    authenticationUtils.ensureAuthenticated, authenticationUtils.ensureAdmin,
    function(req, res) {
      var genreName = req.body.name;

      model.Genre.find({
        where: {
          name: genreName
        }
      }).then(function(genre) {
        if (!genre) {
          model.Genre.create({
            name: genreName
          }).success(function(newGenre) {
            genre = newGenre;
          });
        }
        res.send(genre);
      });
    });

}; /* End of genres controller */
