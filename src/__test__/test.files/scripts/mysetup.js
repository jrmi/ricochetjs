var main = ({ content }) => {
  content.response = 42;
  return 'foo';
};

Object.defineProperty(exports, '__esModule', {
  value: true,
});

exports.default = main;
