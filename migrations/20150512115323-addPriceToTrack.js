"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.addColumn(
      'Tracks',
      'Price', {
        type: DataTypes.DECIMAL(10, 2),
        references: "MasterPrices",
        referencesKey: "price",
        allowNull: false
      });
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Tracks', 'Price');
    done();
  }
};
