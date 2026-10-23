const path = require("path");
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const { default: mongoose } = require("mongoose");
const User = require("./models/user");
const Review = require("./models/review");
const storeRouter = require("./routes/storeRouter");
const hostRouter = require("./routes/hostRouter");
const authRouter = require("./routes/authRouter");
const rootDir = require("./utils/pathUtil");

const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;
const port = Number(process.env.PORT) || 3000;

if (!mongoUri || !sessionSecret) {
  throw new Error("MONGODB_URI and SESSION_SECRET must be configured in the environment.");
}

const app = express();
app.set("view engine", "ejs");
app.set("views", "views");

const store = new MongoDBStore({
  uri: mongoUri,
  collection: "session"
});

app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use(express.static(path.join(rootDir, "public")));
app.use("/uploads", express.static(path.join(rootDir, "uploads")));
app.use("/host/uploads", express.static(path.join(rootDir, "uploads")));
app.use("/homes/uploads", express.static(path.join(rootDir, "uploads")));

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use((req, res, next) => {
  req.isLoggedIn = req.session.isLoggedIn;
  next();
});

app.use(authRouter);
app.use(storeRouter);
app.use("/host", async (req, res, next) => {
  if (!req.isLoggedIn || !req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const user = await User.findById(req.session.userId).select("userType");
    if (!user || user.userType !== "host") {
      return res.status(403).send("Forbidden");
    }
    next();
  } catch (err) {
    next(err);
  }
});
app.use("/host", hostRouter);

const errorController = require("./controllers/errors");
app.use(errorController.pageNotFound);
app.use(errorController.handleError);

mongoose.connect(mongoUri).then(async () => {
  await Review.createIndexes();
  console.log("Connected to MongoDB");
  app.listen(port, () => {
    console.log(`Thikana server running at http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("Unable to connect to or initialize MongoDB:", err.name || "Error");
  process.exitCode = 1;
});
