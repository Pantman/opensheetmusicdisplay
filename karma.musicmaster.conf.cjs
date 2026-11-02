// Focused source regressions; the app runs its own integration/rendering suite.
module.exports = function (config) {
  require('./karma.conf.js')(config);
  config.set({
    browsers: ['ChromeHeadless'],
    files: [
      { pattern: 'test/MusicalScore/Graphical/VexFlow/Tab*_Test.ts', included: true },
      { pattern: 'test/MusicalScore/Graphical/VexFlow/VibratoGraceAnchors_Test.ts', included: true },
      { pattern: 'test/MusicalScore/Graphical/VexFlow/GlissandoCourtesy_Test.ts', included: true }
    ]
  });
};
