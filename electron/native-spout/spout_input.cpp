//
// SpoutInput - Spout Receiver for Electron
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//
// Uses SpoutDX built-in methods:
//   - GetSenderList() for sender discovery
//   - ReceiveTexture() for frame reception
//   - GetSenderTexture() + ReadTexurePixels() for CPU readback
//   - SpoutDX manages all D3D11 devices and staging textures internally
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
    // Do NOT call OpenDirectX11() with our own device - this ensures
    // compatibility with the sender's shared texture format and adapter.

    // Set the sender name we want to receive from.
    // If empty, SpoutDX connects to the active (first available) sender.
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
// ReceiveTexture() does everything:
//   1. Creates D3D11 device if needed
//   2. Connects to sender via shared memory
//   3. Opens the shared texture
//   4. Returns true if connected
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
// Uses SpoutDX's built-in ReadTexurePixels() to read the
// received texture to CPU memory. Then converts BGRA -> RGBA.
// ------------------------------------------------------------------
Napi::Value SpoutInput::ReceiveTexture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!lastPollResult || texWidth == 0 || texHeight == 0) {
        return env.Null();
    }

    // Get the sender's shared texture (received by PollReceiver)
    ID3D11Texture2D* senderTex = receiver.GetSenderTexture();
    if (!senderTex) {
        return env.Null();
    }

    // Allocate pixel buffer (BGRA format from D3D11)
    size_t bufferSize = (size_t)texWidth * texHeight * 4;
    auto buffer = Napi::Buffer<unsigned char>::New(env, bufferSize);
    unsigned char* pixels = buffer.Data();

    // ReadTexurePixels handles staging texture creation and
    // GPU -> CPU copy internally using SpoutDX's resources.
    // Note: method name has typo in original SDK ("Texure" not "Texture")
    if (!receiver.ReadTexurePixels(senderTex, pixels)) {
        return env.Null();
    }

    // Convert BGRA -> RGBA in-place
    // D3D11 DXGI_FORMAT_B8G8R8A8_UNORM uses BGRA byte order
    // HTML Canvas ImageData expects RGBA byte order
    for (size_t i = 0; i < bufferSize; i += 4) {
        unsigned char tmp = pixels[i];     // B
        pixels[i]     = pixels[i + 2];    // R <- B position gets R
        pixels[i + 2] = tmp;              // B <- R position gets B
    }

    return buffer;
}

// ------------------------------------------------------------------
// getAvailableSenders() -> string[]
// Lists all active Spout senders on this system.
// Uses SpoutDX built-in sender enumeration.
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetAvailableSenders(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    // GetSenderList() returns all active sender names
    std::vector<std::string> senderList = receiver.GetSenderList();

    auto result = Napi::Array::New(env, senderList.size());
    for (uint32_t i = 0; i < senderList.size(); i++) {
        result.Set(i, Napi::String::New(env, senderList[i]));
    }

    return result;
}

// ------------------------------------------------------------------
// getDiagnostics() -> object
// Returns diagnostic information for troubleshooting.
// ------------------------------------------------------------------
Napi::Value SpoutInput::GetDiagnostics(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    auto result = Napi::Object::New(env);

    result.Set("senderName", Napi::String::New(env, senderName));
    result.Set("initialized", Napi::Boolean::New(env, initialized));
    result.Set("lastPollResult", Napi::Boolean::New(env, lastPollResult));
    result.Set("width", Napi::Number::New(env, texWidth));
    result.Set("height", Napi::Number::New(env, texHeight));

    // SpoutDX's internal D3D11 device status
    ID3D11Device* dev = receiver.GetDX11Device();
    result.Set("hasDX11Device", Napi::Boolean::New(env, dev != nullptr));

    // Connected sender info
    const char* connectedName = receiver.GetSenderName();
    result.Set("connectedSenderName",
               Napi::String::New(env, connectedName ? connectedName : ""));
    result.Set("isConnected", Napi::Boolean::New(env, receiver.IsConnected()));

    // Sender texture availability
    ID3D11Texture2D* tex = receiver.GetSenderTexture();
    result.Set("hasSenderTexture", Napi::Boolean::New(env, tex != nullptr));

    // Active sender
    char activeName[256] = {};
    bool hasActive = receiver.GetActiveSender(activeName);
    result.Set("hasActiveSender", Napi::Boolean::New(env, hasActive));
    result.Set("activeSenderName", Napi::String::New(env, activeName));

    // All available senders
    std::vector<std::string> senderList = receiver.GetSenderList();
    auto sendersArray = Napi::Array::New(env, senderList.size());
    for (uint32_t i = 0; i < senderList.size(); i++) {
        sendersArray.Set(i, Napi::String::New(env, senderList[i]));
    }
    result.Set("availableSenders", sendersArray);
    result.Set("senderCount", Napi::Number::New(env, (double)senderList.size()));

    // Sender details for each available sender
    auto detailsArray = Napi::Array::New(env, senderList.size());
    for (uint32_t i = 0; i < senderList.size(); i++) {
        unsigned int sw = 0, sh = 0;
        HANDLE dxHandle = nullptr;
        DWORD dwFormat = 0;
        if (receiver.GetSenderInfo(senderList[i].c_str(), sw, sh, dxHandle, dwFormat)) {
            auto detail = Napi::Object::New(env);
            detail.Set("name", Napi::String::New(env, senderList[i]));
            detail.Set("width", Napi::Number::New(env, sw));
            detail.Set("height", Napi::Number::New(env, sh));
            detail.Set("format", Napi::Number::New(env, dwFormat));
            detailsArray.Set(i, detail);
        }
    }
    result.Set("senderDetails", detailsArray);

    return result;
}

// ------------------------------------------------------------------
// name (getter) -> string
// ------------------------------------------------------------------
Napi::Value SpoutInput::NameGetter(const Napi::CallbackInfo &info) {
    return Napi::String::New(info.Env(), senderName);
}
