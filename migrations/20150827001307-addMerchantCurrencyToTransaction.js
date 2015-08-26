'use strict';

module.exports = {
  up: function(queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    queryInterface.addColumn(
      'Transactions',
      'MerchantTransactionCurrencyId', {
        type: Sequelize.INTEGER,
        references: {
          model: 'Currencies',
          key: 'id'
        },
        allowNull: false,
        onUpdate: 'cascade',
        onDelete: 'restrict'
      });
  },

  down: function(queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    queryInterface.removeColumn('Transactions', 'MerchantTransactionCurrencyId');
  }
};
