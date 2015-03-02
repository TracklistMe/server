"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.addColumn(
      'Tracks',
      'mp3Path',
       DataTypes.STRING
    )
    migration.addColumn(
      'Tracks',
      'snippetPath',
       DataTypes.STRING
    )
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Tracks', 'mp3Path')
    migration.removeColumn('Tracks', 'snippetPath')
    done();
  }
};
