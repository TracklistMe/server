var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');

var config = rootRequire('config/config');

var sequelizeObject = new Sequelize(config.MYSQL_DATABASE, config.MYSQL_USER, config.MYSQL_PASSWORD, {
    host: config.MYSQL_HOST,
    logging: false,
    dialect: 'mysql'
});

exports.Sequelize = Sequelize;

exports.sequelize = function() {
    return sequelizeObject;
};

/*
 INITIALIZE ALL THE MODELS
 */

/* 
  Model: User

*/

var User = sequelizeObject.define('User', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    email: Sequelize.STRING,
    avatar: Sequelize.STRING,
    fullSizeAvatar: Sequelize.STRING,
    password: Sequelize.STRING,
    displayName: Sequelize.STRING,
    facebook: Sequelize.STRING,
    foursquare: Sequelize.STRING,
    google: Sequelize.STRING,
    github: Sequelize.STRING,
    linkedin: Sequelize.STRING,
    live: Sequelize.STRING,
    yahoo: Sequelize.STRING,
    twitter: Sequelize.STRING,
    isAdmin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    } // TODO Set to FALSE and ask for email confirmation.
}, {
    instanceMethods: {
        comparePassword: function(password) {
            return bcrypt.compareSync(password, this.password)
        }
    }
});

User.hook('beforeValidate', function(user, fn) {
    if (!user.avatar) {
        user.avatar = "default.png"
    }
    var salt = bcrypt.genSaltSync(10);
    user.password = bcrypt.hashSync(user.password, salt);
    return sequelizeObject.Promise.resolve(user)
})

exports.User = User;



/* 
  Model: Comapany
*/

var Company = sequelizeObject.define('Company', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    displayName: Sequelize.STRING,
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    logo: Sequelize.STRING
});
exports.Company = Company;

/* 
  Model: Label
*/

var Label = sequelizeObject.define('Label', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    displayName: Sequelize.STRING,
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    logo: Sequelize.STRING,
    fullSizeLogo: Sequelize.STRING
});
exports.Label = Label;

/* 
  Model: DropZoneFile
*/

var DropZoneFile = sequelizeObject.define('DropZoneFile', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    fileName: Sequelize.STRING,
    extension: Sequelize.STRING,
    status: Sequelize.STRING,
    md5: Sequelize.STRING,
    path: Sequelize.STRING,
    size: Sequelize.BIGINT
});



exports.DropZoneFile = DropZoneFile;
/* 
  Artist
*/

var Artist = sequelizeObject.define('Artist', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    displayName: Sequelize.STRING,
    avatar: Sequelize.STRING,
    fullSizeAvatar: Sequelize.STRING,
});
exports.Artist = Artist;

/* 
  Release
*/

/**
 * Status that a release may have
 **/
exports.ReleaseStatus = {
    INCOMPLETE: 'INCOMPLETE',
    TO_BE_PROCESSED: 'TO_BE_PROCESSED',
    PROCESSED: 'PROCESSED',
    PROCESSING_FAILED: 'PROCESSING_FAILED'
}

var Release = sequelizeObject.define('Release', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title: Sequelize.STRING,
    releaseDate: Sequelize.DATE,
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    cover: Sequelize.STRING,
    catalogNumber: Sequelize.STRING,
    UPC: Sequelize.STRING,
    GRid: Sequelize.STRING,
    description: Sequelize.STRING,
    status: {
        type: Sequelize.ENUM(
            exports.ReleaseStatus.INCOMPLETE,
            exports.ReleaseStatus.TO_BE_PROCESSED,
            exports.ReleaseStatus.PROCESSED,
            exports.ReleaseStatus.PROCESSING_FAILED),
        defaultValue: exports.ReleaseStatus.TO_BE_PROCESSED,
        allowNull: false
    },
    status: Sequelize.STRING,
    json: Sequelize.STRING,
    metadataFile: Sequelize.STRING,
    type: Sequelize.ENUM('release', 'album', 'compilation')
});

exports.Release = Release;

/* Genre */

var Genre = sequelizeObject.define('Genre', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: Sequelize.STRING
});
exports.Genre = Genre;

/* Tracks */

/**
 * Status that a track may have
 **/
exports.TrackStatus = {
    INCOMPLETE: 'INCOMPLETE',
    TO_BE_PROCESSED: 'TO_BE_PROCESSED',
    PROCESSED: 'PROCESSED',
    PROCESSING_FAILED: 'PROCESSING_FAILED'
}

