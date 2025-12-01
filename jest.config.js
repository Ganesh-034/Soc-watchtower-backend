export default {
  testEnvironment: 'node',

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  transform: {},

  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/models/**'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
