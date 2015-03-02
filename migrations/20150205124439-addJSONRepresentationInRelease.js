"use strict";

module.exports = {
    up: function(migration, DataTypes, done) {
        // add altering commands here, calling 'done' when finished
        migration.addColumn(
            'Releases',
            'json',
            DataTypes.STRING
        )
        done();
    },

    down: function(migration, DataTypes, done) {
        // add reverting commands here, calling 'done' when finished
        migration.removeColumn('Releases', 'json')
        done();
    }
};
