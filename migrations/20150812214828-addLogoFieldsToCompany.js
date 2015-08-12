'use strict';

module.exports = {
  up: function (queryInterface, Sequelize, done) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    queryInterface.addColumn(
      'Companies',
      'newLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Companies',
      'smallLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Companies',
      'mediumLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Companies',
      'largeLogo',
      Sequelize.STRING
    );
    done();
  },

  down: function (queryInterface, Sequelize, done) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    queryInterface.removeColumn('Companies', 'newLogo');
    queryInterface.removeColumn('Companies', 'smallLogo');
    queryInterface.removeColumn('Companies', 'mediumLogo');
    queryInterface.removeColumn('Companies', 'largeLogo');
    done();
  }
};
