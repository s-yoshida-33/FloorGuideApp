//
// electron-spout native module with both Output (sender) and Input (receiver)
//
// Exports:
//   SpoutOutput - Send Electron frames TO Spout (from original electron-spout)
//   SpoutInput  - Receive frames FROM a Spout sender (new, for Wonder Flow)
//

#include <napi.h>
#include "spout_input.h"

// If building with SpoutOutput support, include its header
// (Copy spout_output.h and spout_output.cpp from reitowo/electron-spout)
#ifdef INCLUDE_SPOUT_OUTPUT
#include "spout_output.h"
#endif

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Register SpoutInput (receiver) - new class for receiving from Wonder Flow
    SpoutInput::Init(env, exports);

#ifdef INCLUDE_SPOUT_OUTPUT
    // Register SpoutOutput (sender) - from original electron-spout
    SpoutOutput::Init(env, exports);
#endif

    return exports;
}

NODE_API_MODULE(addon, Init)
