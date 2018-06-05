var mongoose = require('mongoose'),
	bcrypt = require('bcrypt'),
	SALT_FACTOR = 10;

//Declare the Schema
var userSchema = new mongoose.Schema({
	name: { type: String,
		required: true,
		index: {
			unique: true
		       }
	      },
	password: { type: String, required: true},
	created_on: { type: Date, default: Date.now}
 });

// Add hashing Middleware to Schema
userSchema.pre("save", function(next){
	var user = this;

	//Only hash password if it has been modified ( or is new )
	if(!user.isModified("password")) return next();

	//Generate a salt
	bcrypt.genSalt(SALT_FACTOR, function(err, salt){
		if(err) return next(err);

		//Hash the password using the new salt
		bcrypt.hash(user.password, salt, function(err, hash){
			if(err) return next(err);

			//Override the cleartext password with hashed one
			user.password = hash;
			next();
		});
	});
});

// Add comare method to Schema
userSchema.methods.comparePassword = function(candidatePassword, next) {
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch){
		if(err) return cb(err);
		next(null, isMatch);
	});
};

mongoose.model("User", userSchema);
