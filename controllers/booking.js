const Booking = require("../models/booking");
const Home = require("../models/home");
const Review = require("../models/review");
const User = require("../models/user");
const { isEligibleBooking } = require("../utils/reviewPolicy");

const formatCurrency = (value) => `₹${Number(value).toLocaleString("en-IN")}`;

const getUser = async (req) => {
  if (!req.session.userId) {
    return null;
  }

  return User.findById(req.session.userId).select("-password");
};

const requireRole = async (req, res, role) => {
  if (!req.session.isLoggedIn || !req.session.userId) {
    res.redirect("/login");
    return null;
  }

  const user = await getUser(req);
  if (!user) {
    res.redirect("/login");
    return null;
  }
  if (user.userType !== role) {
    res.status(403).send("Forbidden");
    return null;
  }
  return user;
};

const getDateRange = (checkInValue, checkOutValue) => {
  const parseDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date
      : null;
  };

  const checkIn = parseDate(checkInValue);
  const checkOut = parseDate(checkOutValue);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (!checkIn) {
    return { error: "Please select a valid check-in date." };
  }
  if (!checkOut) {
    return { error: "Please select a valid check-out date." };
  }
  if (checkIn < today) {
    return { error: "Check-in date cannot be in the past." };
  }
  if (checkOut <= checkIn) {
    return { error: "Check-out must be after check-in." };
  }

  const nights = (checkOut - checkIn) / (1000 * 60 * 60 * 24);
  return { checkIn, checkOut, nights };
};

const getGuestCount = (value, home) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return { error: "Enter a valid number of guests." };
  }

  const guestTotal = Number(value);
  if (!Number.isSafeInteger(guestTotal) || guestTotal < 1) {
    return { error: "Enter a valid number of guests." };
  }
  if (home.maxGuests && guestTotal > home.maxGuests) {
    return { error: `This property can accommodate only ${home.maxGuests} guests.` };
  }
  return { guestTotal };
};

const findOverlap = (homeId, checkIn, checkOut) => Booking.findOne({
  home: homeId,
  status: { $ne: "cancelled" },
  checkIn: { $lt: checkOut },
  checkOut: { $gt: checkIn }
});

const renderBookingPage = async (req, res, user, home, formData, summary, errorMessage) => {
  res.render("store/reserve", {
    pageTitle: "Book your stay",
    currentPage: "bookings",
    isLoggedIn: req.isLoggedIn,
    user,
    home,
    formData,
    summary,
    errorMessage,
    formatCurrency
  });
};

exports.getBookingForm = async (req, res, next) => {
  try {
    const user = await requireRole(req, res, "guest");
    if (!user) return;

    const home = await Home.findById(req.params.homeId);
    if (!home) {
      return res.redirect("/homes");
    }

    const { checkIn, checkOut, guests } = req.query;
    const formData = {
      checkIn: typeof checkIn === "string" ? checkIn : "",
      checkOut: typeof checkOut === "string" ? checkOut : "",
      guests: typeof guests === "string" ? guests : "2"
    };
    let summary = null;
    let errorMessage = "";

    if (formData.checkIn || formData.checkOut || req.query.guests) {
      const dateRange = getDateRange(formData.checkIn, formData.checkOut);
      if (dateRange.error) {
        errorMessage = dateRange.error;
      } else {
        const guestData = getGuestCount(formData.guests, home);
        if (guestData.error) {
          errorMessage = guestData.error;
        } else if (await findOverlap(home._id, dateRange.checkIn, dateRange.checkOut)) {
          errorMessage = "Property is unavailable for the selected dates.";
        } else {
          const totalPrice = home.price * dateRange.nights;
          summary = {
            homeName: home.houseName,
            location: home.location,
            checkIn: dateRange.checkIn,
            checkOut: dateRange.checkOut,
            nights: dateRange.nights,
            guests: guestData.guestTotal,
            totalPrice,
            formattedPrice: formatCurrency(totalPrice)
          };
        }
      }
    }

    await renderBookingPage(req, res, user, home, formData, summary, errorMessage);
  } catch (err) {
    next(err);
  }
};

exports.postBooking = async (req, res, next) => {
  try {
    const user = await requireRole(req, res, "guest");
    if (!user) return;

    const { homeId, checkIn, checkOut, guests } = req.body;
    if (typeof homeId !== "string") {
      return res.redirect("/homes");
    }
    const home = await Home.findById(homeId);
    if (!home) {
      return res.redirect("/homes");
    }

    const formData = {
      checkIn: typeof checkIn === "string" ? checkIn : "",
      checkOut: typeof checkOut === "string" ? checkOut : "",
      guests: typeof guests === "string" ? guests : ""
    };
    const renderError = (message) => renderBookingPage(req, res, user, home, formData, null, message);
    const dateRange = getDateRange(formData.checkIn, formData.checkOut);
    if (dateRange.error) {
      return renderError(dateRange.error);
    }
    const guestData = getGuestCount(formData.guests, home);
    if (guestData.error) {
      return renderError(guestData.error);
    }
    if (await findOverlap(home._id, dateRange.checkIn, dateRange.checkOut)) {
      return renderError("Property is unavailable for the selected dates.");
    }

    const totalPrice = home.price * dateRange.nights;
    const booking = await Booking.create({
      user: user._id,
      home: home._id,
      checkIn: dateRange.checkIn,
      checkOut: dateRange.checkOut,
      guests: guestData.guestTotal,
      totalPrice,
      status: "confirmed"
    });
    return res.redirect(`/bookings/${booking._id}`);
  } catch (err) {
    next(err);
  }
};

