// const Home = require('../models/home');
// const Favorite = require('../models/favorite');

// exports.getIndex = (req, res, next) => {
//   console.log("Session value:",req.session);
//   Home.find().then(registeredHomes => {
//     res.render("store/index", {
//       registeredHomes: registeredHomes,
//       pageTitle: "Thikana Home",
//       currentPage: "index",
//       isLoggedIn : req.isLoggedIn,
//       user:req.session.userId,
//     })
//   });
// };


// exports.getHomes=(req, res, next) => {
//     Home.find().then(registeredHomes=> {
//           res.render('store/home-list', 
//             {registeredHomes: registeredHomes, 
//             pageTitle: 'Homes List', 
//             currentPage: 'Home',
//             isLoggedIn : req.isLoggedIn,
//             user:req.session.userId,
//           });
//     });
// };

// exports.getBookings=(req,res,next)=>{
//           res.render('store/bookings', 
//             {pageTitle: 'My Thikana bookings',
//             currentPage: 'bookings',
//             isLoggedIn : req.isLoggedIn,
//             user:req.session.userId,
//           });
// }

// exports.getFavoriteList=(req,res,next)=>{
//   Favorite.find()
//   .populate("houseId")
//   .then(favourites=>{
//     const favouriteHomes = favourites.map((fav) => fav.houseId);
//     res.render('store/favorite', 
//             {favouriteHomes: favouriteHomes, 
//             pageTitle: 'My Favourites', 
//             currentPage: 'favorite',
//             isLoggedIn : req.isLoggedIn,
//             user:req.session.userId,
//           });
//     });
//   }



// exports.postAddToFavorite=(req,res,next)=>{
//   const homeId = req.body.id;
//   Favorite.findOne({houseId: homeId}).then((fav) => {
//     if (fav) {
//       console.log("Already marked as favourite");
//     } else {
//       fav = new Favorite({houseId: homeId});
//       fav.save().then((result) => {
//         console.log("Fav added: ", result);
//       });
//     }
//     res.redirect("/favorite");
//   }).catch(err => {
//     console.log("Error while marking favourite: ", err);
//   });
// }




// exports.getHomeDetails=(req,res,next)=>{
//   const homeId=req.params.homeId;
//   console.log("At home details page for homeId: ",homeId);
//   Home.findById(homeId).then(home => {
//     if(!home){
//       console.log("Home not found");
//       res.redirect("/homes");
//     }else{
//     res.render('store/home-detail',{
//       home:home,
//       pageTitle:"Home Detail",
//       currentPage:"Home",
//       isLoggedIn : req.isLoggedIn,
//       user:req.session.userId,
//   });
// }
//   });
// }

// exports.postRemoveFromFavorite=(req,res,next)=>{
//   const homeId = req.params.homeId;
//   Favorite.findOneAndDelete({houseId:homeId})
//   .then(result=>{
//     console.log("Fav removed:",result);
//   }).catch(err=>{
//     console.log("error while removing favourite:",err);
//   }).finally(()=>{
//     res.redirect("/favorite");
//   })
// }


// chatgpt genearte 
const Home = require("../models/home");
const Review = require("../models/review");
const User = require("../models/user");
const { getReviewCsrfToken } = require("../utils/reviewCsrf");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==================== GET LOGGED-IN USER ====================

const getUser = async (req) => {
  if (!req.session.userId) {
    return null;
  }

  return await User.findById(req.session.userId).select("-password");
};

const withReviewSummaries = async (homes) => {
  const availableHomes = homes.filter(Boolean);
  if (!availableHomes.length) return [];

  const summaries = await Review.aggregate([
    { $match: { home: { $in: availableHomes.map((home) => home._id) } } },
    {
      $group: {
        _id: "$home",
        count: { $sum: 1 },
        average: { $avg: "$rating" }
      }
    }
  ]);
  const byHome = new Map(summaries.map((summary) => [
    summary._id.toString(),
    { count: summary.count, average: Math.round(summary.average * 10) / 10 }
  ]));

  return availableHomes.map((home) => ({
    ...home.toObject(),
    reviewSummary: byHome.get(home._id.toString()) || { count: 0, average: null }
  }));
};


// ==================== INDEX ====================

exports.getIndex = async (req, res, next) => {
  try {
    const registeredHomes = await withReviewSummaries(await Home.find().sort({ _id: -1 }).limit(6));
    const user = await getUser(req);

    res.render("store/index", {
      registeredHomes,
      pageTitle: "Find Your Next Stay",
      currentPage: "index",
      isLoggedIn: req.isLoggedIn,
      user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== HOMES LIST ====================

exports.getHomes = async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const minPrice = typeof req.query.minPrice === "string" && req.query.minPrice !== ""
      ? Number(req.query.minPrice)
      : null;
    const maxPrice = typeof req.query.maxPrice === "string" && req.query.maxPrice !== ""
      ? Number(req.query.maxPrice)
      : null;
    const requestedSort = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const sortOptions = {
      newest: { _id: -1 },
      "price-asc": { price: 1, _id: -1 },
      "price-desc": { price: -1, _id: -1 }
    };
    let filterError = "";
    const filter = {};

    if (search) {
      const searchPattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ houseName: searchPattern }, { location: searchPattern }];
    }

    if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) {
      filterError = "Enter a valid minimum price.";
    } else if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
      filterError = "Enter a valid maximum price.";
    } else if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      filterError = "Maximum price must be greater than or equal to minimum price.";
    } else if (minPrice !== null || maxPrice !== null) {
      filter.price = {};
      if (minPrice !== null) filter.price.$gte = minPrice;
      if (maxPrice !== null) filter.price.$lte = maxPrice;
    }

    if (!Object.prototype.hasOwnProperty.call(sortOptions, requestedSort)) {
      filterError = "Choose a valid sort order.";
    }

    const registeredHomes = await withReviewSummaries(await Home.find(filter).sort(sortOptions[requestedSort] || sortOptions.newest));
    const user = await getUser(req);

    res.render("store/home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Homes List",
      currentPage: "Home",
      isLoggedIn: req.isLoggedIn,
      user,
      filters: { search, minPrice: req.query.minPrice || "", maxPrice: req.query.maxPrice || "", sort: requestedSort },
      filterError
    });

  } catch (err) {
    next(err);
  }
};


