//
// SpoutInput - Spout Receiver for Electron
// Based on electron-spout (reitowo/electron-spout) architecture
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//

#ifndef ELECTRON_SPOUT_SPOUT_INPUT_H
#define ELECTRON_SPOUT_SPOUT_INPUT_H

#include "SpoutDX/SpoutDX.h"
#include <napi.h>
#include <d3d11.h>
#include <d3d11_1.h>
#include <dxgi.h>
#include <string>

class SpoutInput : public Napi::ObjectWrap<SpoutInput> {
public:
    static void Init(Napi::Env env, Napi::Object exports);

    SpoutInput(const Napi::CallbackInfo &info);
    ~SpoutInput();

    // JavaScript API - matches the interface expected by spout.cjs
    Napi::Value PollReceiver(const Napi::CallbackInfo &info);
    Napi::Value GetReceiverWidth(const Napi::CallbackInfo &info);
    Napi::Value GetReceiverHeight(const Napi::CallbackInfo &info);
    Napi::Value ReceiveTexture(const Napi::CallbackInfo &info);

    Napi::Value NameGetter(const Napi::CallbackInfo &info);

private:
    spoutDX receiver = {};

    // D3D11 resources
    ID3D11Device* device = nullptr;
    ID3D11Device1* device1 = nullptr;
    ID3D11DeviceContext* context = nullptr;

    // Texture for receiving from Spout (GPU default usage)
    ID3D11Texture2D* receiveTexture = nullptr;

    // Staging texture for CPU readback
    ID3D11Texture2D* stagingTexture = nullptr;

    // Cached state from last pollReceiver call
    unsigned int texWidth = 0;
    unsigned int texHeight = 0;
    bool lastPollResult = false;

    std::string senderName;

    void InitializeDevice();
    void EnsureTextures(unsigned int width, unsigned int height);
    void ReleaseTextures();
};

#endif // ELECTRON_SPOUT_SPOUT_INPUT_H
