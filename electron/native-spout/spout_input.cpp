//
// SpoutInput - Spout Receiver for Electron
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//
// Uses ReceiveImage() which internally uses double-buffered staging
// textures for efficient async GPU readback:
//   - CopyResource to staging[A] (fast GPU copy, ~<1ms)
//   - ReadPixelData from staging[B] (previously copied, non-blocking)
//   - Shared texture mutex held only during CopyResource
//   - Result: ~2.5-3.5ms per frame at 1920x1080 (vs 7-12ms single staging)
//
// SetSwap(true) enables internal BGRA->RGBA conversion, eliminating
// the need for a manual byte-swap loop on the CPU.
//
// IMPORTANT: ReceiveImage() is the SOLE receive call. Do NOT also call
// ReceiveTexture() as it would consume the frame, causing ReceiveImage()
// to see no new frame data.
//

#include "spout_input.h"

void SpoutInput::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func =
        DefineClass(env, "SpoutInput",
            {InstanceAccessor("name", &SpoutInput::NameGetter, nullptr),
             InstanceMethod("pollReceiver", &SpoutInput::PollReceiver),
             InstanceMethod("getReceiverWidth", &SpoutInput::GetReceiverWidth),
             InstanceMethod("getReceiverHeight", &SpoutInput::GetReceiverHeight),
             InstanceMethod("receiveTexture", &SpoutInput::ReceiveFrame),
             InstanceMethod("getAvailableSenders", &SpoutInput::GetAvailableSenders),
             InstanceMethod("getDiagnostics", &SpoutInput::GetDiagnostics)});

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("SpoutInput", func);
}

SpoutInput::SpoutInput(const Napi::CallbackInfo &info) : ObjectWrap(info) {
    senderName = info[0].As<Napi::String>().Utf8Value();

    if (!senderName.empty()) {
        receiver.SetReceiverName(senderName.c_str());
    }

    // Enable internal BGRA -> RGBA swap so we don't need a CPU loop
    receiver.SetSwap(true);

    initialized = true;
}

SpoutInput::~SpoutInput() {
    receiver.ReleaseReceiver();
    receiver.CloseDirectX11();
}

// ------------------------------------------------------------------
// pollReceiver() -> boolean
//
// Returns the current connection state. Does NOT call ReceiveTexture()
// to avoid consuming the frame before ReceiveFrame/ReceiveImage.
// ------------------------------------------------------------------
Napi::Value SpoutInput::PollReceiver(const Napi::CallbackInfo &info) {
    if (!initialized) {
        return Napi::Boolean::New(info.Env(), false);
    }
    return Napi::Boolean::New(info.Env(), connected);
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
// All-in-one: connection + receive + pixel readback via ReceiveImage().
//
// Flow:
//   1. If no dimensions yet: call ReceiveImage(nullptr) to probe/connect.
//      On first sender detection, IsUpdated() returns true and we read
//      the sender dimensions. Return null (no pixels yet).
//   2. Once dimensions are known: call ReceiveImage(pixels, w, h) to
//      receive a frame with double-buffered async GPU readback.
//   3. If sender resizes: IsUpdated() fires, we update dimensions and
//      return null for one frame to reallocate.
// ------------------------------------------------------------------
Napi::Value SpoutInput::ReceiveFrame(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!initialized) {
        return env.Null();
    }

    // Phase 1: No dimensions yet - probe for sender
    if (texWidth == 0 || texHeight == 0) {
        // ReceiveImage with nullptr: connects to sender and returns true
        // when a sender is found (m_bUpdated set). No pixel readback.
        if (receiver.ReceiveImage(nullptr, 0, 0, false, false)) {
            if (receiver.IsUpdated()) {
                texWidth = receiver.GetSenderWidth();
                texHeight = receiver.GetSenderHeight();
                connected = (texWidth > 0 && texHeight > 0);
            }
        }
        return env.Null();
    }

    // Phase 2: Dimensions known - receive frame with pixel readback
    size_t bufferSize = (size_t)texWidth * texHeight * 4;
    auto buffer = Napi::Buffer<unsigned char>::New(env, bufferSize);
    unsigned char* pixels = buffer.Data();

    if (!receiver.ReceiveImage(pixels, texWidth, texHeight, false, false)) {
        // Connection lost
        connected = false;
        texWidth = 0;
        texHeight = 0;
        return env.Null();
    }

    // Handle sender resize (dimensions changed)
    if (receiver.IsUpdated()) {
        texWidth = receiver.GetSenderWidth();
        texHeight = receiver.GetSenderHeight();
        // Buffer was allocated with old dimensions, skip this frame
        return env.Null();
    }

    connected = true;
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
    result.Set("connected", Napi::Boolean::New(env, connected));
    result.Set("width", Napi::Number::New(env, texWidth));
    result.Set("height", Napi::Number::New(env, texHeight));

    ID3D11Device* dev = receiver.GetDX11Device();
    result.Set("hasDX11Device", Napi::Boolean::New(env, dev != nullptr));

    const char* connectedName = receiver.GetSenderName();
    result.Set("connectedSenderName",
               Napi::String::New(env, connectedName ? connectedName : ""));
    result.Set("isConnected", Napi::Boolean::New(env, receiver.IsConnected()));

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
