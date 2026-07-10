import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import NewWidgetMenu from './NewWidgetMenu';

// The NEW menu opens WhatsApp in a new tab on submit; capture that call.
function spyOnWindowOpen() {
  return vi.spyOn(window, 'open').mockImplementation(() => null);
}
let openSpy: ReturnType<typeof spyOnWindowOpen>;

beforeEach(() => {
  openSpy = spyOnWindowOpen();
});
afterEach(() => {
  openSpy.mockRestore();
});

function openArc() {
  // The pulsing NEW trigger sits in the nav; its aria-label opens the arc.
  fireEvent.click(screen.getByRole('button', { name: /open new services menu/i }));
}

describe('NewWidgetMenu', () => {
  it('renders a glowing NEW trigger and no overlay until opened', () => {
    render(<NewWidgetMenu role="client" />);
    expect(screen.getByRole('button', { name: /open new services menu/i })).toBeInTheDocument();
    // The "NEW" label lives ONLY inside the circular trigger — the old
    // duplicate caption below the button is gone.
    expect(screen.getAllByText('NEW')).toHaveLength(1);
    // Arc widgets are not mounted while closed.
    expect(screen.queryByRole('button', { name: 'Concrete Calculator' })).toBeNull();
  });

  it('shows the 4 USER widgets in the arc for the client role', () => {
    render(<NewWidgetMenu role="client" />);
    openArc();
    for (const title of ['Next Version', 'Concrete Calculator', 'Hire Staff / Labour', 'Be a Partner']) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
    // None of the staff-only widgets leak into the client set.
    expect(screen.queryByRole('button', { name: 'Find Supplier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hire Me !!' })).toBeNull();
  });

  it.each(['plant_owner', 'admin', 'supervisor', 'quality', 'operator'])(
    'shows the 5 STAFF widgets in the arc for the %s role',
    (role) => {
      render(<NewWidgetMenu role={role} />);
      openArc();
      for (const title of ['Find Supplier', '3rd Eye System', 'Plant Accessories', 'Need Help In', 'Hire Me !!']) {
        expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
      }
      // The USER-only widgets never appear for staff.
      expect(screen.queryByRole('button', { name: 'Concrete Calculator' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Be a Partner' })).toBeNull();
    },
  );

  it('shows the driver "Need Help" widget set in the arc for the driver role', () => {
    render(<NewWidgetMenu role="driver" />);
    openArc();
    for (const title of ['Mechanic', 'Petrol Pump', 'Towing Van', 'Expenses']) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
    // Neither the client nor staff sets leak into the driver arc.
    expect(screen.queryByRole('button', { name: 'Concrete Calculator' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Find Supplier' })).toBeNull();
  });

  it('routes the driver Expenses widget straight to /expenses without a sheet', () => {
    render(<NewWidgetMenu role="driver" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Expenses' }));
    // A 'nav' widget navigates instead of opening a bottom-sheet dialog.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.pathname).toBe('/expenses');
  });

  it('builds a formatted wa.me enquiry for a driver Mechanic request', () => {
    render(<NewWidgetMenu role="driver" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Mechanic' }));
    const dialog = screen.getByRole('dialog', { name: 'Mechanic' });

    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Tyre / Puncture' } });
    fireEvent.change(within(dialog).getByPlaceholderText('10-digit mobile'), { target: { value: '9876543210' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Where are you now?'), { target: { value: 'NH48 near Vashi' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /send enquiry on whatsapp/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/wa\.me\/917498286760\?text=/);
    const msg = decodeURIComponent(url.split('?text=')[1]);
    expect(msg).toContain('Widget Name: Mechanic');
    expect(msg).toContain('Selected Option: Tyre / Puncture');
    expect(msg).toContain('Mobile: 9876543210');
    expect(msg).toContain('Address / Location: NH48 near Vashi');
  });

  it('toggles the arc closed via the X echo affordance', () => {
    render(<NewWidgetMenu role="client" />);
    openArc();
    expect(screen.getByRole('button', { name: 'Concrete Calculator' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.queryByRole('button', { name: 'Concrete Calculator' })).toBeNull();
  });

  it('opens a bottom-sheet form when a widget is picked', () => {
    render(<NewWidgetMenu role="client" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Hire Staff / Labour' }));
    const dialog = screen.getByRole('dialog', { name: 'Hire Staff / Labour' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Your Name')).toBeInTheDocument();
  });

  it('blocks submit and shows validation until required fields are valid', () => {
    render(<NewWidgetMenu role="client" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Hire Staff / Labour' }));
    const dialog = screen.getByRole('dialog', { name: 'Hire Staff / Labour' });

    // Empty submit -> banner + no WhatsApp open.
    fireEvent.click(within(dialog).getByRole('button', { name: /send enquiry on whatsapp/i }));
    expect(within(dialog).getByText(/fill the highlighted fields/i)).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    // A too-short mobile is rejected with a friendly inline error.
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Hire RCC Contractor' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Full name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(within(dialog).getByPlaceholderText('10-digit mobile'), { target: { value: '12345' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /send enquiry on whatsapp/i }));
    expect(within(dialog).getByText(/valid 10-digit mobile/i)).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('builds a formatted wa.me enquiry to the fixed number on valid submit', () => {
    render(<NewWidgetMenu role="client" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Hire Staff / Labour' }));
    const dialog = screen.getByRole('dialog', { name: 'Hire Staff / Labour' });

    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Hire RCC Contractor' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Full name'), { target: { value: 'Asha Rao' } });
    fireEvent.change(within(dialog).getByPlaceholderText('10-digit mobile'), { target: { value: '9876543210' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /send enquiry on whatsapp/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/wa\.me\/917498286760\?text=/);
    const msg = decodeURIComponent(url.split('?text=')[1]);
    expect(msg).toContain('TrackMyRMC Enquiry');
    expect(msg).toContain('Widget Name: Hire Staff / Labour');
    expect(msg).toContain('Selected Option: Hire RCC Contractor');
    expect(msg).toContain('Name / Company: Asha Rao');
    expect(msg).toContain('Mobile: 9876543210');
  });

  it('reveals the driving-license upload only for the Transit Mixer Driver role in Hire Me', () => {
    render(<NewWidgetMenu role="admin" />);
    openArc();
    fireEvent.click(screen.getByRole('button', { name: 'Hire Me !!' }));
    const dialog = screen.getByRole('dialog', { name: 'Hire Me !!' });

    expect(within(dialog).queryByText('Upload Driving License')).toBeNull();
    // The Hire Me form has two selects (Job Role + Joining); pick the Job Role
    // one by the option it uniquely offers.
    const jobRole = within(dialog).getAllByRole('combobox').find(
      (el) => within(el).queryByRole('option', { name: 'Transit Mixer Driver' }) !== null,
    )!;
    fireEvent.change(jobRole, { target: { value: 'Transit Mixer Driver' } });
    expect(within(dialog).getByText('Upload Driving License')).toBeInTheDocument();
  });
});
