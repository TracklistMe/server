'use strict';

var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');

var config = rootRequire('config/config');

var sequelizeObject = new Sequelize(
  config.MYSQL_DATABASE,
  config.MYSQL_USER, config.MYSQL_PASSWORD, {
    host: config.MYSQL_HOST,
    logging: console.log,
    dialect: 'mysql'
  });

exports.Sequelize = Sequelize;

exports.sequelize = function() {
  return sequelizeObject;
};

/** 
 * Model: User
 */
var User = sequelizeObject.define('User', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: Sequelize.STRING,
  avatar: Sequelize.STRING,
  newAvatar: Sequelize.STRING,
  smallAvatar: Sequelize.STRING,
  mediumAvatar: Sequelize.STRING,
  largeAvatar: Sequelize.STRING,
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
      return bcrypt.compareSync(password, this.password);
    }
  }
});

User.hook('beforeValidate', function(user) {
  if (!user.avatar) {
    user.avatar = 'default.png';
  }
  var salt = bcrypt.genSaltSync(10);
  user.password = bcrypt.hashSync(user.password, salt);
  return sequelizeObject.Promise.resolve(user);
});

exports.User = User;

/** 
 * Model: EarlyUser
 */
exports.EarlyUserStatus = {
  INCOMPLETE: 'INCOMPLETE',
  UNVERIFIED: 'UNVERIFIED',
  NOT_INVITED_FRIEND: 'NOT_INVITED_FRIEND',
  UNVERIFIED_FRIEND: 'UNVERIFIED_FRIEND',
  VERIFIED: 'VERIFIED'
};

var EarlyUser = sequelizeObject.define('EarlyUser', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: Sequelize.STRING,
  password: Sequelize.STRING,
  isArtist: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isLabel: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  verificationCode: Sequelize.STRING,
  status: {
    type: Sequelize.ENUM(
      exports.EarlyUserStatus.INCOMPLETE,
      exports.EarlyUserStatus.UNVERIFIED,
      exports.EarlyUserStatus.NOT_INVITED_FRIEND,
      exports.EarlyUserStatus.UNVERIFIED_FRIEND,
      exports.EarlyUserStatus.VERIFIED),
    defaultValue: exports.EarlyUserStatus.UNVERIFIED,
    allowNull: false
  },
  referredCount: Sequelize.INTEGER
});

exports.EarlyUser = EarlyUser;

EarlyUser.belongsTo(EarlyUser, {
  foreignKey: {
    name: 'referredBy',
    allowNull: true,
    defaultValue: null,
  },
  as: 'ReferringUser',
  onDelete: 'NO ACTION'
});

/** 
 * Model: Comapany
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
  logo: Sequelize.STRING,
  newLogo: Sequelize.STRING,
  smallLogo: Sequelize.STRING,
  mediumLogo: Sequelize.STRING,
  largeLogo: Sequelize.STRING,
});

exports.Company = Company;

/**
 * Model: Label
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
  newLogo: Sequelize.STRING,
  smallLogo: Sequelize.STRING,
  mediumLogo: Sequelize.STRING,
  largeLogo: Sequelize.STRING,
  fullSizeLogo: Sequelize.STRING
});

exports.Label = Label;

/** 
 * Model: DropZoneFile
 */
exports.DropZoneFileStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING'
};

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

/** 
 * Model: Artist
 */
var Artist = sequelizeObject.define('Artist', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  displayName: Sequelize.STRING,
  avatar: Sequelize.STRING,
  newAvatar: Sequelize.STRING,
  smallAvatar: Sequelize.STRING,
  mediumAvatar: Sequelize.STRING,
  largeAvatar: Sequelize.STRING,
  fullSizeAvatar: Sequelize.STRING,
});

exports.Artist = Artist;

/* 
 * Model: Release
 */
exports.ReleaseStatus = {
  INCOMPLETE: 'INCOMPLETE',
  TO_BE_PROCESSED: 'TO_BE_PROCESSED',
  PROCESSED: 'PROCESSED',
  PROCESSING_FAILED: 'PROCESSING_FAILED'
};

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
  newCover: Sequelize.STRING,
  smallCover: Sequelize.STRING,
  mediumCover: Sequelize.STRING,
  largeCover: Sequelize.STRING,
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
  //status: Sequelize.STRING,
  json: Sequelize.STRING,
  metadataFile: Sequelize.STRING,
  type: Sequelize.ENUM('release', 'album', 'compilation')
});

/**
 * Model: Genre
 */
var Genre = sequelizeObject.define('Genre', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: Sequelize.STRING
});

exports.Genre = Genre;

/**
 * Model: Tracks
 */
