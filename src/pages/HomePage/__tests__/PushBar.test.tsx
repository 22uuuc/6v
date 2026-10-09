// PushBar 动漫风推送栏单元测试：覆盖公告/书籍组合、4 秒轮播、空数据不渲染、点击跳转等核心行为。
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { IBook } from '@/lib/types';
import { PushBar } from '@/pages/HomePage/HomePage';

/** 构造最小可用的 IBook mock，只填充 PushBar 用到的字段。 */
function makeBook(over: Partial<IBook> = {}): IBook {
  return {
    id: 'b1',
    type: 'novel',
    title: '测试书名',
    authorId: 'a1',
    authorName: '作者',
    genre: '玄幻',
    status: 'published',
    coverSeed: 's1',
    description: '',
    tags: [],
    serial: 'serial',
    words: 0,
    views: 1234,
    likes: 0,
    rating: 0,
    createdAt: '',
    chapterPrice: 0,
    chapterIds: [],
    ...over,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PushBar — 动漫风推送栏', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('公告与书籍均为空时不渲染', () => {
    const { container } = renderWithRouter(<PushBar announcement="" books={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('仅公告时显示公告文本，且不启动轮播（单条）', () => {
    renderWithRouter(<PushBar announcement="系统维护通知" books={[]} />);
    expect(screen.getByText('系统维护通知')).toBeInTheDocument();
    expect(screen.getByText('推送')).toBeInTheDocument();
    // 推进 10 秒，仍只显示公告（单条不轮播）
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('系统维护通知')).toBeInTheDocument();
  });

  it('仅书籍（无公告）时显示第一本书', () => {
    const books = [makeBook({ id: 'b1', title: '剑来' }), makeBook({ id: 'b2', title: '雪中' })];
    renderWithRouter(<PushBar announcement="" books={books} />);
    expect(screen.getByText('剑来')).toBeInTheDocument();
    expect(screen.queryByText('雪中')).not.toBeInTheDocument();
  });

  it('公告 + 多本书：初始显示公告，4 秒后切换到第一本书', () => {
    const books = [
      makeBook({ id: 'b1', title: '剑来', views: 8888 }),
      makeBook({ id: 'b2', title: '雪中', views: 6666 }),
    ];
    renderWithRouter(<PushBar announcement="新书上架" books={books} />);
    // 初始：公告
    expect(screen.getByText('新书上架')).toBeInTheDocument();
    expect(screen.queryByText('剑来')).not.toBeInTheDocument();
    // 4 秒后：切换到第一本书
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('新书上架')).not.toBeInTheDocument();
    expect(screen.getByText('剑来')).toBeInTheDocument();
  });

  it('4 秒轮播依次遍历所有项并循环', () => {
    const books = [
      makeBook({ id: 'b1', title: '第一本' }),
      makeBook({ id: 'b2', title: '第二本' }),
    ];
    renderWithRouter(<PushBar announcement="公告" books={books} />);
    // 0s: 公告
    expect(screen.getByText('公告')).toBeInTheDocument();
    // 4s: 第一本
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('第一本')).toBeInTheDocument();
    // 8s: 第二本
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('第二本')).toBeInTheDocument();
    // 12s: 回到公告（循环）
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('公告')).toBeInTheDocument();
  });

  it('书籍项渲染类型标签和在追人数', () => {
    const books = [makeBook({ id: 'b1', title: '热门书', type: 'comic', views: 12345 })];
    renderWithRouter(<PushBar announcement="" books={books} />);
    expect(screen.getByText('漫画')).toBeInTheDocument();
    // 12345 的中文千分位格式
    expect(screen.getByText(/12,345 在追/)).toBeInTheDocument();
  });

  it('书籍项为 Link，href 指向 /book/{id}', () => {
    const books = [makeBook({ id: 'b-xyz', title: '链接书' })];
    renderWithRouter(<PushBar announcement="" books={books} />);
    const link = screen.getByRole('link', { name: /链接书/ });
    expect(link).toHaveAttribute('href', '/book/b-xyz');
  });

  it('渲染推送标签与喇叭图标（Megaphone）', () => {
    renderWithRouter(<PushBar announcement="x" books={[]} />);
    // 「推送」徽章
    expect(screen.getByText('推送')).toBeInTheDocument();
    // Megaphone 图标（lucide 渲染为 svg）
    expect(document.querySelector('svg.lucide-megaphone, svg[class*="megaphone"]')).not.toBeNull();
  });

  it('动画类名 anim-fade-up 应用于轮播项容器', () => {
    renderWithRouter(<PushBar announcement="x" books={[]} />);
    const fadeEl = document.querySelector('.anim-fade-up');
    expect(fadeEl).not.toBeNull();
  });
});
