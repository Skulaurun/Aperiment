const fs = require("fs");
const https = require("https");
const { default: axios } = require("axios");

const agent = new https.Agent({
    ca: fs.readFileSync("resources/certs/isrgrootx1.pem.txt")
});

module.exports = axios.create({ httpsAgent: agent });
