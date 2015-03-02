"use strict";

module.exports = {
    up: function(migration, DataTypes, done) {
        // add altering commands here, calling 'done' when finished
        migration.addColumn(
            'Tracks',
            'path',
            DataTypes.STRING
        )
        done();
    },

    down: function(migration, DataTypes, done) {
        // add reverting commands here, calling 'done' when finished
        migration.removeColumn('Tracks', 'path')
        done();
    }
};
