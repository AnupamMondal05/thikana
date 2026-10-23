const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Home = require("../models/home");
const Review = require("../models/review");
const User = require("../models/user");
const { getReviewCsrfToken, isValidReviewCsrfToken } = require("../utils/reviewCsrf");
const { isEligibleBooking, validateReviewInput } = require("../utils/reviewPolicy");

const requireGuest = async (req, res) => {
  if (!req.session.isLoggedIn || !req.session.userId) {
    res.redirect("/login");
    return null;
  }

  const user = await User.findById(req.session.userId).select("-password");
  if (!user) {
    res.redirect("/login");
    return null;
  }
  if (user.userType !== "guest") {
    res.status(403).send("Forbidden");
    return null;
  }
  return user;
};

const renderReviewForm = (res, req, user, booking, review, formData = {}, errorMessage = "", status = 200) => {
  res.status(status).render("store/review-form", {
    pageTitle: review ? "Edit your review" : "Review your stay",
    currentPage: "bookings",
    isLoggedIn: req.isLoggedIn,
    user,
    booking,
    review,
    formData: {
      rating: formData.rating ?? review?.rating ?? "",
      comment: formData.comment ?? review?.comment ?? "",
      cleanliness: formData.cleanliness ?? review?.cleanliness ?? "",
      location: formData.location ?? review?.location ?? "",
      comfort: formData.comfort ?? review?.comfort ?? "",
      value: formData.value ?? review?.value ?? ""
    },
    reviewCsrfToken: getReviewCsrfToken(req),
    errorMessage
  });
};

const renderNotFound = (res, req, user) => res.status(404).render("404", {
  pageTitle: "Review Not Found",
  currentPage: "404",
  isLoggedIn: req.isLoggedIn,
  user
});

const validId = (value) => mongoose.isObjectIdOrHexString(value);

const getOwnedBooking = async (bookingId, userId) => {
  if (!validId(bookingId)) return null;
  return Booking.findOne({ _id: bookingId, user: userId }).populate("home");
};

const getOwnedReview = async (reviewId, userId) => {
  if (!validId(reviewId)) return null;
  const review = await Review.findOne({ _id: reviewId, author: userId });
  if (!review) return null;

  const booking = await Booking.findOne({ _id: review.booking, user: userId }).populate("home");
  if (!booking || !booking.home || booking.home._id.toString() !== review.home.toString()) return null;
  return { review, booking };
};

exports.getBookingReview = async (req, res, next) => {
  try {
    const user = await requireGuest(req, res);
    if (!user) return;

    const booking = await getOwnedBooking(req.params.bookingId, user._id);
    if (!booking || !booking.home) return renderNotFound(res, req, user);
    if (!isEligibleBooking(booking)) {
      return res.redirect(`/bookings?error=${encodeURIComponent("You can review a stay after its checkout date.")}`);
    }

    const review = await Review.findOne({ booking: booking._id });
    if (review) {
      if (review.author.toString() !== user._id.toString()) {
        return res.status(403).send("Forbidden");
      }
      return res.redirect(`/reviews/${review._id}/edit`);
    }

    return renderReviewForm(res, req, user, booking, null);
  } catch (err) {
    next(err);
  }
};

exports.postBookingReview = async (req, res, next) => {
  try {
    const user = await requireGuest(req, res);
    if (!user) return;
    if (!isValidReviewCsrfToken(req)) {
      return res.status(403).send("This review form has expired. Reload the page and try again.");
    }

    const booking = await getOwnedBooking(req.params.bookingId, user._id);
    if (!booking || !booking.home) return renderNotFound(res, req, user);
    if (!isEligibleBooking(booking)) {
      return res.redirect(`/bookings?error=${encodeURIComponent("You can review a stay after its checkout date.")}`);
    }

    const existingReview = await Review.findOne({ booking: booking._id });
    if (existingReview) {
      if (existingReview.author.toString() !== user._id.toString()) {
        return res.status(403).send("Forbidden");
      }
      return res.redirect(`/reviews/${existingReview._id}/edit`);
    }

    const validation = validateReviewInput(req.body);
    if (validation.error) {
      return renderReviewForm(res, req, user, booking, null, req.body, validation.error, 422);
    }

    await Review.create({
      ...validation.values,
      home: booking.home._id,
      author: user._id,
      booking: booking._id
    });
    return res.redirect(`/homes/${booking.home._id}?reviewStatus=submitted#reviews`);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.redirect(`/bookings?error=${encodeURIComponent("A review has already been submitted for this stay.")}`);
    }
    next(err);
  }
};

