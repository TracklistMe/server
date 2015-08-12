'use strict';

module.exports = {
  up: function(queryInterface, Sequelize, done) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    queryInterface.addColumn(
      'Users',
      'newAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Users',
      'smallAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Users',
      'mediumAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Users',
      'largeAvatar',
      Sequelize.STRING
    );
    done();
  },

  down: function(queryInterface, Sequelize, done) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    queryInterface.removeColumn('Users', 'newAvatar');
    queryInterface.removeColumn('Users', 'smallAvatar');
    queryInterface.removeColumn('Users', 'mediumAvatar');
    queryInterface.removeColumn('Users', 'largeAvatar');
    done();
  }
};
