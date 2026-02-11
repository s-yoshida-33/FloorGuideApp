//
// SpoutInput - Spout Receiver for Electron
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//
// Uses SpoutDX built-in methods for all D3D11/staging operations.
//

#ifndef ELECTRON_SPOUT_SPOUT_INPUT_H
#define ELECTRON_SPOUT_SPOUT_INPUT_H

#include "SpoutDX/SpoutDX.h"
#include <napi.h>
#include <string>

class SpoutInput : public Napi::ObjectWrap<SpoutInput> {
public:
    static void Init(Napi::Env env, Napi::Object exports);

    SpoutInput(const Napi::CallbackInfo &info);
    ~SpoutInput();

    // JavaScript API
    Napi::Value PollReceiver(const Napi::CallbackInfo &info);
    Napi::Value GetReceiverWidth(const Napi::CallbackInfo &info);
    Napi::Value GetReceiverHeight(const Napi::CallbackInfo &info);
    Napi::Value ReceiveTexture(const Napi::CallbackInfo &info);

    // Diagnostic API
    Napi::Value GetAvailableSenders(const Napi::CallbackInfo &info);
    Napi::Value GetDiagnostics(const Napi::CallbackInfo &info);

    Napi::Value NameGetter(const Napi::CallbackInfo &info);

private:
    spoutDX receiver;

    unsigned int texWidth = 0;
    unsigned int texHeight = 0;
    bool lastPollResult = false;
    bool initialized = false;

    std::string senderName;
};

#endif // ELECTRON_SPOUT_SPOUT_INPUT_H
