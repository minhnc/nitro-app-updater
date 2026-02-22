require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AppUpdater"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"] || "https://github.com/minhnc/nitro-app-updater"
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.4" }
  s.swift_version = "5.9"
  s.source       = { :git => "https://github.com/minhnc/nitro-app-updater.git", :tag => "#{s.version}" }
  s.module_name  = "AppUpdater"

  s.source_files = "ios/**/*.{swift,h,m,mm}"
  
  # Add compiler flags for C++
  s.compiler_flags = '-x objective-c++'

  # Add support for React Native 0.79 or below (Folly flags)
  s.pod_target_xcconfig = {
    "HEADER_SEARCH_PATHS" => ["${PODS_ROOT}/RCT-Folly"],
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES",
    "OTHER_CPLUSPLUSFLAGS" => "$(inherited) -DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1"
  }

  load 'nitrogen/generated/ios/AppUpdater+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  s.dependency "NitroModules"
  
  install_modules_dependencies(s)
end