exports.TrackStatus = {
  INCOMPLETE: 'INCOMPLETE',
  TO_BE_PROCESSED: 'TO_BE_PROCESSED',
  PROCESSED: 'PROCESSED',
  PROCESSING_SUCCEEDED: 'PROCESSING_SUCCEEDED',
  PROCESSING_FAILED: 'PROCESSING_FAILED'
};

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
  oldPath: Sequelize.STRING,
  mp3Path: Sequelize.STRING,
  snippetPath: Sequelize.STRING,
  oggSnippetPath: Sequelize.STRING,
  waveform: Sequelize.TEXT,
  bpm: Sequelize.FLOAT,
  lengthInSeconds: Sequelize.INTEGER,
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  status: {
    type: Sequelize.ENUM(
      exports.TrackStatus.INCOMPLETE,
      exports.TrackStatus.TO_BE_PROCESSED,
      exports.TrackStatus.PROCESSED,
      exports.TrackStatus.PROCESSING_SUCCEEDED,
      exports.TrackStatus.PROCESSING_FAILED),
    defaultValue: exports.TrackStatus.TO_BE_PROCESSED,
    allowNull: false
  },
  errorMessage: Sequelize.STRING
});

exports.Track = Track;

/**
 * Model: Tracklist
 */
var Tracklist = sequelizeObject.define('Tracklist', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: Sequelize.STRING,
  cover: Sequelize.STRING,
  header: Sequelize.STRING,
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
});

exports.Tracklist = Tracklist;

/**
 * Model: CartItem
 */
var CartItem = sequelizeObject.define('CartItem', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  transactionStarted: Sequelize.BOOLEAN
});

exports.CartItem = CartItem;

User.hasMany(CartItem, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

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
 * Model: Library
 */
var LibraryItem = sequelizeObject.define('LibraryItem', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  }
});
exports.LibraryItem = LibraryItem;

/**
 * Model: Track
 */

