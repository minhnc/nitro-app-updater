module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.minhnc.appupdater.AppUpdaterPackage;',
        packageInstance: 'new AppUpdaterPackage()',
      },
      ios: {},
    },
  },
};
