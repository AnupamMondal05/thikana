const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Home = require("../models/home");
const Review = require("../models/review");
const User = require("../models/user");
const reviewController = require("../controllers/review");
const storeController = require("../controllers/store");
const ejs = require("ejs");
const path = require("node:path");
const { isEligibleBooking, validateReviewInput } = require("../utils/reviewPolicy");

const fixedNow = new Date("2026-10-23T12:00:00.000Z");
const currentUtcDay = new Date();
currentUtcDay.setUTCHours(0, 0, 0, 0);
const yesterday = new Date(currentUtcDay);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const tomorrow = new Date(currentUtcDay);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const guestId = new mongoose.Types.ObjectId();
const hostId = new mongoose.Types.ObjectId();
const homeId = new mongoose.Types.ObjectId();
const bookingId = new mongoose.Types.ObjectId();
const reviewId = new mongoose.Types.ObjectId();
const csrfToken = "review-test-token";

const makeBooking = (status = "confirmed", checkOut = yesterday) => ({
  _id: bookingId,
  user: guestId,
  home: { _id: homeId, houseName: "Forest Hideaway", location: "Munnar" },
  status,
  checkIn: new Date("2026-10-20T00:00:00.000Z"),
  checkOut: new Date(checkOut)
});

const makeResponse = () => ({
  statusCode: 200,
  redirectTo: "",
  rendered: null,
  sent: "",
  status(code) { this.statusCode = code; return this; },
  redirect(url) { this.redirectTo = url; return this; },
  render(view, locals) { this.rendered = { view, locals }; return this; },
  send(message) { this.sent = message; return this; }
});

const originalMethods = {
  findUser: User.findById,
  findBooking: Booking.findOne,
  findReview: Review.findOne,
  createReview: Review.create
};

let currentUser;
let currentBooking;
let currentReview;
let createdReview;
let findReviewQuery;
let findBookingQuery;

const configureMocks = () => {
  currentUser = { _id: guestId, userType: "guest" };
  currentBooking = makeBooking();
  currentReview = null;
  createdReview = null;
  findReviewQuery = null;
  findBookingQuery = null;
  User.findById = () => ({ select: async () => currentUser });
  Booking.findOne = (query) => {
    findBookingQuery = query;
    return { populate: async () => currentBooking };
  };
  Review.findOne = (query) => {
    findReviewQuery = query;
    return Promise.resolve(currentReview);
  };
  Review.create = async (data) => {
    createdReview = data;
    return { _id: reviewId };
  };
};

const restoreMocks = () => {
  User.findById = originalMethods.findUser;
  Booking.findOne = originalMethods.findBooking;
  Review.findOne = originalMethods.findReview;
  Review.create = originalMethods.createReview;
};

test("review policy requires a confirmed/completed booking after its checkout day", () => {
  assert.equal(isEligibleBooking(makeBooking("confirmed", "2026-10-22"), fixedNow), true);
  assert.equal(isEligibleBooking(makeBooking("completed", "2026-10-22"), fixedNow), true);
  assert.equal(isEligibleBooking(makeBooking("confirmed", "2026-10-23"), fixedNow), false);
  assert.equal(isEligibleBooking(makeBooking("confirmed", "2026-10-24"), fixedNow), false);
  assert.equal(isEligibleBooking(makeBooking("cancelled", "2026-10-20"), fixedNow), false);
  assert.equal(isEligibleBooking(makeBooking("pending", "2026-10-20"), fixedNow), false);
  assert.equal(isEligibleBooking(makeBooking("completed", "not a date"), fixedNow), false);
});

