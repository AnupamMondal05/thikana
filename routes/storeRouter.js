const express = require("express");
const storeController = require("../controllers/store");
const bookingController = require("../controllers/booking");
const reviewController = require("../controllers/review");
const storeRouter = express.Router();

storeRouter.get("/", storeController.getIndex);
storeRouter.get("/homes", storeController.getHomes);
storeRouter.get("/homes/:homeId", storeController.getHomeDetails);
storeRouter.get("/bookings", bookingController.getBookings);
storeRouter.get("/bookings/new/:homeId", bookingController.getBookingForm);
storeRouter.post("/bookings", bookingController.postBooking);
storeRouter.get("/bookings/:bookingId", bookingController.getBookingById);
storeRouter.post("/bookings/:bookingId/cancel", bookingController.cancelBooking);
storeRouter.get("/bookings/:bookingId/review", reviewController.getBookingReview);
storeRouter.post("/bookings/:bookingId/review", reviewController.postBookingReview);
storeRouter.get("/reviews/:reviewId", reviewController.getReview);
storeRouter.get("/reviews/:reviewId/edit", reviewController.getEditReview);
storeRouter.post("/reviews/:reviewId/edit", reviewController.postEditReview);
storeRouter.post("/reviews/:reviewId/delete", reviewController.postDeleteReview);
storeRouter.get("/favorite", storeController.getFavoriteList);
storeRouter.post("/favorite", storeController.postAddToFavorite);
storeRouter.post("/favorite/delete/:homeId", storeController.postRemoveFromFavorite);

module.exports = storeRouter;
