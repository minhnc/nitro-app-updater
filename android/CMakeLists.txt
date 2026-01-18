cmake_minimum_required(VERSION 3.18.0)

project(AppUpdater)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find all C++ files (shared and platform specifics)
file(GLOB_RECURSE shared_files RELATIVE ${CMAKE_SOURCE_DIR}
     "../cpp/**.cpp"
)
file(GLOB_RECURSE android_files RELATIVE ${CMAKE_SOURCE_DIR}
     "src/main/cpp/**.cpp"
)

# Define C++ library and add all sources
add_library(AppUpdater SHARED
  ${shared_files}
  ${android_files}
)

# Include Nitrogen autolinking (this adds all sources, includes, and links)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/AppUpdater+autolinking.cmake)

find_library(LOG_LIB log)

# Link all libraries together
target_link_libraries(
        AppUpdater
        ${LOG_LIB}
        android
)

# Note: NitroModules is linked automatically by the autolinking script above.


