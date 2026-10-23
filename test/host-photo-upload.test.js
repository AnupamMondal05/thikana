const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Home = require("../models/home");
const hostController = require("../controllers/host");

const originalFindOne = Home.findOne;

test.after(() => {
  Home.findOne = originalFindOne;
});

const makeResponse = () => ({
  statusCode: 200,
  body: "",
  redirectTo: "",
  status(code) { this.statusCode = code; return this; },
  send(body) { this.body = body; return this; },
  redirect(url) { this.redirectTo = url; return this; }
});

const uploadedFile = (filename) => ({
  path: path.join(process.cwd(), "uploads", filename)
});

const makeRequest = (home) => ({
  session: { userId: "host-id" },
  body: {
    id: "home-id",
    houseName: "Forest Stay",
    price: "4500",
    location: "Munnar",
    rating: "4",
    maxGuests: "4",
    description: "A welcoming stay."
  },
  files: {
    photos: [uploadedFile("new-one.jpg"), uploadedFile("new-two.jpg")]
  },
  home
});

for (const [name, existingPhotos, legacyPhoto] of [
  ["existing multi-photo homes", ["uploads/first.jpg", "uploads/second.jpg"], "uploads/first.jpg"],
  ["legacy single-photo homes", [], "uploads/legacy.jpg"]
]) {
  test(`editing ${name} appends the newly uploaded photos`, async () => {
    const home = {
      photos: existingPhotos.slice(),
      photo: legacyPhoto,
      saved: false,
      async save() { this.saved = true; }
    };
    Home.findOne = async () => home;
    const response = makeResponse();

    await hostController.postEditHome(makeRequest(home), response, (error) => {
      throw error;
    });

    assert.equal(home.saved, true);
    assert.deepEqual(home.photos, [
      ...(existingPhotos.length ? existingPhotos : [legacyPhoto]),
      "uploads/new-one.jpg",
      "uploads/new-two.jpg"
    ]);
    assert.equal(home.photo, legacyPhoto);
    assert.equal(response.redirectTo, "/host/host-home-list");
  });
}
