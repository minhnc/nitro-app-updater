module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.margelo.nitro.appupdater.AppUpdaterPackage;',
        packageInstance: 'new AppUpdaterPackage()',
      },
      ios: {},
    },
  },
};
