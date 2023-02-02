const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user-model");

// getUsers --------------------------------------------
const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (error) {
    return next(
      new HttpError("Fetching users failed, please try again later", 500)
    );
  }

  res.json({ users: users.map((u) => u.toObject({ getters: true })) });
};

// signup --------------------------------------------
const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (error) {
    return next(new HttpError("Signup failed, please try again later.", 500));
  }
  if (existingUser) {
    return next(
      new HttpError("User exists already, please login instead.", 422)
    );
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (error) {
    return next(new HttpError("Could not create user, please try again.", 500));
  }

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: req.file.path,
    places: [],
  });
  try {
    await createdUser.save();
  } catch (error) {
    return next(new HttpError("Signing up failed, please try again.", 500));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Signing up failed, please try again.", 500));
  }

  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

// login --------------------------------------------
const login = async (req, res, next) => {
  const { email, password } = req.body;

  let identifiedUser;
  try {
    identifiedUser = await User.findOne({ email: email });
  } catch (error) {
    return next(new HttpError("Login failed, please try again later.", 500));
  }
  if (!identifiedUser) {
    return next(
      new HttpError("Invalid email address, user doesn't exist", 403)
    );
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, identifiedUser.password);
  } catch (error) {
    return next(
      new HttpError("Could not log you in, please try again later.", 500)
    );
  }

  if (!isValidPassword) {
    return next(
      new HttpError("Invalid password, please check your password.", 403)
    );
  }

  let token;
  try {
    token = jwt.sign(
      { userId: identifiedUser.id, email: identifiedUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Logging in failed, please try again.", 500));
  }

  // res.json({
  //   message: "Logged in!",
  //   user: identifiedUser.toObject({ getters: true }),
  // });
  res.status(201).json({
    userId: identifiedUser.id,
    email: identifiedUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
