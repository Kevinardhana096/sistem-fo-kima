import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IspDetailPage from '../IspDetailPage';

vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../../components/shared/DateInput', () => ({
  default: ({ value = '', onChange, onBlur, className = '', inputClass = '' }) => (
    <input
      className={`${className} ${inputClass}`}
      onBlur={onBlur}
      onChange={(event) => onChange?.(event.target.value)}
      type="date"
      value={value}
    />
  ),
}));

vi.mock('../components/FoRouteMultiPreview', () => ({
  default: () => <div data-testid="fo-route-preview" />,
}));

vi.mock('../components/IspEntryPointMap', () => ({
  default: () => <div data-testid="isp-entry-point-map" />,
}));

vi.mock('../../../lib/files', () => ({
  uploadFileForRecord: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  default: {
    isps: {
      getById: vi.fn(),
      update: vi.fn(),
    },
    ispContractRows: {
      create: vi.fn(),
      update: vi.fn(),
    },
    ispEntryPoints: {
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    ispRenewalFollowUps: {
      createForContractRow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const baseIsp = {
  id: 7,
  name: 'PT Test ISP',
  status: 'aktif',
};

const renderPage = (props = {}) => render(
  <IspDetailPage
    currentRole="admin"
    initialTab="contracts"
    isp={baseIsp}
    onBack={vi.fn()}
    {...props}
  />,
);

describe('IspDetailPage - tab kontrak', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: api } = await import('../../../lib/api');
    api.isps.getById.mockResolvedValue({
      ...baseIsp,
      contractRows: [],
      tenants: [],
      entryPoints: [],
    });
    api.ispContractRows.create.mockResolvedValue({ id: 99 });
  });

  it('menyimpan kontrak ISP baru dengan tanggal kontrak per baris', async () => {
    const { default: api } = await import('../../../lib/api');
    renderPage();

    const addButtons = await screen.findAllByRole('button', { name: /tambah kontrak/i });
    await userEvent.click(addButtons[0]);

    const contractNumberInputs = screen.getAllByPlaceholderText(/nomor kontrak/i);
    await userEvent.type(contractNumberInputs[contractNumberInputs.length - 1], 'KTR-ISP-001');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-10' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-02-01' } });
    fireEvent.change(dateInputs[2], { target: { value: '2027-01-31' } });

    fireEvent.click(screen.getByRole('button', { name: /^simpan$/i }));

    await waitFor(() => {
      expect(api.ispContractRows.create).toHaveBeenCalledWith(expect.objectContaining({
        ispId: 7,
        contractReference: 'KTR-ISP-001',
        contractStartDate: '2026-01-10',
        periodStart: '2026-02-01',
        periodEnd: '2027-01-31',
        status: 'aktif',
        renewalStatus: 'active',
      }));
    });
  });

  it('tidak menampilkan tombol tambah kontrak untuk role ISP', async () => {
    renderPage({ currentRole: 'isp' });

    await waitFor(() => expect(screen.queryByText(/memuat detail/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /tambah kontrak/i })).not.toBeInTheDocument();
  });
});
