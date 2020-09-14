const withCSS = require("@zeit/next-css");
const withImages = require("next-images");

// Allow importing images as import img from './my-image.jpg'
module.exports = withCSS(withImages());
