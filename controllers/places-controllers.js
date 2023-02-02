const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const fs = require("fs");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place-model");
const User = require("../models/user-model");

// getPlaceByPlaceId ------------------------------------------
const getPlaceByPlaceId = async (req, res, next) => {
  const placeId = req.params.pid;

  let identifiedPlace;
  try {
    identifiedPlace = await Place.findById(placeId);
  } catch (error) {
    return next(
      new HttpError("Something went wrong, could not find a place.", 500)
    );
  }
  if (!identifiedPlace) {
    return next(
      new HttpError("Could not find a place for the provided place id.", 404)
    );
  }

  res.json({ place: identifiedPlace.toObject({ getters: true }) });
};

// getPlacesByUserId ------------------------------------------
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (error) {
    return next(
      new HttpError("Fetching places failed, please try again later", 500)
    );
  }

  // if (!userWithPlaces || userWithPlaces.places.length === 0) {
  //   return next(new HttpError("Could not find places for the user", 404));
  // }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

// createPlace ------------------------------------------
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { title, description, address } = req.body;

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (error) {
    return next(new HttpError("Creating place failed, please try again.", 500));
  }
  if (!user) {
    return next(new HttpError("Could not find user for provided Id.", 500));
  }

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    image: req.file.path,
    address,
    location: coordinates,
    creator: req.userData.userId,
  });

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (error) {
    return next(new HttpError("Creating place failed, please try again.", 500));
  }
  res.status(201).json({ place: createdPlace.toObject({ getters: true }) });
};

// updatePlace ------------------------------------------
const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let identifiedPlace;
  try {
    identifiedPlace = await Place.findById(placeId);
  } catch (error) {
    return next(new HttpError("Updating place failed, please try again.", 500));
  }

  if (identifiedPlace.creator.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  identifiedPlace.title = title;
  identifiedPlace.description = description;

  try {
    await identifiedPlace.save();
  } catch (error) {
    return next(new HttpError("Updating place failed, please try again.", 500));
  }

  res.status(200).json({ place: identifiedPlace.toObject({ getters: true }) });
};

// deletePlace ------------------------------------------
const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (error) {
    return next(
      new HttpError("Something went wrong, could not delete place.", 500)
    );
  }
  if (!place) {
    return next(new HttpError("Could not find place for this Id", 404));
  }

  if (place.creator.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401)
    );
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (error) {
    return next(
      new HttpError("Something went wrong, could not delete place.", 500)
    );
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place successfully." });
};

exports.getPlaceByPlaceId = getPlaceByPlaceId;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
