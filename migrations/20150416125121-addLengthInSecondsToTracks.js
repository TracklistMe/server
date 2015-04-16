"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    //lengthInSeconds
    migration.addColumn(
      'Tracks',
      'lengthInSeconds',
      DataTypes.INTEGER
    );
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Tracks', 'lengthInSeconds');
    done();
  }
};
