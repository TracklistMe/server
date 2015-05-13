"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.changeColumn(
      'Releases',
      'Price', {
        type: DataTypes.DECIMAL(10, 2),
        references: "MasterPrices",
        referencesKey: "price",
        allowNull: false,
        defaultValue: 1.0
      });
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.changeColumn(
      'Releases',
      'Price', {
        type: DataTypes.DECIMAL(10, 2),
        references: "MasterPrices",
        referencesKey: "price",
        allowNull: false
      });
    done();
  }
};