exports.getEditReview = async (req, res, next) => {
  try {
    const user = await requireGuest(req, res);
    if (!user) return;

    const ownedReview = await getOwnedReview(req.params.reviewId, user._id);
    if (!ownedReview) return renderNotFound(res, req, user);
    const { review, booking } = ownedReview;
    if (!isEligibleBooking(booking)) {
      return res.redirect(`/bookings?error=${encodeURIComponent("This stay is no longer eligible for review changes.")}`);
    }

    return renderReviewForm(res, req, user, booking, review);
  } catch (err) {
    next(err);
  }
};

exports.postEditReview = async (req, res, next) => {
  try {
    const user = await requireGuest(req, res);
    if (!user) return;
    if (!isValidReviewCsrfToken(req)) {
      return res.status(403).send("This review form has expired. Reload the page and try again.");
    }

    const ownedReview = await getOwnedReview(req.params.reviewId, user._id);
    if (!ownedReview) return renderNotFound(res, req, user);
    const { review, booking } = ownedReview;
    if (!isEligibleBooking(booking)) {
      return res.redirect(`/bookings?error=${encodeURIComponent("This stay is no longer eligible for review changes.")}`);
    }

    const validation = validateReviewInput(req.body);
    if (validation.error) {
      return renderReviewForm(res, req, user, booking, review, req.body, validation.error, 422);
    }

    Object.assign(review, validation.values);
    await review.save();
    return res.redirect(`/homes/${review.home}?reviewStatus=updated#reviews`);
  } catch (err) {
    next(err);
  }
};

exports.postDeleteReview = async (req, res, next) => {
  try {
    const user = await requireGuest(req, res);
    if (!user) return;
    if (!isValidReviewCsrfToken(req)) {
      return res.status(403).send("This review form has expired. Reload the page and try again.");
    }

    if (!validId(req.params.reviewId)) return renderNotFound(res, req, user);
    const review = await Review.findOne({ _id: req.params.reviewId, author: user._id });
    if (!review) return renderNotFound(res, req, user);

    await review.deleteOne();
    return res.redirect(`/homes/${review.home}?reviewStatus=deleted#reviews`);
  } catch (err) {
    next(err);
  }
};

exports.getReview = async (req, res, next) => {
  try {
    if (!validId(req.params.reviewId)) return res.redirect("/homes");
    const review = await Review.findById(req.params.reviewId).select("home createdAt");
    if (!review) return res.redirect("/homes");

    const precedingReviews = await Review.countDocuments({
      home: review.home,
      $or: [
        { createdAt: { $gt: review.createdAt } },
        { createdAt: review.createdAt, _id: { $gt: review._id } }
      ]
    });
    const page = Math.floor(precedingReviews / 10) + 1;
    return res.redirect(`/homes/${review.home}?page=${page}#review-${review._id}`);
  } catch (err) {
    next(err);
  }
};

exports.getHostReviews = async (req, res, next) => {
  try {
    const host = await User.findById(req.session.userId).select("-password");
    if (!host) return res.redirect("/login");
    if (host.userType !== "host") return res.status(403).send("Forbidden");

    const homes = await Home.find({ owner: host._id }).select("houseName location");
    const homeIds = homes.map((home) => home._id);
    const pageValue = typeof req.query.page === "string" && /^\d+$/.test(req.query.page) ? Number(req.query.page) : 1;
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const pageSize = 10;
    const totalReviews = homeIds.length ? await Review.countDocuments({ home: { $in: homeIds } }) : 0;
    const totalPages = Math.max(1, Math.ceil(totalReviews / pageSize));
    const currentPage = Math.min(page, totalPages);
    const reviews = homeIds.length ? await Review.find({ home: { $in: homeIds } })
      .populate("author", "firstName")
      .populate("home", "houseName location")
      .sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize) : [];

    return res.render("host/reviews", {
      pageTitle: "Guest feedback",
      currentPage: "host-reviews",
      isLoggedIn: req.isLoggedIn,
      user: host,
      reviews,
      totalReviews,
      currentPageNumber: currentPage,
      totalPages
    });
  } catch (err) {
    next(err);
  }
};
