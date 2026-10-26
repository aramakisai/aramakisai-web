export type CapabilityKey =
  | 'cap_storage'
  | 'cap_share'
  | 'cap_clipboard'
  | 'cap_geolocation'
  | 'cap_dialog'
  | 'cap_standalone'
  | 'cap_reduced_motion'
  | 'cap_pc_input';

export type CapabilityFlags = Readonly<Record<CapabilityKey, '1' | '0'>>;

// globals.css の @custom-variant pc-input と同一でなければならない (テストで照合)
export const PC_INPUT_QUERY =
  '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

const flag = (v: boolean): '1' | '0' => (v ? '1' : '0');

// Safari のプライベートモード等は参照ではなく書き込みで例外になる
function canWriteStorage(): boolean {
  try {
    const k = '__cap_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function media(q: string): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(q).matches;
  } catch {
    return false;
  }
}

export function detectCapabilities(): CapabilityFlags {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    cap_storage: flag(canWriteStorage()),
    cap_share: flag('share' in nav),
    cap_clipboard: flag(typeof nav.clipboard?.writeText === 'function'),
    cap_geolocation: flag('geolocation' in nav),
    cap_dialog: flag(
      typeof HTMLDialogElement !== 'undefined' &&
        typeof HTMLDialogElement.prototype.showModal === 'function',
    ),
    cap_standalone: flag(
      media('(display-mode: standalone)') || nav.standalone === true,
    ),
    cap_reduced_motion: flag(media('(prefers-reduced-motion: reduce)')),
    cap_pc_input: flag(media(PC_INPUT_QUERY)),
  };
}
