const express = require("express");
const hostController = require("../controllers/host");
const bookingController = require("../controllers/booking");
const reviewController = require("../controllers/review");
const upload = require("../utils/upload");
const hostRouter = express.Router();

hostRouter.get("/add-home", hostController.getAddHome);
hostRouter.post("/add-home", upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "photos", maxCount: 8 }
]), upload.validateFileContent, hostController.postAddHome);
hostRouter.get("/host-home-list", hostController.getHostHomes);
hostRouter.get("/edit-home/:homeId", hostController.getEditHome);
hostRouter.post("/edit-home", upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "photos", maxCount: 8 }
]), upload.validateFileContent, hostController.postEditHome);
hostRouter.post("/delete-home/:homeId", hostController.postDeleteHome);
hostRouter.get("/bookings", bookingController.getHostBookings);
hostRouter.get("/reviews", reviewController.getHostReviews);

module.exports = hostRouter;
