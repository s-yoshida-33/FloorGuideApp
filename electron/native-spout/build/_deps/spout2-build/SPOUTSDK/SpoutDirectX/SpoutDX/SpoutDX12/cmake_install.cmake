# Install script for directory: C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/SpoutDX12

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/INSTALL")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Release")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "FALSE")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY OPTIONAL FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/Debug/SpoutDX12.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY OPTIONAL FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/Release/SpoutDX12.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Mm][Ii][Nn][Ss][Ii][Zz][Ee][Rr][Ee][Ll])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY OPTIONAL FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/MinSizeRel/SpoutDX12.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ww][Ii][Tt][Hh][Dd][Ee][Bb][Ii][Nn][Ff][Oo])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY OPTIONAL FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/RelWithDebInfo/SpoutDX12.lib")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/bin" TYPE SHARED_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/bin/Debug/SpoutDX12.dll")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/bin" TYPE SHARED_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/bin/Release/SpoutDX12.dll")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Mm][Ii][Nn][Ss][Ii][Zz][Ee][Rr][Ee][Ll])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/bin" TYPE SHARED_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/bin/MinSizeRel/SpoutDX12.dll")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ww][Ii][Tt][Hh][Dd][Ee][Bb][Ii][Nn][Ff][Oo])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/bin" TYPE SHARED_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/bin/RelWithDebInfo/SpoutDX12.dll")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/Debug/SpoutDX12_static.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ee][Aa][Ss][Ee])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/Release/SpoutDX12_static.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Mm][Ii][Nn][Ss][Ii][Zz][Ee][Rr][Ee][Ll])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/MinSizeRel/SpoutDX12_static.lib")
  elseif(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Rr][Ee][Ll][Ww][Ii][Tt][Hh][Dd][Ee][Bb][Ii][Nn][Ff][Oo])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/lib/RelWithDebInfo/SpoutDX12_static.lib")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/SpoutDX12" TYPE FILE FILES
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/SpoutDX12/SpoutDX12.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/SpoutDX.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutCommon.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutCopy.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutDirectX.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutFrameCount.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutSenderNames.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutSharedMemory.h"
    "C:/dev/Gido/electron/native-spout/build/_deps/spout2-src/SPOUTSDK/SpoutDirectX/SpoutDX/../../SpoutGL/SpoutUtils.h"
    )
endif()

string(REPLACE ";" "\n" CMAKE_INSTALL_MANIFEST_CONTENT
       "${CMAKE_INSTALL_MANIFEST_FILES}")
if(CMAKE_INSTALL_LOCAL_ONLY)
  file(WRITE "C:/dev/Gido/electron/native-spout/build/_deps/spout2-build/SPOUTSDK/SpoutDirectX/SpoutDX/SpoutDX12/install_local_manifest.txt"
     "${CMAKE_INSTALL_MANIFEST_CONTENT}")
endif()
