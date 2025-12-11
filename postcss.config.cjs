// postcss.config.cjs
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'), // Ancien require('tailwindcss')
    require('autoprefixer'),
  ],
};