test("review input validation trims feedback and accepts optional category ratings", () => {
  assert.deepEqual(validateReviewInput({
    rating: "5",
    comment: "  A thoughtful and comfortable stay.  ",
    cleanliness: "5",
    location: "",
    comfort: "4",
    value: "3"
  }), {
    values: {
      rating: 5,
      comment: "A thoughtful and comfortable stay.",
      cleanliness: 5,
      comfort: 4,
      value: 3
    }
  });
  assert.match(validateReviewInput({ rating: "0", comment: "Valid feedback." }).error, /rating from 1 to 5/);
  assert.match(validateReviewInput({ rating: "4.5", comment: "Valid feedback." }).error, /rating from 1 to 5/);
  assert.match(validateReviewInput({ rating: "4", comment: "  " }).error, /at least 10 characters/);
  assert.match(validateReviewInput({ rating: "4", comment: "x".repeat(2001) }).error, /no more than 2000/);
  assert.match(validateReviewInput({ rating: "4", comment: "Valid feedback.", comfort: "6" }).error, /comfort rating/);
});

test("review schema validates bounds and declares a unique booking index", async () => {
  const index = Review.schema.indexes().find(([fields, options]) => fields.booking === 1 && options.unique);
  assert.ok(index, "a unique index must prevent more than one review per booking");

  const review = new Review({
    home: homeId,
    author: guestId,
    booking: bookingId,
    rating: 6,
    comment: "Valid enough review text"
  });
  await assert.rejects(review.validate(), (error) => Boolean(error.errors.rating));

  const validReview = new Review({
    home: homeId,
    author: guestId,
    booking: bookingId,
    rating: 5,
    comment: "  A thoughtful and comfortable stay.  "
  });
  await validReview.validate();
  assert.equal(validReview.comment, "A thoughtful and comfortable stay.");
});

test("review submission rejects unauthenticated and non-guest requests", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  const unauthenticatedResponse = makeResponse();
  await reviewController.postBookingReview({ session: {}, body: {}, isLoggedIn: false }, unauthenticatedResponse, assert.fail);
  assert.equal(unauthenticatedResponse.redirectTo, "/login");

  currentUser = { _id: hostId, userType: "host" };
  const hostResponse = makeResponse();
  await reviewController.postBookingReview({ session: { isLoggedIn: true, userId: hostId }, body: {}, isLoggedIn: true }, hostResponse, assert.fail);
  assert.equal(hostResponse.statusCode, 403);
  assert.equal(createdReview, null);

  currentUser = { _id: guestId, userType: "guest" };
  const csrfResponse = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    body: { _csrf: "invalid-token" },
    isLoggedIn: true
  }, csrfResponse, assert.fail);
  assert.equal(csrfResponse.statusCode, 403);
  assert.equal(createdReview, null);
});

test("eligible guest review form issues a session-bound CSRF token", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  const session = { isLoggedIn: true, userId: guestId };
  const response = makeResponse();
  await reviewController.getBookingReview({
    session,
    isLoggedIn: true,
    params: { bookingId },
    query: {}
  }, response, assert.fail);
  assert.equal(response.statusCode, 200);
  assert.equal(response.rendered.view, "store/review-form");
  assert.equal(typeof session.reviewCsrfToken, "string");
  assert.equal(session.reviewCsrfToken.length, 64);
});

test("review submission rejects invalid, future and cancelled bookings", async (t) => {
  configureMocks();
  t.after(restoreMocks);

  const invalidResponse = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { bookingId },
    body: { _csrf: csrfToken, rating: "0", comment: "Invalid rating feedback" }
  }, invalidResponse, assert.fail);
  assert.equal(invalidResponse.statusCode, 422);
  assert.equal(createdReview, null);

  for (const booking of [makeBooking("cancelled"), makeBooking("confirmed", tomorrow)]) {
    currentBooking = booking;
    const response = makeResponse();
    await reviewController.postBookingReview({
      session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
      isLoggedIn: true,
      params: { bookingId },
      body: { _csrf: csrfToken, rating: "5", comment: "A useful and valid review." }
    }, response, assert.fail);
    assert.match(response.redirectTo, /^\/bookings\?error=/);
  }
  assert.equal(createdReview, null);
});

