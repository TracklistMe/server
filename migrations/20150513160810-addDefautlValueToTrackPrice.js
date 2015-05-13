"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // add altering commands here, calling 'done' when finished
    //migration.sequelize.query("ALTER TABLE `Tracks` DROP COLUMN `Price`").done(function(err, foo) {
    migration.sequelize.query("ALTER TABLE `Tracks` UPDATE COLUMN `Price` DECIMAL(10,2) NOT NULL DEFAULT 1.0").done(function(err, foo) {
    migration.sequelize.query("ALTER TABLE `Tracks` ADD CONSTRAINT `Tracks_ibfk_1` FOREIGN KEY (`Price`) REFERENCES `MasterPrices`(`price`)")
          .done(function(err, foo) {
            if (err) throw err;
            done();
          });
        //});
    }); 
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.sequelize.query("ALTER TABLE `Tracks` DROP FOREIGN KEY `Tracks_ibfk_1`").done(function(err, foo) {
      done();
    });
  }
};

