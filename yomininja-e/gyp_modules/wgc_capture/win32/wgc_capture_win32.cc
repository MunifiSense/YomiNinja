// Windows.Graphics.Capture one-shot frame grab for YomiNinja OCR.
// Requires Windows 10 1803+ and a Windows SDK with C++/WinRT.

#include <napi.h>

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif

#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>

#include <winrt/base.h>

// Windows SDK 10.0.19041 cppwinrt headers reference impl::wait_for / wait_get,
// but that toolkit build does not define them. Provide stubs so Capture headers
// can compile; this addon never blocks on IAsyncAction.
namespace winrt::impl {
  template <typename Async>
  inline void wait_get(Async const&) {}

  template <typename Async, typename Timeout>
  inline int wait_for(Async const&, Timeout const&) {
    return 3; // AsyncStatus::Error
  }
}

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <winrt/Windows.Graphics.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <string>
#include <vector>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "windowsapp.lib")

namespace {

struct CaptureResult {
  int width = 0;
  int height = 0;
  std::vector<uint8_t> rgba;
  std::string error;
};

winrt::com_ptr<ID3D11Device> CreateD3DDevice() {
  winrt::com_ptr<ID3D11Device> device;
  const UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
  const HRESULT hr = D3D11CreateDevice(
    nullptr,
    D3D_DRIVER_TYPE_HARDWARE,
    nullptr,
    flags,
    nullptr,
    0,
    D3D11_SDK_VERSION,
    device.put(),
    nullptr,
    nullptr
  );
  winrt::check_hresult(hr);
  return device;
}

winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice CreateDirect3DDevice(
  winrt::com_ptr<ID3D11Device> const& d3dDevice
) {
  winrt::com_ptr<IDXGIDevice> dxgiDevice;
  winrt::check_hresult(d3dDevice->QueryInterface(dxgiDevice.put()));

  winrt::com_ptr<::IInspectable> inspectable;
  winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.get(), inspectable.put()));
  return inspectable.as<winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
}

winrt::com_ptr<ID3D11Texture2D> GetTextureFromSurface(
  winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DSurface const& surface
) {
  auto access = surface.as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
  winrt::com_ptr<ID3D11Texture2D> texture;
  winrt::check_hresult(access->GetInterface(winrt::guid_of<ID3D11Texture2D>(), texture.put_void()));
  return texture;
}

winrt::Windows::Graphics::Capture::GraphicsCaptureItem CreateItemForWindow( HWND hwnd ) {
  auto factory = winrt::get_activation_factory<winrt::Windows::Graphics::Capture::GraphicsCaptureItem>();
  auto interop = factory.as<IGraphicsCaptureItemInterop>();
  winrt::Windows::Graphics::Capture::GraphicsCaptureItem item{ nullptr };
  winrt::check_hresult(interop->CreateForWindow(
    hwnd,
    winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
    winrt::put_abi(item)
  ));
  return item;
}

winrt::Windows::Graphics::Capture::GraphicsCaptureItem CreateItemForMonitor( HMONITOR monitor ) {
  auto factory = winrt::get_activation_factory<winrt::Windows::Graphics::Capture::GraphicsCaptureItem>();
  auto interop = factory.as<IGraphicsCaptureItemInterop>();
  winrt::Windows::Graphics::Capture::GraphicsCaptureItem item{ nullptr };
  winrt::check_hresult(interop->CreateForMonitor(
    monitor,
    winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
    winrt::put_abi(item)
  ));
  return item;
}

struct MonitorSearch {
  RECT matchRect{};
  HMONITOR result = nullptr;
  int bestOverlap = -1;
};

BOOL CALLBACK MonitorEnumProc( HMONITOR monitor, HDC, LPRECT, LPARAM lParam ) {
  auto* search = reinterpret_cast<MonitorSearch*>(lParam);
  MONITORINFO mi{};
  mi.cbSize = sizeof(mi);
  if (!GetMonitorInfoW(monitor, &mi)) {
    return TRUE;
  }

  RECT inter{};
  if (!IntersectRect(&inter, &mi.rcMonitor, &search->matchRect)) {
    return TRUE;
  }

  const int overlap = (inter.right - inter.left) * (inter.bottom - inter.top);
  if (overlap > search->bestOverlap) {
    search->bestOverlap = overlap;
    search->result = monitor;
  }
  return TRUE;
}

