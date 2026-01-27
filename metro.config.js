// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

if (!Array.prototype.toReversed) {
    Array.prototype.toReversed = function () {
        return Array.from(this).reverse();
    };
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