test("review submission requires a booking owned by the signed-in guest", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  currentBooking = null;
  const response = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { bookingId },
    body: { _csrf: csrfToken, rating: "5", comment: "A lovely place and a restful stay." }
  }, response, assert.fail);
  assert.equal(response.statusCode, 404);
  assert.equal(findBookingQuery.user, guestId);
  assert.equal(createdReview, null);
});

test("valid review submission uses only the signed-in guest and owned booking data", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  const response = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { bookingId },
    body: {
      _csrf: csrfToken,
      rating: "4",
      comment: "A lovely place and a restful stay.",
      home: new mongoose.Types.ObjectId().toString(),
      author: new mongoose.Types.ObjectId().toString(),
      booking: new mongoose.Types.ObjectId().toString()
    }
  }, response, assert.fail);

  assert.equal(createdReview.author, guestId);
  assert.equal(createdReview.booking, bookingId);
  assert.equal(createdReview.home, homeId);
  assert.equal(findBookingQuery._id, bookingId);
  assert.equal(findBookingQuery.user, guestId);
  assert.equal(createdReview.rating, 4);
  assert.equal(response.redirectTo, `/homes/${homeId}?reviewStatus=submitted#reviews`);
});

test("duplicate review requests redirect to the existing review and handle unique-index races", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  currentReview = { _id: reviewId, author: guestId };
  const existingResponse = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { bookingId },
    body: { _csrf: csrfToken, rating: "5", comment: "A lovely place and a restful stay." }
  }, existingResponse, assert.fail);
  assert.equal(existingResponse.redirectTo, `/reviews/${reviewId}/edit`);
  assert.equal(createdReview, null);

  currentReview = null;
  Review.create = async () => { throw { code: 11000 }; };
  const raceResponse = makeResponse();
  await reviewController.postBookingReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { bookingId },
    body: { _csrf: csrfToken, rating: "5", comment: "A lovely place and a restful stay." }
  }, raceResponse, assert.fail);
  assert.match(raceResponse.redirectTo, /^\/bookings\?error=/);
});

test("edit and delete lookups are scoped to the authenticated author", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  Review.findOne = (query) => {
    findReviewQuery = query;
    return Promise.resolve(currentReview);
  };
  const absentResponse = makeResponse();
  await reviewController.getEditReview({
    session: { isLoggedIn: true, userId: guestId },
    isLoggedIn: true,
    params: { reviewId }
  }, absentResponse, assert.fail);
  assert.equal(findReviewQuery.author, guestId);
  assert.equal(absentResponse.statusCode, 404);

  currentUser = { _id: hostId, userType: "host" };
  const hostDeleteResponse = makeResponse();
  await reviewController.postDeleteReview({
    session: { isLoggedIn: true, userId: hostId },
    isLoggedIn: true,
    params: { reviewId }
  }, hostDeleteResponse, assert.fail);
  assert.equal(hostDeleteResponse.statusCode, 403);
});

test("review authors can edit and delete their own review", async (t) => {
  configureMocks();
  t.after(restoreMocks);
  let saved = false;
  let deleted = false;
  currentReview = {
    _id: reviewId,
    home: homeId,
    booking: bookingId,
    rating: 3,
    comment: "An older review that can be updated.",
    save: async function () { saved = true; },
    deleteOne: async () => { deleted = true; }
  };
  Review.findOne = (query) => {
    findReviewQuery = query;
    return Promise.resolve(currentReview);
  };

  const editResponse = makeResponse();
  await reviewController.postEditReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { reviewId },
    body: { _csrf: csrfToken, rating: "5", comment: "A lovely place and a restful stay." }
  }, editResponse, assert.fail);
  assert.equal(findReviewQuery.author, guestId);
  assert.equal(saved, true);
  assert.equal(currentReview.rating, 5);
  assert.equal(editResponse.redirectTo, `/homes/${homeId}?reviewStatus=updated#reviews`);

  const deleteResponse = makeResponse();
  await reviewController.postDeleteReview({
    session: { isLoggedIn: true, userId: guestId, reviewCsrfToken: csrfToken },
    isLoggedIn: true,
    params: { reviewId },
    body: { _csrf: csrfToken }
  }, deleteResponse, assert.fail);
  assert.equal(findReviewQuery.author, guestId);
  assert.equal(deleted, true);
  assert.equal(deleteResponse.redirectTo, `/homes/${homeId}?reviewStatus=deleted#reviews`);
});

