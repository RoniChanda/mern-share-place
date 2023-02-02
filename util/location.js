const axios = require("axios");
const HttpError = require("../models/http-error");

const API_KEY = process.env.LOCATIONIQ_API_KEY;

const getCoordsForAddress = async (address) => {
  const url = `https://us1.locationiq.com/v1/search?key=${API_KEY}&q=${encodeURIComponent(
    address
  )}&format=json`;

  const response = await axios.get(url);
  const data = response.data[0];

  if (!data || data.status === "ZERO_RESULTS") {
    throw new HttpError(
      "Could not find location for the specified address.",
      422
    );
  }

  const coordinates = {
    lat: data.lat,
    lng: data.lon,
  };

  return coordinates;
};

module.exports = getCoordsForAddress;