HMONITOR FindMonitorForBounds( int x, int y, int width, int height ) {
  MonitorSearch search{};
  search.matchRect = { x, y, x + width, y + height };
  EnumDisplayMonitors(nullptr, nullptr, MonitorEnumProc, reinterpret_cast<LPARAM>(&search));
  return search.result;
}

// Electron's main thread already has a COM apartment. Ignore RPC_E_CHANGED_MODE /
// already-initialized failures so WGC can run on the existing apartment.
void EnsureWinRtApartment() {
  try {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
  } catch (winrt::hresult_error const& e) {
    const HRESULT hr = e.code();
    if (hr != RPC_E_CHANGED_MODE && hr != S_FALSE && hr != 0x80010106) {
      // 0x80010106 == RPC_E_CHANGED_MODE
      throw;
    }
  } catch (...) {
  }
}

CaptureResult CaptureItemToRgba( winrt::Windows::Graphics::Capture::GraphicsCaptureItem const& item ) {
  CaptureResult out;

  if (!item) {
    out.error = "GraphicsCaptureItem is null";
    return out;
  }

  auto d3dDevice = CreateD3DDevice();
  auto device = CreateDirect3DDevice(d3dDevice);
  winrt::com_ptr<ID3D11DeviceContext> context;
  d3dDevice->GetImmediateContext(context.put());

  const auto size = item.Size();
  if (size.Width <= 0 || size.Height <= 0) {
    out.error = "Capture item has empty size";
    return out;
  }

  auto framePool = winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool::CreateFreeThreaded(
    device,
    winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
    1,
    size
  );

  auto session = framePool.CreateCaptureSession(item);
  try {
    session.IsCursorCaptureEnabled(false);
  } catch (...) {
  }

  std::mutex mu;
  std::condition_variable cv;
  std::atomic<bool> gotFrame{ false };
  winrt::Windows::Graphics::Capture::Direct3D11CaptureFrame capturedFrame{ nullptr };

  auto token = framePool.FrameArrived(winrt::auto_revoke, [&](auto&, auto&) {
    auto frame = framePool.TryGetNextFrame();
    if (!frame) {
      return;
    }
    {
      std::lock_guard<std::mutex> lock(mu);
      if (!gotFrame.load()) {
        capturedFrame = frame;
        gotFrame.store(true);
      }
    }
    cv.notify_one();
  });

  session.StartCapture();

  {
    std::unique_lock<std::mutex> lock(mu);
    if (!cv.wait_for(lock, std::chrono::milliseconds(2000), [&] { return gotFrame.load(); })) {
      token.revoke();
      session.Close();
      framePool.Close();
      out.error = "Timed out waiting for WGC frame";
      return out;
    }
  }

  token.revoke();

  if (!capturedFrame) {
    session.Close();
    framePool.Close();
    out.error = "No capture frame";
    return out;
  }

  const auto contentSize = capturedFrame.ContentSize();
  auto surface = capturedFrame.Surface();
  auto texture = GetTextureFromSurface(surface);

  D3D11_TEXTURE2D_DESC desc{};
  texture->GetDesc(&desc);

  D3D11_TEXTURE2D_DESC stagingDesc = desc;
  stagingDesc.Usage = D3D11_USAGE_STAGING;
  stagingDesc.BindFlags = 0;
  stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  stagingDesc.MiscFlags = 0;

  winrt::com_ptr<ID3D11Texture2D> staging;
  winrt::check_hresult(d3dDevice->CreateTexture2D(&stagingDesc, nullptr, staging.put()));
  context->CopyResource(staging.get(), texture.get());

  D3D11_MAPPED_SUBRESOURCE mapped{};
  winrt::check_hresult(context->Map(staging.get(), 0, D3D11_MAP_READ, 0, &mapped));

  const int width = static_cast<int>(contentSize.Width > 0 ? contentSize.Width : desc.Width);
  const int height = static_cast<int>(contentSize.Height > 0 ? contentSize.Height : desc.Height);
  out.width = width;
  out.height = height;
  out.rgba.resize(static_cast<size_t>(width) * static_cast<size_t>(height) * 4);

  auto const* src = static_cast<const uint8_t*>(mapped.pData);
  for (int y = 0; y < height; ++y) {
    auto const* row = src + static_cast<size_t>(y) * mapped.RowPitch;
    for (int x = 0; x < width; ++x) {
      const size_t si = static_cast<size_t>(x) * 4;
      const size_t di = (static_cast<size_t>(y) * static_cast<size_t>(width) + static_cast<size_t>(x)) * 4;
      out.rgba[di + 0] = row[si + 2];
      out.rgba[di + 1] = row[si + 1];
      out.rgba[di + 2] = row[si + 0];
      out.rgba[di + 3] = row[si + 3];
    }
  }

  context->Unmap(staging.get(), 0);
  capturedFrame.Close();
  session.Close();
  framePool.Close();

  return out;
}

