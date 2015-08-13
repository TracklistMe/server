'use strict';

module.exports = {
  up: function(queryInterface, Sequelize, done) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('Artists', { id: Sequelize.INTEGER });
    */
    queryInterface.addColumn(
      'Artists',
      'newAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Artists',
      'smallAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Artists',
      'mediumAvatar',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Artists',
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
      return queryInterface.dropTable('Artists');
    */
    queryInterface.removeColumn('Artists', 'newAvatar');
    queryInterface.removeColumn('Artists', 'smallAvatar');
    queryInterface.removeColumn('Artists', 'mediumAvatar');
    queryInterface.removeColumn('Artists', 'largeAvatar');
    done();
  }
};
