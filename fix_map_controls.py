import os

def process_file():
    filepath = 'frontend/src/features/pelanggan/components/FoRoutePlanner.jsx'
    with open(filepath, 'rb') as f:
        content_bytes = f.read()
    
    is_crlf = b'\r\n' in content_bytes
    content = content_bytes.decode('utf-8').replace('\r\n', '\n')

    top_end_str = '''                <div className="absolute inset-0 bg-black/10 transition-opacity hover:bg-transparent" />
              </button>
            ))}
          </div>
        </div>
      </div>'''

    new_top_end_str = '''                <div className="absolute inset-0 bg-black/10 transition-opacity hover:bg-transparent" />
              </button>
            ))}
          </div>
        </div>

        <button
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gold-accent/30 flex items-center justify-center transition text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] bg-slate-900/80 backdrop-blur-md pointer-events-auto shadow-xl"
          onClick={handleRecenterToKima}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">my_location</span>
        </button>
        
        <button 
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-white/70 hover:text-white hover:border-white/20 transition pointer-events-auto flex items-center justify-center shadow-xl" 
          onClick={handleExportGeoJson} 
          title="Export GeoJSON"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">download</span>
        </button>
      </div>'''

    bottom_str = '''      {/* Bottom Right Controls */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[800] flex flex-col items-end gap-2 pointer-events-none transition-opacity duration-500" style={{ opacity: isSidebarOpen && window.innerWidth < 640 ? 0 : 1 }}>
        <button
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gold-accent/30 flex items-center justify-center transition text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] bg-slate-900/80 backdrop-blur-md pointer-events-auto shadow-xl"
          onClick={handleRecenterToKima}
          title="Pusatkan ke KIMA"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">my_location</span>
        </button>
        
        <button 
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md text-white/70 hover:text-white hover:border-white/20 transition pointer-events-auto flex items-center justify-center shadow-xl" 
          onClick={handleExportGeoJson} 
          title="Export GeoJSON"
          type="button"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">download</span>
        </button>
      </div>'''

    content = content.replace(top_end_str, new_top_end_str)
    content = content.replace(bottom_str, '')

    if is_crlf:
        content = content.replace('\n', '\r\n')

    with open(filepath, 'wb') as f:
        f.write(content.encode('utf-8'))

process_file()