LibraryItem.belongsTo(User, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

LibraryItem.belongsTo(Track, {
  foreignKey: {
    name: 'TrackId',
    allowNull: true
  },
  onDelete: 'CASCADE'
});


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
 * Model: Master Price
 */
var MasterPrice = sequelizeObject.define('MasterPrice', {
  price: {
    type: Sequelize.DECIMAL(10, 2),
    autoIncrement: false,
    primaryKey: true
  }
});

exports.MasterPrice = MasterPrice;

/**
 * Model: Currency
 */
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

exports.Currency = Currency;

/**
 * Model: Internationalization
 */
var Internationalization = sequelizeObject.define('Internationalization', {
  country: {
    type: Sequelize.STRING(2),
    primaryKey: true
  }
});

exports.Internationalization = Internationalization;

Internationalization.belongsTo(Currency, {
  foreignKey: {
    name: 'LocalCurrency',
    allowNull: false
  },
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

/**
 * Model: Converted Price
 */
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

Currency.hasMany(ConvertedPrice);

MasterPrice.belongsToMany(Currency, {
  through: ConvertedPrice,
  foreignKey: {
    name: 'MasterPrice',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

exports.ConvertedPrice = ConvertedPrice;

/**
 * Model: Transaction
 */
var Transaction = sequelizeObject.define('Transaction', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  // User currency
  originalPrice: Sequelize.DECIMAL(10, 2),
  // Percentage
  taxPercentagePayed: Sequelize.DECIMAL(10, 2),
  // User currency
  taxAmountPayed: Sequelize.DECIMAL(10, 2),
  // Stripe currency
  transactionCost: Sequelize.DECIMAL(10, 2),
  // Stripe currency (originalPrice - transactionCost - tax)
  finalPrice: Sequelize.DECIMAL(10, 2),
  // Stripe id for the transaction
  merchantTransactionId: Sequelize.STRING
});

Transaction.belongsTo(Track, {
  foreignKey: {
    name: 'ItemId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Track.hasMany(Transaction, {
  foreignKey: {
    name: 'ItemId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Transaction.belongsTo(Currency, {
  foreignKey: {
    name: 'OriginalTransactionCurrencyId',
    allowNull: false
  },
  onDelete: 'RESTRICT'
});

Transaction.belongsTo(Currency, {
  foreignKey: {
    name: 'MerchantTransactionCurrencyId',
    allowNull: false
  },
  onDelete: 'RESTRICT'
});

Transaction.belongsTo(Release, {
  foreignKey: {
    name: 'ReleaseId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Release.hasMany(Transaction, {
  foreignKey: {
    name: 'ReleaseId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Transaction.belongsTo(Release, {
  foreignKey: {
    name: 'ReleaseId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Release.hasMany(Transaction, {
  foreignKey: {
    name: 'ReleaseId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Transaction.belongsTo(Label, {
  foreignKey: {
    name: 'LabelId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Label.hasMany(Transaction, {
  foreignKey: {
    name: 'LabelId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Transaction.belongsTo(Company, {
  foreignKey: {
    name: 'CompanyId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

Company.hasMany(Transaction, {
  foreignKey: {
    name: 'CompanyId',
    allowNull: false
  },
  onDelete: 'NO ACTION'
});

exports.Transaction = Transaction;

/**
 * Track and Release prices
 */
Track.belongsTo(MasterPrice, {
  foreignKey: {
    name: 'Price',
    allowNull: false,
    defaultValue: 1.0
  },
  onDelete: 'CASCADE'
});

Release.belongsTo(MasterPrice, {
  foreignKey: {
    name: 'Price',
    allowNull: true
  },
  onDelete: 'CASCADE'
});

/**
 * A user has an associated currency
 */
User.belongsTo(Currency, {
  foreignKey: {
    name: 'CurrencyId',
    allowNull: false
  },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT'
});

/** 
 * Many to Many association and tables
 */

// User <--> Company
User.belongsToMany(Company, {
  through: 'CompaniesUsers'
});
Company.belongsToMany(User, {
  through: 'CompaniesUsers'
});

// Label <--> Company
Company.belongsToMany(Label, {
  through: 'CompaniesLabels'
});

Label.belongsToMany(Company, {
  through: 'CompaniesLabels'
});

/**
 * Model: LabelsUsers (association for label's owners)
 */
var LabelsUsers = sequelizeObject.define('LabelsUsers', {
  isOwner: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  }
});

// User <--> Labels
User.belongsToMany(Label, {
  through: LabelsUsers
});
Label.belongsToMany(User, {
  through: LabelsUsers
});

// Label <--> DropZoneFile
DropZoneFile.belongsToMany(Label, {
  through: 'DropZoneFilesLabels'
});
Label.belongsToMany(DropZoneFile, {
  through: 'DropZoneFilesLabels'
});

// Label <--> Releases
Release.belongsToMany(Label, {
  through: 'LabelsReleases'
});
Label.belongsToMany(Release, {
  through: 'LabelsReleases'
});

// Release <--> Tracks 
var ReleaseTracks = sequelizeObject.define('ReleaseTracks', {
  position: Sequelize.INTEGER
});

Track.belongsToMany(Release, {
  through: ReleaseTracks
});

Release.belongsToMany(Track, {
  through: ReleaseTracks
});


// Tracks <--> Tracklists 
var TracklistTracks = sequelizeObject.define('TracklistTracks', {
  position: Sequelize.INTEGER
});

Track.belongsToMany(Tracklist, {
  through: TracklistTracks
});

Tracklist.belongsToMany(Track, {
  through: TracklistTracks
});

// Tracklists <--> User
Tracklist.belongsTo(User, {
  foreignKey: {
    name: 'UserId',
    allowNull: false
  },
  onDelete: 'CASCADE'
});

// Artist <--> Tracks (Producer)
var ProducerTracks = sequelizeObject.define('ArtistTracks', {});
Artist.belongsToMany(Track, {
  through: ProducerTracks
});
Track.belongsToMany(Artist, {
  as: 'Producer',
  through: ProducerTracks
});

// Artist <--> Tracks (Remixer)
var RemixerTracks = sequelizeObject.define('RemixerTracks', {});
Artist.belongsToMany(Track, {
  through: RemixerTracks
});
Track.belongsToMany(Artist, {
  as: 'Remixer',
  through: RemixerTracks
});

// User <--> Artists
User.belongsToMany(Artist, {
  through: 'ArtistsUsers'
});
Artist.belongsToMany(User, {
  through: 'ArtistsUsers'
});

// Genre <--> Tracks
Track.belongsToMany(Genre, {
  through: 'GenresTracks'
});
Genre.belongsToMany(Track, {
  through: 'GenresTracks'
});

Release.consolideJSON = function(releaseId, callback) {
  Release.find({
    where: {
      id: releaseId
    },
    attributes: ['id', 'title', 'catalogNumber', 'status'],
    order: 'position',
    include: [{
      model: Track,
      include: [{
        model: Artist,
        as: 'Remixer'
      }, {
        model: Artist,
        as: 'Producer'
      }]
    }, {
      model: Label
    }]
  }).then(function(release) {
    var jsonRelease = JSON.stringify(release);
    release.json = jsonRelease;
    release.save();
    if (callback) {
      callback(jsonRelease);
    }
  });
};

exports.Release = Release;

/**
 * Create database and default entities if do not exist
 **/
sequelizeObject.sync().then(function() {
  Currency.find({
    where: {
      shortname: 'USD'
    }
  }).then(function(currency) {
    if (!currency) {
      Currency.create({
        name: 'United States Dollar',
        shortname: 'USD',
        symbol: '$'
      });
    }
  });
});

exports.DefaultCurrency = 'USD';
