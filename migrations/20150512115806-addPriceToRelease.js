"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.addColumn(
      'Releases',
      'Price', {
        type: DataTypes.Sequelize.DECIMAL(10, 2),
        references: "MasterPrices",
        referenceKey: "price",
        allowNull: false
      });
    done();    
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Releases', 'Price');
    done();
  }
};
