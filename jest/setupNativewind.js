const { StyleSheet } = require('nativewind');

const originalGetFlag = StyleSheet.getFlag;
StyleSheet.getFlag = (name) => {
  if (name === 'darkMode') {
    return 'class';
  }
  return originalGetFlag(name);
};
