//
// SpoutInput - Spout Receiver for Electron
// Receives textures FROM a Spout sender (e.g., Wonder Flow)
//
// Architecture:
//   Wonder Flow (Spout Sender)
//     -> Shared GPU Texture (D3D11)
//       -> SpoutDX receiver.ReceiveTexture() copies to our receiveTexture
//         -> CopyResource to stagingTexture (CPU-readable)
//           -> Map & read pixels -> Node.js Buffer (RGBA)
//

#include "spout_input.h"
#include <cstring>
#include <wrl/client.h>

void SpoutInput::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func =
        DefineClass(env, "SpoutInput",
            {InstanceAccessor("name", &SpoutInput::NameGetter, nullptr),
             InstanceMethod("pollReceiver", &SpoutInput::PollReceiver),
             InstanceMethod("getReceiverWidth", &SpoutInput::GetReceiverWidth),
             InstanceMethod("getReceiverHeight", &SpoutInput::GetReceiverHeight),
             InstanceMethod("receiveTexture", &SpoutInput::ReceiveTexture)});

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("SpoutInput", func);
}

SpoutInput::SpoutInput(const Napi::CallbackInfo &info) : ObjectWrap(info) {
    senderName = info[0].As<Napi::String>().Utf8Value();

    InitializeDevice();

    if (device == nullptr) {
        Napi::TypeError::New(this->Env(), "SpoutInput: D3D11 device creation failed")
            .ThrowAsJavaScriptException();
        return;
    }

    // Initialize SpoutDX receiver with our D3D11 device
    receiver.OpenDirectX11(device);

    // Set the sender name we want to receive from
    // This tells SpoutDX to look for a sender with this exact name
    receiver.SetReceiverName(senderName.c_str());
}

SpoutInput::~SpoutInput() {
    receiver.ReleaseReceiver();
    receiver.CloseDirectX11();
    ReleaseTextures();
    if (device1) device1->Release();
    if (context) context->Release();
    if (device) device->Release();
}

