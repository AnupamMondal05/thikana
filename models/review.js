const mongoose = require("mongoose");

const ratingValidator = {
  validator: Number.isInteger,
  message: "Ratings must be whole numbers from 1 to 5."
};

const reviewSchema = new mongoose.Schema({
  home: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Home",
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
    index: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
    unique: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: ratingValidator
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  cleanliness: { type: Number, min: 1, max: 5, validate: ratingValidator },
  location: { type: Number, min: 1, max: 5, validate: ratingValidator },
  comfort: { type: Number, min: 1, max: 5, validate: ratingValidator },
  value: { type: Number, min: 1, max: 5, validate: ratingValidator }
}, { timestamps: true });

reviewSchema.index({ home: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
