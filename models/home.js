const mongoose = require("mongoose");


const homeSchema= new mongoose.Schema({
  houseName : {type:String,required:true},
  price : {type:Number,required:true},
  location : {type:String,required:true},
  rating:{type:Number,required:true},
  photo : String,
  photos: {
    type: [String],
    default: []
  },
  description: String,
  maxGuests: {
    type: Number,
    required: true,
    min: 1,
    default: 2
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  }
})

// to ensure when we delete any home , it should also deleted from favourite
// homeSchema.pre('findOneAndDelete', async function() {
//   console.log('Came to pre hook while deleting a home');
//   const homeId = this.getQuery()._id;
//   await favorite.deleteMany({houseId: homeId});
 
// });

module.exports=mongoose.model('Home',homeSchema);