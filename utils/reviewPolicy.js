const MIN_COMMENT_LENGTH = 10;
const MAX_COMMENT_LENGTH = 2000;
const CATEGORY_RATINGS = ["cleanliness", "location", "comfort", "value"];

const isEligibleBooking = (booking, now = new Date()) => {
  if (!booking || !["confirmed", "completed"].includes(booking.status)) {
    return false;
  }

  const checkOut = new Date(booking.checkOut);
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  // Booking dates use UTC midnight, so a checkout date is complete only on the following UTC day.
  return Number.isFinite(checkOut.getTime()) && checkOut < startOfToday;
};

const parseRating = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !/^[1-5]$/.test(value)) return null;
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
};

const validateReviewInput = (body = {}) => {
  const rating = parseRating(body.rating);
  if (rating === null) {
    return { error: "Choose an overall rating from 1 to 5." };
  }

  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (comment.length < MIN_COMMENT_LENGTH) {
    return { error: `Please write at least ${MIN_COMMENT_LENGTH} characters of feedback.` };
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { error: `Feedback must be no more than ${MAX_COMMENT_LENGTH} characters.` };
  }

  const values = { rating, comment };
  for (const category of CATEGORY_RATINGS) {
    const input = body[category];
    if (input === undefined || input === "") continue;
    const categoryRating = parseRating(input);
    if (categoryRating === null) {
      return { error: `Choose a ${category} rating from 1 to 5 or leave it blank.` };
    }
    values[category] = categoryRating;
  }

  return { values };
};

module.exports = {
  CATEGORY_RATINGS,
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  isEligibleBooking,
  validateReviewInput
};