exports.getBookings = async (req, res, next) => {
  try {
    const user = await requireRole(req, res, "guest");
    if (!user) return;

    const bookings = await Booking.find({ user: user._id }).populate("home").sort({ checkIn: 1 });
    const reviews = await Review.find({ author: user._id, booking: { $in: bookings.map((booking) => booking._id) } })
      .select("booking");
    const reviewsByBooking = new Map(reviews.map((review) => [review.booking.toString(), review._id]));
    const reviewStatusByBooking = Object.fromEntries(bookings.map((booking) => {
      const bookingId = booking._id.toString();
      return [bookingId, {
        eligible: isEligibleBooking(booking),
        reviewId: reviewsByBooking.get(bookingId) || null
      }];
    }));
    const currentDate = new Date();
    const upcoming = [];
    const past = [];
    const cancelled = [];

    bookings.forEach((booking) => {
      if (booking.status === "cancelled") {
        cancelled.push(booking);
      } else if (booking.checkIn >= currentDate) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    res.render("store/bookings", {
      pageTitle: "My Bookings",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user,
      upcoming,
      past,
      cancelled,
      reviewStatusByBooking,
      message: typeof req.query.message === "string" ? req.query.message : "",
      error: typeof req.query.error === "string" ? req.query.error : "",
      formatCurrency
    });
  } catch (err) {
    next(err);
  }
};

exports.getBookingById = async (req, res, next) => {
  try {
    const user = await requireRole(req, res, "guest");
    if (!user) return;

    const booking = await Booking.findOne({ _id: req.params.bookingId, user: user._id }).populate("home");
    if (!booking) {
      return res.status(404).render("404", {
        pageTitle: "Booking Not Found",
        currentPage: "404",
        isLoggedIn: req.isLoggedIn,
        user
      });
    }

    res.render("store/booking-detail", {
      pageTitle: "Booking Details",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user,
      booking,
      formatCurrency
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const user = await requireRole(req, res, "guest");
    if (!user) return;

    const booking = await Booking.findOne({ _id: req.params.bookingId, user: user._id });
    if (!booking) {
      return res.status(404).render("404", {
        pageTitle: "Booking Not Found",
        currentPage: "404",
        isLoggedIn: req.isLoggedIn,
        user
      });
    }
    if (booking.status !== "confirmed") {
      return res.redirect(`/bookings?error=${encodeURIComponent("Booking cannot be cancelled.")}`);
    }
    if (booking.checkIn <= new Date()) {
      return res.redirect(`/bookings?error=${encodeURIComponent("Cannot cancel a booking that has already started.")}`);
    }

    booking.status = "cancelled";
    await booking.save();
    return res.redirect(`/bookings?message=${encodeURIComponent("Booking cancelled successfully.")}`);
  } catch (err) {
    next(err);
  }
};

exports.getHostBookings = async (req, res, next) => {
  try {
    const host = await requireRole(req, res, "host");
    if (!host) return;

    const homes = await Home.find({ owner: host._id });
    const homeIds = homes.map((home) => home._id);
    const bookings = await Booking.find({ home: { $in: homeIds } })
      .populate("user", "firstName lastName")
      .populate("home")
      .sort({ checkIn: 1 });
    const recentReviews = homeIds.length ? await Review.find({ home: { $in: homeIds } })
      .populate("author", "firstName")
      .populate("home", "houseName")
      .sort({ createdAt: -1, _id: -1 })
      .limit(5) : [];
    const stats = await Booking.aggregate([
      { $match: { home: { $in: homeIds } } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalEarnings: {
            $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$totalPrice", 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          },
          upcomingBookings: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$status", "cancelled"] }, { $gte: ["$checkIn", new Date()] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    const summary = stats[0] || {
      totalBookings: 0,
      totalEarnings: 0,
      cancelledBookings: 0,
      upcomingBookings: 0
    };

    res.render("host/host-bookings", {
      pageTitle: "Host Bookings",
      currentPage: "host-bookings",
      isLoggedIn: req.isLoggedIn,
      user: host,
      bookings,
      recentReviews,
      stats: {
        totalProperties: homes.length,
        totalBookings: summary.totalBookings,
        upcomingBookings: summary.upcomingBookings,
        cancelledBookings: summary.cancelledBookings,
        totalEarnings: summary.totalEarnings
      },
      formatCurrency
    });
  } catch (err) {
    next(err);
  }
};