CaptureResult CaptureWindow( HWND hwnd ) {
  CaptureResult out;
  if (!hwnd || !IsWindow(hwnd)) {
    out.error = "Invalid HWND";
    return out;
  }
  if (IsIconic(hwnd)) {
    out.error = "Window is minimized";
    return out;
  }

  try {
    EnsureWinRtApartment();
    auto item = CreateItemForWindow(hwnd);
    return CaptureItemToRgba(item);
  } catch (winrt::hresult_error const& e) {
    out.error = "WGC window capture failed: " + winrt::to_string(e.message());
    return out;
  } catch (std::exception const& e) {
    out.error = std::string("WGC window capture failed: ") + e.what();
    return out;
  } catch (...) {
    out.error = "WGC window capture failed: unknown error";
    return out;
  }
}

CaptureResult CaptureMonitorBounds( int x, int y, int width, int height ) {
  CaptureResult out;
  HMONITOR monitor = FindMonitorForBounds(x, y, width, height);
  if (!monitor) {
    out.error = "No monitor matched bounds";
    return out;
  }

  try {
    EnsureWinRtApartment();
    auto item = CreateItemForMonitor(monitor);
    return CaptureItemToRgba(item);
  } catch (winrt::hresult_error const& e) {
    out.error = "WGC monitor capture failed: " + winrt::to_string(e.message());
    return out;
  } catch (std::exception const& e) {
    out.error = std::string("WGC monitor capture failed: ") + e.what();
    return out;
  } catch (...) {
    out.error = "WGC monitor capture failed: unknown error";
    return out;
  }
}

Napi::Object CaptureResultToJs( Napi::Env env, CaptureResult const& result ) {
  Napi::Object obj = Napi::Object::New(env);
  if (!result.error.empty()) {
    obj.Set("ok", false);
    obj.Set("error", result.error);
    return obj;
  }

  Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
    env,
    result.rgba.data(),
    result.rgba.size()
  );

  obj.Set("ok", true);
  obj.Set("width", result.width);
  obj.Set("height", result.height);
  obj.Set("data", buffer);
  return obj;
}

Napi::Value CaptureWindowJs( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "captureWindow(hwnd: number) expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int64_t hwndValue = info[0].As<Napi::Number>().Int64Value();
  HWND hwnd = reinterpret_cast<HWND>(static_cast<intptr_t>(hwndValue));
  return CaptureResultToJs(env, CaptureWindow(hwnd));
}

Napi::Value CaptureMonitorJs( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  if (info.Length() < 4 ||
      !info[0].IsNumber() || !info[1].IsNumber() ||
      !info[2].IsNumber() || !info[3].IsNumber()) {
    Napi::TypeError::New(env, "captureMonitor(x, y, width, height) expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int x = info[0].As<Napi::Number>().Int32Value();
  const int y = info[1].As<Napi::Number>().Int32Value();
  const int width = info[2].As<Napi::Number>().Int32Value();
  const int height = info[3].As<Napi::Number>().Int32Value();
  return CaptureResultToJs(env, CaptureMonitorBounds(x, y, width, height));
}

Napi::Value IsSupportedJs( const Napi::CallbackInfo& info ) {
  Napi::Env env = info.Env();
  bool supported = false;
  try {
    supported = winrt::Windows::Graphics::Capture::GraphicsCaptureSession::IsSupported();
  } catch (...) {
    supported = false;
  }
  return Napi::Boolean::New(env, supported);
}

} // namespace

Napi::Object Init( Napi::Env env, Napi::Object exports ) {
  exports.Set("captureWindow", Napi::Function::New(env, CaptureWindowJs));
  exports.Set("captureMonitor", Napi::Function::New(env, CaptureMonitorJs));
  exports.Set("isSupported", Napi::Function::New(env, IsSupportedJs));
  return exports;
}

NODE_API_MODULE(wgc_capture_win32, Init)

#else

Napi::Object Init( Napi::Env env, Napi::Object exports ) {
  return exports;
}

NODE_API_MODULE(wgc_capture_win32, Init)

#endif