// ------------------------------------------------------------------
// pollReceiver() -> boolean
// Checks if the Spout sender is available and receives the current frame.
// Returns true if connected and frame is available, false otherwise.
// After a successful poll, getReceiverWidth/Height return valid dimensions.
// ------------------------------------------------------------------
Napi::Value SpoutInput::PollReceiver(const Napi::CallbackInfo &info) {
    // ReceiveTexture() without arguments:
    // - Attempts to connect to the named sender
    // - If connected, receives the shared texture internally
    // - Returns true if a sender is found and connected
    lastPollResult = receiver.ReceiveTexture();

    if (lastPollResult) {
        unsigned int w = receiver.GetSenderWidth();
        unsigned int h = receiver.GetSenderHeight();

        if (w > 0 && h > 0) {
            // Ensure our textures match the sender dimensions
            EnsureTextures(w, h);
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
// Reads the current frame pixels from the Spout sender.
// Must be called after a successful pollReceiver().
// Returns an RGBA pixel buffer, or null on failure.
// ------------------------------------------------------------------
Napi::Value SpoutInput::ReceiveTexture(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (!lastPollResult || texWidth == 0 || texHeight == 0 ||
        !receiveTexture || !stagingTexture) {
        return env.Null();
    }

    // Receive the texture into our receiveTexture (GPU default texture).
    // This copies the shared texture from the sender to our texture.
    if (!receiver.ReceiveTexture(&receiveTexture)) {
        return env.Null();
    }

    // Check if sender dimensions changed since pollReceiver
    if (receiver.IsUpdated()) {
        unsigned int w = receiver.GetSenderWidth();
        unsigned int h = receiver.GetSenderHeight();
        if (w != texWidth || h != texHeight) {
            EnsureTextures(w, h);
            // Re-receive with correctly sized texture
            if (!receiver.ReceiveTexture(&receiveTexture)) {
                return env.Null();
            }
        }
    }

    // Copy GPU receiveTexture -> CPU stagingTexture
    context->CopyResource(stagingTexture, receiveTexture);

    // Map the staging texture for CPU read
    D3D11_MAPPED_SUBRESOURCE mapped;
    HRESULT hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
    if (FAILED(hr)) {
        return env.Null();
    }

    // Allocate Node.js buffer for RGBA pixel data
    size_t bufferSize = (size_t)texWidth * texHeight * 4;
    auto buffer = Napi::Buffer<unsigned char>::New(env, bufferSize);
    unsigned char* dst = buffer.Data();
    unsigned char* src = static_cast<unsigned char*>(mapped.pData);

    // Copy pixels with BGRA -> RGBA conversion
    // Spout/D3D11 uses DXGI_FORMAT_B8G8R8A8_UNORM (BGRA)
    // Canvas ImageData expects RGBA
    unsigned int rowBytes = texWidth * 4;
    for (unsigned int y = 0; y < texHeight; y++) {
        unsigned char* srcRow = src + y * mapped.RowPitch;
        unsigned char* dstRow = dst + y * rowBytes;
        for (unsigned int x = 0; x < texWidth; x++) {
            size_t i = (size_t)x * 4;
            dstRow[i + 0] = srcRow[i + 2]; // R <- B
            dstRow[i + 1] = srcRow[i + 1]; // G <- G
            dstRow[i + 2] = srcRow[i + 0]; // B <- R
            dstRow[i + 3] = srcRow[i + 3]; // A <- A
        }
    }

    context->Unmap(stagingTexture, 0);

    return buffer;
}

// ------------------------------------------------------------------
// name (getter) -> string
// ------------------------------------------------------------------
Napi::Value SpoutInput::NameGetter(const Napi::CallbackInfo &info) {
    return Napi::String::New(info.Env(), senderName);
}

// ------------------------------------------------------------------
// D3D11 device initialization
// (Same pattern as SpoutOutput from electron-spout)
// ------------------------------------------------------------------
void SpoutInput::InitializeDevice() {
    HRESULT hr;

    D3D_FEATURE_LEVEL FeatureLevels[] = {
        D3D_FEATURE_LEVEL_11_1};
    UINT NumFeatureLevels = ARRAYSIZE(FeatureLevels);
    D3D_FEATURE_LEVEL FeatureLevel;

    UINT creationFlags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;

    IDXGIFactory2 *pDXGIFactory = nullptr;
    IDXGIAdapter *pAdapter = nullptr;

    hr = CreateDXGIFactory(IID_IDXGIFactory2, (void **)&pDXGIFactory);
    if (FAILED(hr)) {
        Napi::TypeError::New(this->Env(), "SpoutInput: CreateDXGIFactory failed")
            .ThrowAsJavaScriptException();
        return;
    }

    hr = pDXGIFactory->EnumAdapters(0, &pAdapter);
    if (FAILED(hr)) {
        pDXGIFactory->Release();
        Napi::TypeError::New(this->Env(), "SpoutInput: EnumAdapters failed")
            .ThrowAsJavaScriptException();
        return;
    }

    hr = D3D11CreateDevice(pAdapter, D3D_DRIVER_TYPE_UNKNOWN, nullptr,
                           creationFlags, FeatureLevels, NumFeatureLevels,
                           D3D11_SDK_VERSION, &device, &FeatureLevel, &context);
    if (FAILED(hr)) {
        pAdapter->Release();
        pDXGIFactory->Release();
        Napi::TypeError::New(this->Env(), "SpoutInput: D3D11CreateDevice failed")
            .ThrowAsJavaScriptException();
        return;
    }

    hr = device->QueryInterface(IID_PPV_ARGS(&device1));
    if (FAILED(hr)) {
        context->Release(); context = nullptr;
        device->Release(); device = nullptr;
        pAdapter->Release();
        pDXGIFactory->Release();
        Napi::TypeError::New(this->Env(), "SpoutInput: ID3D11Device1 query failed")
            .ThrowAsJavaScriptException();
        return;
    }

    pAdapter->Release();
    pDXGIFactory->Release();
}

// ------------------------------------------------------------------
// Ensure receive and staging textures match the given dimensions
// ------------------------------------------------------------------
void SpoutInput::EnsureTextures(unsigned int width, unsigned int height) {
    if (texWidth == width && texHeight == height &&
        receiveTexture != nullptr && stagingTexture != nullptr) {
        return;
    }

    ReleaseTextures();

    texWidth = width;
    texHeight = height;

    // Receive texture - GPU default usage for receiving from Spout
    D3D11_TEXTURE2D_DESC recvDesc;
    ZeroMemory(&recvDesc, sizeof(recvDesc));
    recvDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    recvDesc.Width = width;
    recvDesc.Height = height;
    recvDesc.ArraySize = 1;
    recvDesc.MipLevels = 1;
    recvDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    recvDesc.Usage = D3D11_USAGE_DEFAULT;
    recvDesc.CPUAccessFlags = 0;
    recvDesc.SampleDesc.Count = 1;
    recvDesc.SampleDesc.Quality = 0;
    recvDesc.MiscFlags = D3D11_RESOURCE_MISC_SHARED;

    HRESULT hr = device->CreateTexture2D(&recvDesc, nullptr, &receiveTexture);
    if (FAILED(hr)) {
        Napi::TypeError::New(this->Env(), "SpoutInput: Create receive texture failed")
            .ThrowAsJavaScriptException();
        return;
    }

    // Staging texture - CPU readable for pixel readback
    D3D11_TEXTURE2D_DESC stageDesc;
    ZeroMemory(&stageDesc, sizeof(stageDesc));
    stageDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    stageDesc.Width = width;
    stageDesc.Height = height;
    stageDesc.ArraySize = 1;
    stageDesc.MipLevels = 1;
    stageDesc.BindFlags = 0;
    stageDesc.Usage = D3D11_USAGE_STAGING;
    stageDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    stageDesc.SampleDesc.Count = 1;
    stageDesc.SampleDesc.Quality = 0;
    stageDesc.MiscFlags = 0;

    hr = device->CreateTexture2D(&stageDesc, nullptr, &stagingTexture);
    if (FAILED(hr)) {
        if (receiveTexture) { receiveTexture->Release(); receiveTexture = nullptr; }
        Napi::TypeError::New(this->Env(), "SpoutInput: Create staging texture failed")
            .ThrowAsJavaScriptException();
        return;
    }
}

// ------------------------------------------------------------------
// Release texture resources
// ------------------------------------------------------------------
void SpoutInput::ReleaseTextures() {
    if (receiveTexture) {
        receiveTexture->Release();
        receiveTexture = nullptr;
    }
    if (stagingTexture) {
        stagingTexture->Release();
        stagingTexture = nullptr;
    }
    texWidth = 0;
    texHeight = 0;
}
