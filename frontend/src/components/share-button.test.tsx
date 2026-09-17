import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ShareButton } from './share-button';

const title = '企画名';
const url = 'https://aramakisai.com/exhibitions/1';

describe('ShareButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the native share sheet when navigator.share is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });

    render(<ShareButton title={title} url={url} />);
    fireEvent.click(screen.getByRole('button', { name: '共有' }));

    await waitFor(() => expect(share).toHaveBeenCalledWith({ title, url }));
    expect(screen.queryByText(/コピー/)).not.toBeInTheDocument();
  });

  it('falls back to clipboard copy and notifies success when share is unsupported', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });

    render(<ShareButton title={title} url={url} />);
    fireEvent.click(screen.getByRole('button', { name: '共有' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
    expect(await screen.findByText('URLをコピーしました')).toBeInTheDocument();
  });

  it('shows no error when the user cancels the native share sheet', async () => {
    const abortError = Object.assign(new Error('cancelled'), {
      name: 'AbortError',
    });
    const share = vi.fn().mockRejectedValue(abortError);
    const writeText = vi.fn();
    vi.stubGlobal('navigator', {
      ...navigator,
      share,
      canShare: () => true,
      clipboard: { writeText },
    });

    render(<ShareButton title={title} url={url} />);
    fireEvent.click(screen.getByRole('button', { name: '共有' }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText(/失敗/)).not.toBeInTheDocument();
    expect(screen.queryByText(/コピー/)).not.toBeInTheDocument();
  });

  it('shows a manual-copy fallback when clipboard copy fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });

    render(<ShareButton title={title} url={url} />);
    fireEvent.click(screen.getByRole('button', { name: '共有' }));

    expect(await screen.findByText(/コピーに失敗しました/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(url)).toBeInTheDocument();
  });
});