var Track = sequelizeObject.define('Track', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title: Sequelize.STRING,
    version: Sequelize.STRING,
    cover: Sequelize.STRING,
    path: Sequelize.STRING,
    mp3Path: Sequelize.STRING,
    snippetPath: Sequelize.STRING,
    oggSnippetPath: Sequelize.STRING,
    waveform: Sequelize.TEXT,
    lengthInSeconds: Sequelize.INTEGER,
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    status: {
        type: Sequelize.ENUM(
            exports.ReleaseStatus.INCOMPLETE,
            exports.ReleaseStatus.TO_BE_PROCESSED,
            exports.ReleaseStatus.PROCESSED,
            exports.ReleaseStatus.PROCESSING_FAILED),
        defaultValue: exports.ReleaseStatus.TO_BE_PROCESSED,
        allowNull: false
    },
    errorMessage: Sequelize.STRING
});
exports.Track = Track;

/**
 * CartItem
 **/

var CartItem = sequelizeObject.define('CartItem', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    transactionStarted: Sequelize.BOOLEAN
});

exports.CartItem = CartItem;
User.hasMany(CartItem)
CartItem.belongsTo(User, {
    foreignKey: {
        name: 'UserId',
        allowNull: false
    },
    onDelete: 'CASCADE'
});

CartItem.belongsTo(Track, {
    foreignKey: {
        name: 'TrackId',
        allowNull: true
    },
    onDelete: 'CASCADE'
});

CartItem.belongsTo(Release, {
    foreignKey: {
        name: 'ReleaseId',
        allowNull: true
    },
    onDelete: 'CASCADE'
});

/**
 * Library
 **/

var LibraryItem = sequelizeObject.define('LibraryItem', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    }
});

exports.LibraryItem = LibraryItem;

Track.belongsToMany(User, {
    through: LibraryItem,
    foreignKey: {
        name: 'TrackId',
        allowNull: false
    }
});

User.belongsToMany(Track, {
    through: LibraryItem,
    foreignKey: {
        name: 'UserId',
        allowNull: false
    }
});

/**
 * Master Price
 **/

var MasterPrice = sequelizeObject.define('MasterPrice', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    price: Sequelize.DECIMAL(10, 2)
});

/**
 * Currency
 **/

var Currency = sequelizeObject.define('Currency', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: Sequelize.STRING,
    shortname: Sequelize.STRING(32),
    symbol: Sequelize.STRING(4) //,
});

/**
 * Converted Price
 **/

var ConvertedPrice = sequelizeObject.define('ConvertedPrice', {
    price: Sequelize.DECIMAL(10, 2)
});

Currency.belongsToMany(MasterPrice, {
    through: ConvertedPrice,
    foreignKey: {
        name: 'CurrencyId',
        allowNull: false
    },
    onDelete: 'CASCADE'
});

MasterPrice.belongsToMany(Currency, {
    through: ConvertedPrice,
    foreignKey: {
        name: 'MasterPriceId',
        allowNull: false
    },
    onDelete: 'CASCADE'
});

/* 
  Many to Many association and tables
*/

// User <--> Company
User.belongsToMany(Company)
Company.belongsToMany(User)
// Label <--> Company
Company.belongsToMany(Label)
Label.belongsToMany(Company)
// User <--> Labels
User.hasMany(Label)
Label.hasMany(User)


// Label <--> DropZoneFile

DropZoneFile.belongsToMany(Label)
Label.belongsToMany(DropZoneFile)


// Label <--> Releases
Release.belongsToMany(Label)
Label.belongsToMany(Release)
// Release <--> Tracks 
ReleaseTracks = sequelizeObject.define('ReleaseTracks', {
    position: Sequelize.INTEGER
})

Track.hasMany(Release, {
    through: ReleaseTracks
})
Release.hasMany(Track, {
    through: ReleaseTracks
})

// ARTIST AS PRODCUER of a TRACK     (artist <--> track) 
ProducerTracks = sequelizeObject.define('ArtistTracks', {})
Artist.hasMany(Track, {
    through: ProducerTracks
})
Track.hasMany(Artist, {
    as: 'Producer',
    through: ProducerTracks
})

// ARTIST AS REMIXER of a TRACK     (artist <--> track) 
RemixerTracks = sequelizeObject.define('RemixerTracks', {})
Artist.hasMany(Track, {
    through: RemixerTracks
})
Track.hasMany(Artist, {
    as: 'Remixer',
    through: RemixerTracks
})

//Artist ownership by users

User.belongsToMany(Artist)
Artist.belongsToMany(User)


// GENRE and track relationship
Track.belongsToMany(Genre)
Genre.belongsToMany(Track)

//sequelizeObject.sync();