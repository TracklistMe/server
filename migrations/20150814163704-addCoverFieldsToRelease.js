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
      'Releases',
      'newCover',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Releases',
      'smallCover',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Releases',
      'mediumCover',
      Sequelize.STRING
    );
    queryInterface.addColumn(
      'Releases',
      'largeCover',
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
    queryInterface.removeColumn('Releases', 'newCover');
    queryInterface.removeColumn('Releases', 'smallCover');
    queryInterface.removeColumn('Releases', 'mediumCover');
    queryInterface.removeColumn('Releases', 'largeCover');
    done();
  }
};
