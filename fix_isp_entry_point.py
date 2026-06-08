import re
import sys

def process_file():
    with open('frontend/src/features/pelanggan/components/IspEntryPointMap.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Remove original close button
    content = re.sub(
        r'<button\s*className="absolute right-4 top-4 z-\[1200\].*?type="button"\s*>\s*<span className="material-symbols-outlined text-lg">close</span>\s*</button>',
        '',
        content,
        flags=re.DOTALL
    )

    # Step 2: Pass onRequestClose to EntryPointMapSurface
    content = content.replace(
        'onMovePoint={onMovePoint}',
        'onMovePoint={onMovePoint}\n      onRequestClose={() => setIsFullscreen(false)}'
    )

    # Step 3: Add onRequestClose to the destructuring
    content = content.replace(
        '  onMovePoint,\n  onRequestFullscreen,',
        '  onMovePoint,\n  onRequestClose,\n  onRequestFullscreen,'
    )

    # Step 4: Remove leaflet ZoomControl
    content = content.replace('<ZoomControl position="topright" />', '')

    # Step 5: Replace the controls column
    old_controls = r'<div className="absolute bottom-5 right-2 z-\[1000\] flex flex-col gap-2">.*?</div>'
    new_controls = '''<div className={`absolute z-[1000] flex flex-col gap-2 ${fullscreen ? "top-4 right-4" : "top-2 right-2"}`}>
        {fullscreen ? (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            onClick={onRequestClose}
            title="Tutup layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        ) : (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            onClick={onRequestFullscreen}
            title="Layar penuh"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_full</span>
          </button>
        )}

        <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md shadow-lg overflow-hidden w-9">
          <button
            className="w-full h-9 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom In"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <div className="h-px bg-white/10 w-full" />
          <button
            className="w-full h-9 text-white/70 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom Out"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-accent/30 bg-slate-900/80 text-gold-accent shadow-lg backdrop-blur-md transition hover:bg-gold-accent hover:text-[#0f141e]"
          onClick={() => mapRef.current?.flyTo(KIMA_CENTER, DEFAULT_ZOOM, { duration: 0.8 })}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">my_location</span>
        </button>
      </div>'''

    content = re.sub(old_controls, new_controls, content, flags=re.DOTALL)

    with open('frontend/src/features/pelanggan/components/IspEntryPointMap.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

process_file()
