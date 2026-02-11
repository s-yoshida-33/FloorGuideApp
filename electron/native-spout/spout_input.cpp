//
// SpoutInput - Spout Receiver for Electron
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//
// SpoutDX internally manages the D3D11 device, shared texture connection,
// and keyed mutex handling. We simply call ReceiveTexture() (no args) to
// let SpoutDX receive into its internal texture, then ReadTexurePixels()
// to read the pixel data into a CPU buffer.
//

#include "spout_input.h"

void SpoutInput::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func =
        DefineClass(env, "SpoutInput",
            {InstanceAccessor("name", &SpoutInput::NameGetter, nullptr),
             InstanceMethod("pollReceiver", &SpoutInput::PollReceiver),
             InstanceMethod("getReceiverWidth", &SpoutInput::GetReceiverWidth),
             InstanceMethod("getReceiverHeight", &SpoutInput::GetReceiverHeight),
             InstanceMethod("receiveTexture", &SpoutInput::ReceiveTexture),
             InstanceMethod("getAvailableSenders", &SpoutInput::GetAvailableSenders),
             InstanceMethod("getDiagnostics", &SpoutInput::GetDiagnostics)});

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("SpoutInput", func);
}

SpoutInput::SpoutInput(const Napi::CallbackInfo &info) : ObjectWrap(info) {
    senderName = info[0].As<Napi::String>().Utf8Value();

    // Let SpoutDX manage its own D3D11 device internally.
    if (!senderName.empty()) {
        receiver.SetReceiverName(senderName.c_str());
    }

    initialized = true;
}

SpoutInput::~SpoutInput() {
    receiver.ReleaseReceiver();
    receiver.CloseDirectX11();
}

// ------------------------------------------------------------------
// pollReceiver() -> boolean
//
// ReceiveTexture() (no args) lets SpoutDX handle everything:
//   1. Creates D3D11 device if needed
//   2. Connects to sender via shared memory
//   3. Receives the shared texture into SpoutDX's internal texture
//   4. Returns true if a frame was received
// ------------------------------------------------------------------
Napi::Value SpoutInput::PollReceiver(const Napi::CallbackInfo &info) {
    if (!initialized) {
        return Napi::Boolean::New(info.Env(), false);
    }

    lastPollResult = receiver.ReceiveTexture();

    if (lastPollResult) {
        unsigned int w = receiver.GetSenderWidth();
        unsigned int h = receiver.GetSenderHeight();

        if (w > 0 && h > 0) {
            texWidth = w;
            texHeight = h;
        } else {
            lastPollResult = false;
        }
    }

    return Napi::Boolean::New(info.Env(), lastPollResult);
}

// ------------------------------------------------------------------
// getReceiverWidth() -> number
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetReceiverWidth(const Napi::CallbackInfo &info) {
    return Napi::Number::New(info.Env(), texWidth);
}

// ------------------------------------------------------------------
// getReceiverHeight() -> number
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetReceiverHeight(const Napi::CallbackInfo &info) {
    return Napi::Number::New(info.Env(), texHeight);
}

// ------------------------------------------------------------------
// receiveTexture() -> Buffer<uint8> | null
//
// Reads pixels from SpoutDX's internal texture using
// ReadTexurePixels() (no texture arg). SpoutDX handles
// staging texture creation and GPU->CPU copy internally.
// Then converts BGRA -> RGBA for Canvas ImageData.
// ------------------------------------------------------------------
Napi::Value SpoutInput::ReceiveTexture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!lastPollResult || texWidth == 0 || texHeight == 0) {
        return env.Null();
    }

    // Get the texture that ReceiveTexture() received into
    ID3D11Texture2D* tex = receiver.GetSenderTexture();
    if (!tex) {
        return env.Null();
    }

    // Allocate pixel buffer
    size_t bufferSize = (size_t)texWidth * texHeight * 4;
    auto buffer = Napi::Buffer<unsigned char>::New(env, bufferSize);
    unsigned char* pixels = buffer.Data();

    // ReadTexurePixels: GPU -> staging -> CPU copy
    // Note: method name has typo in Spout2 SDK ("Texure" not "Texture")
    if (!receiver.ReadTexurePixels(tex, pixels)) {
        return env.Null();
    }

    // Convert BGRA -> RGBA in-place
    // D3D11 DXGI_FORMAT_B8G8R8A8_UNORM = BGRA byte order
    // HTML Canvas ImageData = RGBA byte order
    for (size_t i = 0; i < bufferSize; i += 4) {
        unsigned char tmp = pixels[i];     // save B
        pixels[i]     = pixels[i + 2];    // B slot <- R
        pixels[i + 2] = tmp;              // R slot <- B
    }

    return buffer;
}

// ------------------------------------------------------------------
// getAvailableSenders() -> string[]
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetAvailableSenders(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    std::vector<std::string> senderList = receiver.GetSenderList();

    auto result = Napi::Array::New(env, senderList.size());
    for (uint32_t i = 0; i < senderList.size(); i++) {
        result.Set(i, Napi::String::New(env, senderList[i]));
    }

    return result;
}

// ------------------------------------------------------------------
// getDiagnostics() -> object
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetDiagnostics(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    auto result = Napi::Object::New(env);

    result.Set("senderName", Napi::String::New(env, senderName));
    result.Set("initialized", Napi::Boolean::New(env, initialized));
    result.Set("lastPollResult", Napi::Boolean::New(env, lastPollResult));
    result.Set("width", Napi::Number::New(env, texWidth));
    result.Set("height", Napi::Number::New(env, texHeight));

    ID3D11Device* dev = receiver.GetDX11Device();
    result.Set("hasDX11Device", Napi::Boolean::New(env, dev != nullptr));

    const char* connectedName = receiver.GetSenderName();
    result.Set("connectedSenderName",
               Napi::String::New(env, connectedName ? connectedName : ""));
    result.Set("isConnected", Napi::Boolean::New(env, receiver.IsConnected()));

    ID3D11Texture2D* tex = receiver.GetSenderTexture();
    result.Set("hasSenderTexture", Napi::Boolean::New(env, tex != nullptr));

    char activeName[256] = {};
    bool hasActive = receiver.GetActiveSender(activeName);
    result.Set("hasActiveSender", Napi::Boolean::New(env, hasActive));
    result.Set("activeSenderName", Napi::String::New(env, activeName));

    std::vector<std::string> senderList = receiver.GetSenderList();
    auto sendersArray = Napi::Array::New(env, senderList.size());
    for (uint32_t i = 0; i < senderList.size(); i++) {
        sendersArray.Set(i, Napi::String::New(env, senderList[i]));
    }
    result.Set("availableSenders", sendersArray);
    result.Set("senderCount", Napi::Number::New(env, (double)senderList.size()));

    return result;
}

// ------------------------------------------------------------------
// name (getter) -> string
// ------------------------------------------------------------------
Napi::Value SpoutInput::NameGetter(const Napi::CallbackInfo &info) {
    return Napi::String::New(info.Env(), senderName);
}
