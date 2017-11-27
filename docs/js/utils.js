/**
 * @module utils.js
 * Should be processed with browerify (npm)

 * DO NOT PUT "USE STRICT" ON THE TOP OF THIS DOCUMENT!
 * THAT BREAKS THE LIBRARY LOADING!

 * browserify utils.js > [utils_package.js]
 */

// For browserify to grab requirements.
ndarray = require('ndarray');
ndpack = require('ndarray-pack');
ndunpack = require('ndarray-unpack');
ndshow = require('ndarray-show');
ndops = require('ndarray-ops');
zeros = require('zeros');

dt = require('distance-transform');

// Client-side jsfeat is newer.
// jsfeat = require('jsfeat');
