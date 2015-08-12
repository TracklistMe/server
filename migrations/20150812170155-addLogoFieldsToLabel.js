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
      'Labels',
      'newLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Labels',
      'smallLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Labels',
      'mediumLogo',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Labels',
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
    queryInterface.removeColumn('Labels', 'newLogo');
    queryInterface.removeColumn('Labels', 'smallLogo');
    queryInterface.removeColumn('Labels', 'mediumLogo');
    queryInterface.removeColumn('Labels', 'largeLogo');
    done();
  }
};
