cmake_minimum_required(VERSION 3.25)

# vcpkg を使わない場合は toolchain file を無効化
# (cmake-js が自動で付けてくる場合があるため)
if(NOT EXISTS "${CMAKE_TOOLCHAIN_FILE}")
    unset(CMAKE_TOOLCHAIN_FILE)
endif()

project(electron_spout)

set(CMAKE_CXX_STANDARD 17)

include(FetchContent)

# ========================================
# node-addon-api (N-API wrapper)
# ========================================
# cmake-js が提供する include パスを使用
include_directories(${CMAKE_JS_INC})

# node-addon-api の include パスを追加
# npm install で入っている node-addon-api のパスを探す
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
    ERROR_QUIET
)
# 親プロジェクトの node_modules を探す
if(NOT NODE_ADDON_API_DIR OR NODE_ADDON_API_DIR STREQUAL "")
    execute_process(
        COMMAND node -p "require('node-addon-api').include"
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}/../..
        OUTPUT_VARIABLE NODE_ADDON_API_DIR
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
    )
endif()
if(NODE_ADDON_API_DIR)
    # Remove quotes if present
    string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
    include_directories(${NODE_ADDON_API_DIR})
    message(STATUS "Found node-addon-api: ${NODE_ADDON_API_DIR}")
else()
    message(WARNING "node-addon-api not found. Run 'npm install' in the parent project first.")
endif()

# NAPI_VERSION を定義 (node-addon-api v8+ 用)
add_compile_definitions(NAPI_VERSION=9)

# ========================================
# Spout2 SDK (FetchContent - vcpkg不要)
# ========================================
FetchContent_Declare(
    spout2
    GIT_REPOSITORY https://github.com/leadedge/Spout2.git
    GIT_TAG        master
    GIT_SHALLOW    TRUE
)

# Spout2 のオプション設定
set(SPOUT_BUILD_SPOUTDX ON CACHE BOOL "" FORCE)
set(SPOUT_BUILD_CMT OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build Spout2 as static library" FORCE)

FetchContent_MakeAvailable(spout2)

# ========================================
# Source files
# ========================================
set(SOURCES
    main.cpp
    spout_input.cpp
    spout_input.h
    ${CMAKE_JS_SRC}
)

# Optionally include SpoutOutput (sender)
option(INCLUDE_SPOUT_OUTPUT "Include SpoutOutput (sender) class" OFF)
if(INCLUDE_SPOUT_OUTPUT)
    list(APPEND SOURCES spout_output.cpp spout_output.h)
    add_compile_definitions(INCLUDE_SPOUT_OUTPUT)
endif()

# ========================================
# Build the native module (.node)
# ========================================
add_library(electron_spout SHARED ${SOURCES})
set_target_properties(electron_spout PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "electron-spout"
)

# ========================================
# Include paths for Spout2
# ========================================
target_include_directories(electron_spout PRIVATE
    ${spout2_SOURCE_DIR}/SPOUTSDK/SpoutDirectX
    ${spout2_SOURCE_DIR}/SPOUTSDK/SpoutGL
    ${spout2_SOURCE_DIR}/SPOUTSDK
)

# ========================================
# Link libraries
# ========================================
target_link_libraries(electron_spout PRIVATE
    ${CMAKE_JS_LIB}
    delayimp.lib
    dxgi.lib
    dxguid.lib
    d3d11.lib
)

# Link Spout2 libraries (built by FetchContent)
if(TARGET Spout_static)
    target_link_libraries(electron_spout PRIVATE Spout_static)
endif()
if(TARGET SpoutDX_static)
    target_link_libraries(electron_spout PRIVATE SpoutDX_static)
elseif(TARGET SpoutDX)
    target_link_libraries(electron_spout PRIVATE SpoutDX)
endif()
# Fallback: if targets have different names
if(TARGET Spout2::Spout_static)
    target_link_libraries(electron_spout PRIVATE Spout2::Spout_static)
endif()
if(TARGET Spout2::SpoutDX_static)
    target_link_libraries(electron_spout PRIVATE Spout2::SpoutDX_static)
endif()
