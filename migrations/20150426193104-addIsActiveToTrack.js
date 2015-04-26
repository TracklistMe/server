"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.addColumn(
      'Tracks',
      'isActive',
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    );
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Tracks', 'isActive');
    done();
  }
};
