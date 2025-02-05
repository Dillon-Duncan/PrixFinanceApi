module.exports = {
  env: { es6: true, node: true },
  parserOptions: { ecmaVersion: 2018 },
  extends: [
    "eslint:recommended",
    "google"
  ],
  rules: {
    "valid-jsdoc": "off",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { allowTemplateLiterals: true }],
    "camelcase": ["error", { properties: "always" }],
    "object-curly-spacing": ["error", "always"],
    "indent": ["error", 2],
    "max-len": ["error", { code: 120 }],
    "no-trailing-spaces": "error",
    "comma-dangle": ["error", "always-multiline"],
    "key-spacing": ["error", { beforeColon: false, afterColon: true }]
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: { mocha: true },
      rules: {}
    }
  ],
  globals: {}
};
