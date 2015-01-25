var Sequelize       = require('sequelize');
var bcrypt          = require('bcryptjs');

var config          = rootRequire('config/config');

var sequelizeObject = new Sequelize(config.MYSQL_DATABASE, config.MYSQL_USER, config.MYSQL_PASSWORD, {
  host: config.MYSQL_HOST,
  // logging: false,
  dialect: 'mysql'
});

exports.Sequelize = Sequelize;

exports.sequelize = function(){
	return sequelizeObject;
};
 
/*
 INITIALIZE ALL THE MODELS
 */

/* 
	Model: User

*/

var User = sequelizeObject.define('User', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
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
  isAdmin: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false},
  isActive: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true}  // TODO Set to FALSE and ask for email confirmation.
  }, {
    instanceMethods: {
      comparePassword : function(password)  { 
        return bcrypt.compareSync(password,this.password)
      }
    }
  }
);

User.hook('beforeValidate', function(user, fn) {
    if(!user.avatar){
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
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
  displayName: Sequelize.STRING,
  isActive: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
  logo: Sequelize.STRING
  }
);
exports.Company = Company;

/* 
	Model: Label
*/

var Label = sequelizeObject.define('Label', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
  displayName: Sequelize.STRING,
  isActive: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
  logo: Sequelize.STRING,
  fullSizeLogo: Sequelize.STRING
  }
);
exports.Label = Label;

/* 
  Model: DropZoneFile
*/

var DropZoneFile = sequelizeObject.define('DropZoneFile', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true }, 
  fileName: Sequelize.STRING,
  extension: Sequelize.STRING,
  md5: Sequelize.STRING,
  path: Sequelize.STRING,
  size: Sequelize.BIGINT
  }
);



exports.DropZoneFile = DropZoneFile;
/* 
	Artist
*/ 

var Artist = sequelizeObject.define('Artist', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
  displayName: Sequelize.STRING,
  avatar: Sequelize.STRING,
  fullSizeAvatar: Sequelize.STRING,
  }
);
exports.Artist = Artist;

/* 
	Artist
*/ 

var Release = sequelizeObject.define('Release', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
  title: Sequelize.STRING,
  releaseDate: Sequelize.DATE,
  isActive: {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},
  cover: Sequelize.STRING,
  catalogNumber: Sequelize.STRING,
  UPC: Sequelize.STRING,
  GRid: Sequelize.STRING,
  description: Sequelize.STRING,
  type: Sequelize.ENUM('release', 'album','compilation')
  }
);

exports.Release = Release;
 

var Track = sequelizeObject.define('Track', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },	
  title: Sequelize.STRING,
  version: Sequelize.STRING,
  cover: Sequelize.STRING
  }
);
exports.Track = Track;


/* 
	Many to Many association and tables
*/ 

// User <--> Company
User.hasMany(Company)
Company.hasMany(User)
// Label <--> Company
Company.hasMany(Label)
Label.hasMany(Company)
// User <--> Labels
User.hasMany(Label)
Label.hasMany(User)
 
// Label <--> DropZoneFile

DropZoneFile.hasMany(Label)
Label.hasMany(DropZoneFile)


// Label <--> Releases
Release.hasMany(Label)
Label.hasMany(Release)
// Release <--> Tracks 
ReleaseTracks = sequelizeObject.define('ReleaseTracks', {
    position: Sequelize.INTEGER
})

Track.hasMany(Release, { through: ReleaseTracks })
Release.hasMany(Track, { through: ReleaseTracks })

// ARTIST AS PRODCUER of a TRACK     (artist <--> track) 
ProducerTracks = sequelizeObject.define('ArtistTracks', {})
Artist.hasMany(Track, {through: ProducerTracks })
Track.hasMany(Artist, { as: 'Producer', through: ProducerTracks })

// ARTIST AS REMIXER of a TRACK     (artist <--> track) 
RemixerTracks = sequelizeObject.define('RemixerTracks', {})
Artist.hasMany(Track, {through: RemixerTracks })
Track.hasMany(Artist, { as: 'Remixer', through: RemixerTracks })

//Artist ownership by users
Artist.hasMany(User) 
User.hasMany(Artist) 


//sequelizeObject.sync();