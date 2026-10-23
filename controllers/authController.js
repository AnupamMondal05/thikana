const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const Home = require("../models/home");
const Booking = require("../models/booking");

exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    pageTitle: "Login",
    currentPage: "login",
    isLoggedIn: false,
    errors: [],
    oldInput: {email: ""},
    user: {},
  });
};

exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    pageTitle: "Signup",
    currentPage: "signup",
    isLoggedIn: false,
    errors: [],
    oldInput: {firstName: "", lastName: "", email: "", userType: ""},
    user: {},
  });
};

exports.postSignup = [
  check("firstName")
  .trim()
  .isLength({min: 2})
  .withMessage("First Name should be atleast 2 characters long")
  .matches(/^[A-Za-z\s]+$/)
  .withMessage("First Name should contain only alphabets"),

  check("lastName")
  .matches(/^[A-Za-z\s]*$/)
  .withMessage("Last Name should contain only alphabets"),

  check("email")
  .isEmail()
  .withMessage("Please enter a valid email")
  .normalizeEmail(),

  check("password")
  .isLength({min: 8})
  .withMessage("Password should be atleast 8 characters long")
  .matches(/[A-Z]/)
  .withMessage("Password should contain atleast one uppercase letter")
  .matches(/[a-z]/)
  .withMessage("Password should contain atleast one lowercase letter")
  .matches(/[0-9]/)
  .withMessage("Password should contain atleast one number")
  .matches(/[!@&]/)
  .withMessage("Password should contain atleast one special character")
  .trim(),

  check("confirmPassword")
  .trim()
  .custom((value, {req}) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),

  check("userType")
  .notEmpty()
  .withMessage("Please select a user type")
  .isIn(['guest', 'host'])
  .withMessage("Invalid user type"),

  check("terms")
  .notEmpty()
  .withMessage("Please accept the terms and conditions")
  .custom((value, {req}) => {
    if (value !== "on") {
      throw new Error("Please accept the terms and conditions");
    }
    return true;
  }),
  
  (req, res, next) => {
    const {firstName, lastName, email, password, userType} = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("auth/signup", {
        pageTitle: "Signup",
        currentPage: "signup",
        isLoggedIn: false,
        errors: errors.array().map(err => err.msg),
        oldInput: {firstName, lastName, email, password, userType},
        user: {},
      });
    }

    bcrypt.hash(password, 12)
    .then(hashedPassword => {
      const user = new User({firstName, lastName, email, password: hashedPassword, userType});
      return user.save();
    })
    .then(() => {
      res.redirect("/login");
    }).catch(err => {
      console.error("Signup failed:", err.name || "Error");
      const message = err.code === 11000
        ? "An account with this email already exists."
        : "Unable to create your account. Please check your details and try again.";
      return res.status(422).render("auth/signup", {
        pageTitle: "Signup",
        currentPage: "signup",
        isLoggedIn: false,
        errors: [message],
        oldInput: {firstName, lastName, email, userType},
        user: {},
      });
    });
  }
]

exports.postLogin = async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(422).render("auth/login", {
        pageTitle: "Login",
        currentPage: "login",
        isLoggedIn: false,
        errors: ["Invalid email or password."],
        oldInput: { email },
        user: {},
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(422).render("auth/login", {
        pageTitle: "Login",
        currentPage: "login",
        isLoggedIn: false,
        errors: ["Invalid email or password."],
        oldInput: { email },
        user: {},
      });
    }

    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }

      req.session.isLoggedIn = true;
      req.session.userId = user._id.toString();
      req.session.save((saveError) => {
        if (saveError) {
          return next(saveError);
        }
        res.redirect("/");
      });
    });
  } catch (err) {
    next(err);
  }
}


exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
}

exports.getProfile = async (req, res, next) => {
  try {
    if (!req.session.isLoggedIn || !req.session.userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.userId).select("-password").populate("favourites");
    if (!user) {
      return res.redirect("/login");
    }

    const isHost = user.userType === "host";
    const listings = isHost ? await Home.find({ owner: user._id }).sort({ _id: -1 }) : [];
    const bookings = isHost ? [] : await Booking.find({ user: user._id })
      .populate("home")
      .sort({ checkIn: -1 })
      .limit(3);

    res.render("auth/profile", {
      pageTitle: "Your profile",
      currentPage: "profile",
      isLoggedIn: true,
      user,
      listings,
      bookings
    });
  } catch (err) {
    next(err);
  }
};