const User = require("../models/user");

exports.pageNotFound = async (req, res, next) => {
  try {
    const user = req.session.userId
      ? await User.findById(req.session.userId).select("-password")
      : null;
    res.status(404).render("404", {
      pageTitle: "Page Not Found",
      currentPage: "404",
      isLoggedIn: req.isLoggedIn,
      user
    });
  } catch (err) {
    next(err);
  }
};

exports.handleError = (err, req, res, next) => {
  if (err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Each property photo must be no larger than 5 MB."
      : "Upload up to 8 JPG or PNG property photos.";
    return res.status(422).send(message);
  }
  if (err.name === "CastError") {
    return res.status(404).send("The requested item could not be found.");
  }

  console.error("Request failed:", err.name || "Error");
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send("Something went wrong. Please try again.");
};
