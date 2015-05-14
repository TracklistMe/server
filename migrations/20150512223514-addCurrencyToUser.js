"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    migration.addColumn(
      'Users',
      'CurrencyId', {
        type: DataTypes.INTEGER,
        references: "Currencies",
        referencesKey: "id",
        allowNull: false,
        onUpdate: 'cascade',
        onDelete: 'restrict'
      });
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.removeColumn('Users', 'CurrencyId');
    done();
  }
};
