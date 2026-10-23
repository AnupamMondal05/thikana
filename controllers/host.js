// const Home = require('../models/home');

// exports.getAddHome = (req, res, next) => {
//   res.render('host/edit-home', 
//     {pageTitle: 'Add a property',
//     currentPage: 'addHome',
//     editing:false,
//     isLoggedIn : req.isLoggedIn,
//     user:req.session.userId,
//   });
// };

// exports.postAddHome=(req, res, next) => {
// // we can also use destructuring to extract the values from req.body
//   const{houseName, price, location, rating, photo,description}=req.body;
//   const home = new Home({houseName, price, location,rating, photo,description});
  
//   home.save().then(()=>{
//     console.log("Home Saved Successfully");
//   });
//   res.redirect('host/host-home-list');
// };

// exports.getHostHomes=(req, res, next) => {
//     Home.find().then(registeredHomes=>{
//           res.render('host/host-home-list', 
//             {registeredHomes: registeredHomes, 
//             pageTitle: 'Host Homes List', 
//             currentPage: 'host-homes',
//             isLoggedIn : req.isLoggedIn,
//             user:req.session.userId,
//           });
//     });
// };


// exports.getEditHome=(req,res,next)=>{
//     const homeId=req.params.homeId;
//     const editing = req.query.editing ==='true';
//     Home.findById(homeId).then(home => {
//       if(!home){
//         console.log("Home not found for editing with ID:",homeId);
//         return res.redirect('/host/host-home-list');
//       }
//       console.log('Editing home with ID:', homeId, 'Editing mode:', editing,home);
//       res.render('host/edit-home',{
//         pageTitle:'Edit your homes',
//         currentPage:'host-homes',
//         editing:editing,
//         home:home,
//         isLoggedIn : req.isLoggedIn,
//         user:req.session.userId,
//       });
//     });
// };

// exports.postEditHome=(req, res, next) => {
//   const { id, houseName, price, location, rating, photo, description } =
//     req.body;
//   Home.findById(id).then((home) => {
//     home.houseName = houseName;
//     home.price = price;
//     home.location = location;
//     home.rating = rating;
//     home.photo = photo;
//     home.description = description;
//     home.save().then((result) => {
//       console.log("Home updated ", result);
//     }).catch(err => {
//       console.log("Error while updating ", err);
//     })
//     res.redirect("/host/host-home-list");
//   }).catch(err => {
//     console.log("Error while finding home ", err);
//   });
// };

// exports.postDeleteHome=(req,res,next)=>{
//   const homeId= req.params.homeId;
//   console.log("Deleting home with ID:", homeId);
//   Home.findByIdAndDelete(homeId).then(()=>{
//     res.redirect('/host/host-home-list');
//   }).catch(error=>{
//     console.log("Error while deleting",error);
//   })
// };


// chatgpt
const Home = require("../models/home");
const User = require("../models/user");
const fs=require("fs");
const path = require("path");

const getUploadedFiles = (req) => [
  ...((req.files && req.files.photos) || []),
  ...((req.files && req.files.photo) || [])
];

const getHomePhotos = (home) => {
  const photos = Array.isArray(home.photos) ? home.photos.filter(Boolean) : [];
  return photos.length ? photos : (home.photo ? [home.photo] : []);
};

const MAX_PROPERTY_PHOTOS = 8;

const toPublicPath = (filePath) => {
  const uploadsDirectory = path.resolve(__dirname, "..", "uploads");
  const relativePath = path.relative(uploadsDirectory, filePath);
  return path.posix.join("uploads", relativePath.split(path.sep).join("/"));
};

const removeUploadedFiles = (files) => files.forEach((file) => {
  fs.unlink(file.path, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Unable to remove rejected property photo:", err.message);
    }
  });
});

// Get logged-in user
const getUser = async (req) => {
  if (!req.session.userId) {
    return null;
  }

  return await User.findById(req.session.userId).select("-password");
};

const validateHomeInput = ({ houseName, price, location, rating, maxGuests, description }) => {
  if (typeof houseName !== "string" || !houseName.trim() ||
      typeof location !== "string" || !location.trim()) {
    return "Please provide a property name and location.";
  }
  if (houseName.trim().length > 120 || location.trim().length > 120) {
    return "Property name and location must be 120 characters or fewer.";
  }
  if (typeof price !== "string" || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return "Price per night must be a positive number.";
  }
  if (typeof maxGuests !== "string" || !Number.isSafeInteger(Number(maxGuests)) ||
      Number(maxGuests) < 1 || Number(maxGuests) > 100) {
    return "Maximum guests must be a whole number from 1 to 100.";
  }
  if (typeof rating !== "string" || !Number.isFinite(Number(rating)) ||
      Number(rating) < 0 || Number(rating) > 5) {
    return "Rating must be between 0 and 5.";
  }
  if (typeof description === "string" && description.length > 2000) {
    return "Description must be 2,000 characters or fewer.";
  }
  return "";
};


