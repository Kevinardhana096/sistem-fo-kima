import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    window.localStorage.clear();
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

  it('menyamakan angka tindak lanjut daftar lokasi dengan ringkasan butuh perhatian detail lokasi', async () => {
    const { default: api } = await import('../../../lib/api');
    api.isps.getById.mockResolvedValue({
      ...baseIsp,
      contractRows: [],
      entryPoints: [],
      tenants: [
        {
          id: 101,
          name: 'Lokasi Prioritas',
          customerId: 'CUST-101',
          status: 'aktif',
          contracts: [
            {
              id: 501,
              contractNumber: '',
              startDate: '2026-01-01',
              endDate: '2027-01-01',
              versions: [],
            },
          ],
          latestDocuments: [],
          invoices: [],
          todoSummary: {
            priority: [{ id: 'priority-1', code: 'route_attention' }],
            needAction: [{ id: 'need-action-1', code: 'custom_attention' }],
            counts: { priority: 1, needAction: 1 },
          },
          activationFeePaidAt: null,
        },
      ],
    });

    renderPage({ initialTab: 'customers' });

    const locationCell = await screen.findByText('Lokasi Prioritas');
    const locationRow = locationCell.closest('tr');

    expect(locationRow).not.toBeNull();
    expect(within(locationRow).getByText('6')).toBeInTheDocument();
  });

  it('memakai penanda kosong yang sama dengan detail lokasi saat menghitung tindak lanjut', async () => {
    const { default: api } = await import('../../../lib/api');
    window.localStorage.setItem(
      'tenant-contract-empty-state-101',
      JSON.stringify({
        contractNumberRows: { 'contract-501': true },
        bakRows: { 'contract-501': true },
      }),
    );
    api.isps.getById.mockResolvedValue({
      ...baseIsp,
      contractRows: [],
      entryPoints: [],
      tenants: [
        {
          id: 101,
          name: 'Lokasi Dengan Penanda Kosong',
          customerId: 'CUST-101',
          status: 'aktif',
          contracts: [
            {
              id: 501,
              contractNumber: '',
              startDate: '2026-01-01',
              endDate: '2027-01-01',
              versions: [],
            },
          ],
          latestDocuments: [],
          invoices: [],
          todoSummary: {
            priority: [{ id: 'priority-1', code: 'route_attention' }],
            needAction: [{ id: 'need-action-1', code: 'custom_attention' }],
            counts: { priority: 1, needAction: 1 },
          },
          activationFeePaidAt: null,
        },
      ],
    });

    renderPage({ initialTab: 'customers' });

    const locationCell = await screen.findByText('Lokasi Dengan Penanda Kosong');
    const locationRow = locationCell.closest('tr');

    expect(locationRow).not.toBeNull();
    expect(within(locationRow).getByText('4')).toBeInTheDocument();
  });
});
