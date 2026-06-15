const valhallaCompatibleHandler = require("../valhalla/[...path].js");

module.exports = async function handler(req, res) {
  req.forceOpenRouteService = true;
  await valhallaCompatibleHandler(req, res);
};