// ==================== ADD HOME PAGE ====================

exports.getAddHome = async (req, res, next) => {
  try {
    const user = await getUser(req);

    res.render("host/edit-home", {
      pageTitle: "Add a property",
      currentPage: "addHome",
      editing: false,
      isLoggedIn: req.isLoggedIn,
      user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== ADD HOME ====================

exports.postAddHome = async (req, res, next) => {
  const uploadedFiles = getUploadedFiles(req);
  try {
    const {
      houseName,
      price,
      location,
      rating,
      description,
      maxGuests
    } = req.body;
    const validationError = validateHomeInput(req.body);
    if (validationError) {
      removeUploadedFiles(uploadedFiles);
      return res.status(422).send(validationError);
    }

    if(!uploadedFiles.length){
      return res.status(422).send("Please upload at least one JPG or PNG property photo.");
    }
    if (uploadedFiles.length > MAX_PROPERTY_PHOTOS) {
      removeUploadedFiles(uploadedFiles);
      return res.status(422).send(`A property can have up to ${MAX_PROPERTY_PHOTOS} photos.`);
    }

    const photos = uploadedFiles.map(file => toPublicPath(file.path));
    const parsedMaxGuests = Number.parseInt(maxGuests, 10);

    const home = new Home({
      houseName: houseName.trim(),
      price,
      location: location.trim(),
      rating,
      photo: photos[0],
      photos,
      description,
      maxGuests: parsedMaxGuests,
      owner: req.session.userId
    });
    
    await home.save();
    uploadedFiles.length = 0;

    res.redirect("/host/host-home-list");

  } catch (err) {
    removeUploadedFiles(uploadedFiles);
    next(err);
  }
};


// ==================== HOST HOME LIST ====================

exports.getHostHomes = async (req, res, next) => {
  try {
    const user = await getUser(req);
    const registeredHomes = await Home.find({ owner: req.session.userId });

    res.render("host/host-home-list", {
      registeredHomes,
      pageTitle: "Host Homes List",
      currentPage: "host-homes",
      isLoggedIn: req.isLoggedIn,
      user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== EDIT HOME PAGE ====================

exports.getEditHome = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;

    const editing = req.query.editing === "true";

    const home = await Home.findOne({ _id: homeId, owner: req.session.userId });

    if (!home) {
      return res.status(404).redirect("/host/host-home-list");
    }

    const user = await getUser(req);

    res.render("host/edit-home", {
      pageTitle: "Edit your homes",
      currentPage: "host-homes",
      editing,
      home,
      isLoggedIn: req.isLoggedIn,
      user
    });

  } catch (err) {
    next(err);
  }
};


// ==================== EDIT HOME ====================

exports.postEditHome = async (req, res, next) => {
  const uploadedFiles = getUploadedFiles(req);
  try {
    const {
      id,
      houseName,
      price,
      location,
      rating,
      description,
      maxGuests
    } = req.body;
    const validationError = validateHomeInput(req.body);
    if (validationError) {
      removeUploadedFiles(uploadedFiles);
      return res.status(422).send(validationError);
    }

    const home = await Home.findOne({ _id: id, owner: req.session.userId });

    if (!home) {
      removeUploadedFiles(uploadedFiles);
      return res.status(404).redirect("/host/host-home-list");
    }

    home.houseName = houseName.trim();
    home.price = price;
    home.location = location.trim();
    home.rating = rating;
    home.description = description;
    home.maxGuests = Number.parseInt(maxGuests, 10) || home.maxGuests || 2;
    const currentPhotos = getHomePhotos(home);
    if (currentPhotos.length + uploadedFiles.length > MAX_PROPERTY_PHOTOS) {
      removeUploadedFiles(uploadedFiles);
      return res.status(422).send(`This property already has ${currentPhotos.length} photo${currentPhotos.length === 1 ? "" : "s"}. Add no more than ${MAX_PROPERTY_PHOTOS - currentPhotos.length} additional photo${MAX_PROPERTY_PHOTOS - currentPhotos.length === 1 ? "" : "s"}.`);
    }
    if (uploadedFiles.length) {
      home.photos = [...currentPhotos, ...uploadedFiles.map(file => toPublicPath(file.path))];
      home.photo = home.photos[0];
    }

    await home.save();
    uploadedFiles.length = 0;

    res.redirect("/host/host-home-list");

  } catch (err) {
    removeUploadedFiles(uploadedFiles);
    next(err);
  }
};


// ==================== DELETE HOME ====================

exports.postDeleteHome = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;

    const result = await Home.findOneAndDelete({ _id: homeId, owner: req.session.userId });

    if (!result) {
      return res.status(404).redirect("/host/host-home-list");
    }

    res.redirect("/host/host-home-list");

  } catch (err) {
    next(err);
  }
};