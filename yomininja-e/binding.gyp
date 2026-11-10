{
  "variables": {
    "msbuild_toolset%": "v142"
  },
  "targets": [
    {
      "target_name": "window_manager_win32",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS == 'win'", {
          "sources": [ "./gyp_modules/window_management/win32/window_manager_win32.cc" ],
          "libraries": [ "-lDwmapi" ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": [ "/std:c++17" ]
            }
          }
        }]
      ]
    },
    {
      "target_name": "wgc_capture_win32",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS",
        "WINRT_LEAN_AND_MEAN",
        "UNICODE",
        "_UNICODE"
      ],
      "conditions": [
        ["OS == 'win'", {
          "sources": [ "./gyp_modules/wgc_capture/win32/wgc_capture_win32.cc" ],
          "libraries": [
            "-ld3d11",
            "-ldxgi",
            "-lwindowsapp"
          ],
          "defines!": [ "_HAS_EXCEPTIONS=0" ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "RuntimeTypeInfo": "true",
              "AdditionalOptions": [
                "/std:c++20",
                "/EHsc",
                "/await",
                "/permissive-",
                "/D_HAS_EXCEPTIONS=1"
              ]
            }
          }
        }]
      ]
    }
  ]
}
