"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.changeColumn(
      'Artists',
      'displayName',
      {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      }
    );
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.changeColumn(
      'Artists',
      'displayName',
      {
        type: DataTypes.STRING,
        allowNull: false,
        unique: false
      }
    );
    done();
  }
};
