import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  Skeleton,
  MessageSkeleton,
  ThreadSkeleton,
  SessionSkeleton,
  SessionsListSkeleton,
  FileTreeSkeleton,
  CardSkeleton,
  CodeBlockSkeleton,
} from './Skeleton';

describe('Skeleton', () => {
  it('should render with aria-hidden', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should apply text variant by default', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('4px');
  });

  it('should apply circular variant', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('50%');
  });

  it('should apply rectangular variant', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('0');
  });

  it('should apply rounded variant', () => {
    const { container } = render(<Skeleton variant="rounded" />);
    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('8px');
  });

  it('should apply custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={40} />);
    const skeleton = container.querySelector('.skeleton') as HTMLElement;
    expect(skeleton.style.width).toBe('200px');
    expect(skeleton.style.height).toBe('40px');
  });

  it('should apply wave animation class by default', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton-wave');
    expect(skeleton).toBeTruthy();
  });

  it('should apply pulse animation class', () => {
    const { container } = render(<Skeleton animation="pulse" />);
    const skeleton = container.querySelector('.skeleton-pulse');
    expect(skeleton).toBeTruthy();
  });

  it('should apply none animation class', () => {
    const { container } = render(<Skeleton animation="none" />);
    const skeleton = container.querySelector('.skeleton-none');
    expect(skeleton).toBeTruthy();
  });
});

describe('MessageSkeleton', () => {
  it('should render assistant variant by default', () => {
    const { container } = render(<MessageSkeleton />);
    expect(container.querySelector('.assistant')).toBeTruthy();
  });

  it('should render user variant', () => {
    const { container } = render(<MessageSkeleton isUser />);
    expect(container.querySelector('.user')).toBeTruthy();
  });

  it('should be hidden from screen readers', () => {
    const { container } = render(<MessageSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should show avatar for assistant messages', () => {
    const { container } = render(<MessageSkeleton isUser={false} />);
    expect(container.querySelector('.avatar')).toBeTruthy();
  });

  it('should NOT show avatar for user messages', () => {
    const { container } = render(<MessageSkeleton isUser />);
    expect(container.querySelector('.avatar')).toBeNull();
  });
});

describe('ThreadSkeleton', () => {
  it('should render correct number of message skeletons', () => {
    const { container } = render(<ThreadSkeleton messageCount={5} />);
    const messages = container.querySelectorAll('.message-skeleton');
    expect(messages.length).toBe(5);
  });

  it('should default to 3 messages', () => {
    const { container } = render(<ThreadSkeleton />);
    const messages = container.querySelectorAll('.message-skeleton');
    expect(messages.length).toBe(3);
  });

  it('should have loading role and label', () => {
    render(<ThreadSkeleton />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-label')).toBe('Loading conversation');
  });

  it('should include screen reader text', () => {
    render(<ThreadSkeleton />);
    expect(screen.getByText('Loading messages...')).toBeTruthy();
  });

  it('should alternate user and assistant messages', () => {
    const { container } = render(<ThreadSkeleton messageCount={4} />);
    const messages = container.querySelectorAll('.message-skeleton');
    expect(messages[0].classList.contains('assistant')).toBe(true);
    expect(messages[1].classList.contains('user')).toBe(true);
    expect(messages[2].classList.contains('assistant')).toBe(true);
    expect(messages[3].classList.contains('user')).toBe(true);
  });
});

describe('SessionSkeleton', () => {
  it('should render and be hidden from screen readers', () => {
    const { container } = render(<SessionSkeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SessionsListSkeleton', () => {
  it('should render default count of 5 items', () => {
    const { container } = render(<SessionsListSkeleton />);
    const items = container.querySelectorAll('.session-skeleton');
    expect(items.length).toBe(5);
  });

  it('should render custom count', () => {
    const { container } = render(<SessionsListSkeleton count={3} />);
    const items = container.querySelectorAll('.session-skeleton');
    expect(items.length).toBe(3);
  });

  it('should have loading role', () => {
    render(<SessionsListSkeleton />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('FileTreeSkeleton', () => {
  it('should render default 6 items', () => {
    const { container } = render(<FileTreeSkeleton />);
    const items = container.querySelectorAll('.file-item');
    expect(items.length).toBe(6);
  });

  it('should have loading role', () => {
    render(<FileTreeSkeleton />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});

describe('CardSkeleton', () => {
  it('should render without image by default', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.image')).toBeNull();
  });

  it('should render with image when showImage=true', () => {
    const { container } = render(<CardSkeleton showImage />);
    expect(container.querySelector('.image')).toBeTruthy();
  });

  it('should render correct number of text lines', () => {
    const { container } = render(<CardSkeleton lines={5} />);
    const skeletons = container.querySelectorAll('.content .skeleton');
    // 1 title + 5 lines = 6 total
    expect(skeletons.length).toBe(6);
  });
});

describe('CodeBlockSkeleton', () => {
  it('should render header and lines', () => {
    const { container } = render(<CodeBlockSkeleton />);
    expect(container.querySelector('.header')).toBeTruthy();
    expect(container.querySelector('.lines')).toBeTruthy();
  });

  it('should render correct number of code lines', () => {
    const { container } = render(<CodeBlockSkeleton lines={5} />);
    const lines = container.querySelectorAll('.line');
    expect(lines.length).toBe(5);
  });

  it('should default to 8 lines', () => {
    const { container } = render(<CodeBlockSkeleton />);
    const lines = container.querySelectorAll('.line');
    expect(lines.length).toBe(8);
  });
});