// ==================== BOOKINGS ====================

exports.getBookings = async (req, res, next) => {
  try {
    const user = await getUser(req);

    res.render("store/bookings", {
      pageTitle: "My Bookings",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== FAVOURITE LIST ====================

exports.getFavoriteList = async (req, res, next) => {
  try {
    const user = await getUser(req);

    if (!user) {
      return res.redirect("/login");
    }
    if (user.userType !== "guest") {
      return res.status(403).send("Forbidden");
    }
    await user.populate("favourites");
    const favouriteHomes = await withReviewSummaries(user.favourites);

    res.render("store/favorite", {
      favouriteHomes,
      pageTitle: "My Favourites",
      currentPage: "favorite",
      isLoggedIn: req.isLoggedIn,
      user: user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== ADD TO FAVOURITE ====================

exports.postAddToFavorite = async (req, res, next) => {
  try {
    const homeId = req.body.id;
    const userId = req.session.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.redirect("/login");
    }
    if (user.userType !== "guest") {
      return res.status(403).send("Forbidden");
    }
    if (typeof homeId !== "string" || !(await Home.exists({ _id: homeId }))) {
      return res.redirect("/homes");
    }

    // Check if home is already in favourites
    const alreadyFavourite = user.favourites.some(
      fav => fav.toString() === homeId
    );

    if (!alreadyFavourite) {
      user.favourites.push(homeId);

      await user.save();

      console.log("Home added to favourites");
    } else {
      console.log("Home already exists in favourites");
    }

    const returnTo = typeof req.body.returnTo === "string" ? req.body.returnTo : "";
    const safeReturnTo = returnTo === "/" || returnTo.startsWith("/homes") && !returnTo.startsWith("//") && !returnTo.includes("\\")
      ? returnTo
      : "/favorite";
    res.redirect(safeReturnTo);

  } catch (err) {
    console.log("Error while adding favourite:", err);
    next(err);
  }
};


// ==================== HOME DETAILS ====================

exports.getHomeDetails = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;

    console.log(
      "At home details page for homeId:",
      homeId
    );

    const home = await Home.findById(homeId).populate("owner", "firstName lastName");

    if (!home) {
      console.log("Home not found");

      return res.redirect("/homes");
    }

    const user = await getUser(req);
    const pageValue = typeof req.query.page === "string" && /^\d+$/.test(req.query.page) ? Number(req.query.page) : 1;
    const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const pageSize = 10;
    const [ratingData = { summary: [], distribution: [] }] = await Review.aggregate([
      { $match: { home: home._id } },
      {
        $facet: {
          summary: [{
            $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: "$rating" }
            }
          }],
          distribution: [{ $group: { _id: "$rating", count: { $sum: 1 } } }]
        }
      }
    ]);
    const summary = ratingData.summary[0] || { count: 0, average: null };
    const totalPages = Math.max(1, Math.ceil(summary.count / pageSize));
    const currentPage = Math.min(page, totalPages);
    const reviews = summary.count ? await Review.find({ home: home._id })
      .populate("author", "firstName")
      .sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize) : [];
    const ratingDistribution = Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [rating, 0]));
    ratingData.distribution.forEach(({ _id, count }) => {
      ratingDistribution[_id] = count;
    });

    res.render("store/home-detail", {
      home: home,
      pageTitle: "Home Detail",
      currentPage: "Home",
      isLoggedIn: req.isLoggedIn,
      user,
      reviews,
      reviewSummary: {
        average: summary.average === null ? null : Math.round(summary.average * 10) / 10,
        count: summary.count,
        distribution: ratingDistribution
      },
      currentReviewPage: currentPage,
      totalReviewPages: totalPages,
      reviewStatus: ["submitted", "updated", "deleted"].includes(req.query.reviewStatus) ? req.query.reviewStatus : "",
      reviewCsrfToken: user && user.userType === "guest" ? getReviewCsrfToken(req) : ""
    });

  } catch (err) {
    next(err);
  }
};


// ==================== REMOVE FROM FAVOURITE ====================

exports.postRemoveFromFavorite = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;
    const userId = req.session.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.redirect("/login");
    }
    if (user.userType !== "guest") {
      return res.status(403).send("Forbidden");
    }

    // Remove home from favourites
    user.favourites = user.favourites.filter(
      fav => fav.toString() !== homeId
    );

    await user.save();

    console.log("Home removed from favourites");

    const returnTo = typeof req.body.returnTo === "string" ? req.body.returnTo : "";
    const safeReturnTo = returnTo === "/" || returnTo.startsWith("/homes") && !returnTo.startsWith("//") && !returnTo.includes("\\")
      ? returnTo
      : "/favorite";
    res.redirect(safeReturnTo);

  } catch (err) {
    console.log("Error while removing favourite:", err);
    next(err);
  }
};