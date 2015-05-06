"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.changeColumn(
      'Releases',
      'status',
      {
        type: DataTypes.ENUM(
            'INCOMPLETE',
            'TO_BE_PROCESSED',
            'PROCESSED',
            'PROCESSING_FAILED'), 
        defaultValue: 'TO_BE_PROCESSED', 
        allowNull: false
      }
    );
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.changeColumn(
      'Releases',
      'status',
       DataTypes.STRING
    );
    done();
  }
};
