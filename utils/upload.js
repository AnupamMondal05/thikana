const crypto = require("crypto");
const path = require("path");
const fs = require("fs/promises");
const multer = require("multer");

const allowedTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"]
]);

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.get(extension) !== file.mimetype) {
    return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 9
  }
});

upload.validateFileContent = async (req, res, next) => {
  const files = Object.values(req.files || {}).flat();
  try {
    for (const file of files) {
      const extension = path.extname(file.originalname).toLowerCase();
      const handle = await fs.open(file.path, "r");
      const signature = Buffer.alloc(8);
      try {
        await handle.read(signature, 0, signature.length, 0);
      } finally {
        await handle.close();
      }

      const isPng = extension === ".png" &&
        signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isJpeg = [".jpg", ".jpeg"].includes(extension) &&
        signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
      if (!isPng && !isJpeg) {
        await Promise.all(files.map((uploadedFile) => fs.unlink(uploadedFile.path)));
        return res.status(422).send("Each property photo must be a valid JPG or PNG image.");
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = upload;
