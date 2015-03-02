"use strict";

module.exports = {
    up: function(migration, DataTypes, done) {
        // add altering commands here, calling 'done' when finished
        migration.addColumn(
            'Releases',
            'status',
            DataTypes.STRING
        )
        done();
    },

    down: function(migration, DataTypes, done) {
        // add reverting commands here, calling 'done' when finished
        migration.removeColumn('Releases', 'status')
        done();
    }
};
