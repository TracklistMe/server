'use strict';

var TrackStatus = {
  INCOMPLETE: 'INCOMPLETE',
  TO_BE_PROCESSED: 'TO_BE_PROCESSED',
  PROCESSED: 'PROCESSED',
  PROCESSING_SUCCEEDED: 'PROCESSING_SUCCEEDED',
  PROCESSING_FAILED: 'PROCESSING_FAILED'
};

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    queryInterface.changeColumn(
      'Tracks',
      'status',
      {
        type: Sequelize.ENUM(
          TrackStatus.INCOMPLETE,
          TrackStatus.TO_BE_PROCESSED,
          TrackStatus.PROCESSED,
          TrackStatus.PROCESSING_SUCCEEDED,
          TrackStatus.PROCESSING_FAILED),
        defaultValue: TrackStatus.TO_BE_PROCESSED,
        allowNull: false
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    queryInterface.changeColumn(
      'Tracks',
      'status',
      {
        type: Sequelize.ENUM(
          TrackStatus.INCOMPLETE,
          TrackStatus.TO_BE_PROCESSED,
          TrackStatus.PROCESSED,
          TrackStatus.PROCESSING_FAILED),
        defaultValue: TrackStatus.TO_BE_PROCESSED,
        allowNull: false
      }
    );
  }
};
