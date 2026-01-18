import {
  type ConfigPlugin,
  withXcodeProject,
  withPodfileProperties,
} from "@expo/config-plugins";

/**
 * Expo Config Plugin for @minhnc/nitro-app-updater.
 * Handles the necessary native configuration for Nitro Modules.
 */
const withNitroAppUpdater: ConfigPlugin = (config) => {
  // 1. Ensure Swift C++ Interoperability is enabled
  config = withPodfileProperties(config, (props) => {
    props.modResults["ios.cxxInterop"] = "true";
    return props;
  });

  // 2. Set CLANG_CXX_LIBRARY and other build settings in Xcode
  config = withXcodeProject(config, (project) => {
    const xcodeProject = project.modResults;
    const configurations = xcodeProject.pbxProjectSection();

    for (const key in configurations) {
      const buildConfig = configurations[key];
      if (buildConfig && typeof buildConfig.buildSettings !== "undefined") {
        const buildSettings = buildConfig.buildSettings;
        
        // Ensure C++ standard is c++20 (matching Nitro)
        buildSettings.CLANG_CXX_LANGUAGE_STANDARD = '"c++20"';
        // Force libc++ to solve the <functional> missing issue
        buildSettings.CLANG_CXX_LIBRARY = '"libc++"';
        // Enables C++ <-> Swift interop
        buildSettings.SWIFT_OBJC_INTEROP_MODE = "objcxx";
        buildSettings.SWIFT_CXX_INTEROPERABILITY_MODE = '"default"';
        // Enable modules
        buildSettings.CLANG_ENABLE_MODULES = "YES";
        buildSettings.DEFINES_MODULE = "YES";
        // Force C++20 flag
        if (!buildSettings.OTHER_CPLUSPLUSFLAGS) {
           buildSettings.OTHER_CPLUSPLUSFLAGS = ['$(inherited)', "-std=c++20"];
        } else if (typeof buildSettings.OTHER_CPLUSPLUSFLAGS === 'string') {
           if (!buildSettings.OTHER_CPLUSPLUSFLAGS.includes("-std=c++20")) {
             buildSettings.OTHER_CPLUSPLUSFLAGS += ' -std=c++20';
           }
        }
      }
    }

    return project;
  });

  return config;
};

export default withNitroAppUpdater;
