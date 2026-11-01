// Focused source regressions; the app runs its own integration/rendering suite.
module.exports = function (config) {
  require('./karma.conf.js')(config);
  config.set({
    browsers: ['ChromeHeadless'],
    files: [
      { pattern: 'test/MusicalScore/Graphical/VexFlow/TabBends_Test.ts', included: true },
      { pattern: 'test/MusicalScore/Graphical/VexFlow/TabNotation_Test.ts', included: true }
    ]
  });
};