test("property review summaries use aggregate records and render a genuine empty state", async (t) => {
  const originalHomeFind = Home.findById;
  const originalAggregate = Review.aggregate;
  const originalReviewFind = Review.find;
  t.after(() => {
    Home.findById = originalHomeFind;
    Review.aggregate = originalAggregate;
    Review.find = originalReviewFind;
  });

  const home = {
    _id: homeId,
    houseName: "Forest Hideaway",
    location: "Munnar",
    price: 4500,
    photos: [],
    photo: "/stay.jpg",
    description: "A quiet place.",
    maxGuests: 2
  };
  Home.findById = () => ({ populate: async () => home });
  let aggregatePipeline;
  Review.aggregate = async (pipeline) => {
    aggregatePipeline = pipeline;
    return [{
      summary: [{ count: 2, average: 4.25 }],
      distribution: [{ _id: 4, count: 1 }, { _id: 5, count: 1 }]
    }];
  };
  const reviewCard = {
    _id: reviewId,
    author: { _id: guestId, firstName: "Asha" },
    rating: 5,
    comment: "A lovely place and a restful stay.",
    createdAt: new Date("2026-10-22T12:00:00.000Z")
  };
  Review.find = () => ({
    populate() { return this; },
    sort() { return this; },
    skip() { return this; },
    limit: async () => [reviewCard]
  });

  const response = makeResponse();
  await storeController.getHomeDetails({
    params: { homeId },
    query: {},
    session: {},
    isLoggedIn: false
  }, response, assert.fail);
  assert.equal(response.rendered.locals.reviewSummary.average, 4.3);
  assert.equal(response.rendered.locals.reviewSummary.count, 2);
  assert.equal(response.rendered.locals.reviewSummary.distribution[1], 0);
  assert.equal(response.rendered.locals.reviewSummary.distribution[4], 1);
  assert.equal(response.rendered.locals.reviews[0], reviewCard);
  assert.equal(aggregatePipeline[1].$facet.summary[0].$group.average.$avg, "$rating");

  Review.aggregate = async () => [{ summary: [], distribution: [] }];
  Review.find = () => { throw new Error("No review query should run for an empty property"); };
  const emptyResponse = makeResponse();
  await storeController.getHomeDetails({
    params: { homeId },
    query: {},
    session: {},
    isLoggedIn: false
  }, emptyResponse, assert.fail);
  assert.deepEqual(emptyResponse.rendered.locals.reviewSummary, {
    average: null,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const html = await ejs.renderFile(path.join(process.cwd(), "views", "store", "home-detail.ejs"), {
    ...emptyResponse.rendered.locals,
    pageTitle: "Stay",
    currentPage: "Home",
    isLoggedIn: false,
    user: null,
    reviewStatus: "",
    currentReviewPage: 1,
    totalReviewPages: 1
  });
  assert.match(html, /No reviews yet/);
});

test("viewing a review redirects to its paginated property card", async (t) => {
  const originalFindById = Review.findById;
  const originalCountDocuments = Review.countDocuments;
  t.after(() => {
    Review.findById = originalFindById;
    Review.countDocuments = originalCountDocuments;
  });

  const review = { home: homeId, _id: reviewId, createdAt: new Date("2026-10-22T12:00:00.000Z") };
  Review.findById = () => ({ select: async () => review });
  Review.countDocuments = async (query) => {
    assert.equal(query.home, homeId);
    return 12;
  };

  const response = makeResponse();
  await reviewController.getReview({ params: { reviewId } }, response, assert.fail);
  assert.equal(response.redirectTo, `/homes/${homeId}?page=2#review-${reviewId}`);
});
