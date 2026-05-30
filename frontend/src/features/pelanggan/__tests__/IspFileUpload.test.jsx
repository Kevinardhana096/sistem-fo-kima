import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IspAdminFormPage from '../IspAdminFormPage';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../lib/api', () => ({
  default: {
    isps: { create: vi.fn(), update: vi.fn() },
    ispEntryPoints: { replaceForIsp: vi.fn().mockResolvedValue([]) },
  },
  getApiErrorDetails: vi.fn((err, fallback) => ({
    message: err?.message ?? fallback,
    fields: [],
    fieldMessages: {},
  })),
}));

vi.mock('../../../lib/files', () => ({
  uploadFileForRecord: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => null,
}));

vi.mock('leaflet', () => ({ default: { divIcon: vi.fn(() => ({})) } }));

vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const makeFile = (name, type = 'application/pdf') =>
  new File(['dummy content'], name, { type });

const defaultProps = {
  mode: 'create',
  onCancel: vi.fn(),
  onNavigate: vi.fn(),
  onSaved: vi.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IspAdminFormPage — Upload Berkas', () => {
  let mockCreate, mockUpload;

  beforeEach(async () => {
    vi.clearAllMocks();
    const api = (await import('../../../lib/api')).default;
    const files = await import('../../../lib/files');
    mockCreate = api.isps.create;
    mockUpload = files.uploadFileForRecord;
    mockCreate.mockResolvedValue({ id: 'isp-99', name: 'PT. Test' });
    mockUpload.mockResolvedValue('https://storage.example.com/file.pdf');
  });

  // 1. Upload BAK memanggil uploadFileForRecord dengan path yang benar
  it('memanggil uploadFileForRecord saat berkas BAK dipilih', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    const bakInput = document.querySelectorAll('input[type="file"]')[1]; // [0]=logo, [1]=BAK, [2]=kontrak
    const file = makeFile('bak-test.pdf');

    await userEvent.upload(bakInput, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        file,
        expect.arrayContaining(['isps'])
      );
    });
  });

  // 2. Upload Kontrak memanggil uploadFileForRecord
  it('memanggil uploadFileForRecord saat berkas Kontrak dipilih', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    const contractInput = document.querySelectorAll('input[type="file"]')[2];
    const file = makeFile('kontrak-isp.pdf');

    await userEvent.upload(contractInput, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        file,
        expect.arrayContaining(['isps'])
      );
    });
  });

  // 3. Nama file BAK tampil setelah upload
  it('menampilkan nama file BAK setelah upload berhasil', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    const bakInput = document.querySelectorAll('input[type="file"]')[1];
    await userEvent.upload(bakInput, makeFile('bak-nusantara.pdf'));

    await waitFor(() => {
      expect(screen.getByText('bak-nusantara.pdf')).toBeInTheDocument();
    });
  });

  // 4. Nama file Kontrak tampil setelah upload
  it('menampilkan nama file Kontrak setelah upload berhasil', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    const contractInput = document.querySelectorAll('input[type="file"]')[2];
    await userEvent.upload(contractInput, makeFile('kontrak-2026.pdf'));

    await waitFor(() => {
      expect(screen.getByText('kontrak-2026.pdf')).toBeInTheDocument();
    });
  });

  // 5. Tombol Hapus muncul setelah file dipilih, dan bisa dihapus
  it('menampilkan tombol Hapus dan membersihkan file saat diklik', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    const bakInput = document.querySelectorAll('input[type="file"]')[1];
    await userEvent.upload(bakInput, makeFile('bak-hapus.pdf'));

    await waitFor(() => screen.getByText('bak-hapus.pdf'));

    const hapusBtn = screen.getAllByRole('button', { name: /hapus/i })[0];
    await userEvent.click(hapusBtn);

    await waitFor(() => {
      expect(screen.queryByText('bak-hapus.pdf')).not.toBeInTheDocument();
    });
  });

  // 6. URL hasil upload dikirim ke api.isps.create saat submit
  it('mengirim URL berkas ke api.isps.create saat form disubmit', async () => {
    render(<IspAdminFormPage {...defaultProps} />);

    // Isi nama ISP
    await userEvent.type(
      screen.getByPlaceholderText(/pt\. internet cepat/i),
      'PT. Upload Test'
    );

    // Upload BAK
    const bakInput = document.querySelectorAll('input[type="file"]')[1];
    await userEvent.upload(bakInput, makeFile('bak.pdf'));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /tambah isp/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          bakFileDataUrl: 'https://storage.example.com/file.pdf',
          bakFileName: 'bak.pdf',
        })
      );
    });
  });

});
