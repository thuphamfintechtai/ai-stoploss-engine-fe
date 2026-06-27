import React, { useState, useEffect } from 'react';
import { marketApi } from '../services/api';
import { SkeletonCard } from './ui/SkeletonLoader';
import { EmptyState, EmptyStateIcon } from './ui/EmptyState';
import { useDebounce } from '../hooks/useDebounce';

interface Article {
  title: string;
  url: string;
  date: string;
  description?: string;
}

function cleanArticleUrl(url: string): string {
  if (!url || typeof url !== 'string') return '#';
  const s = url.trim();
  const idx = s.search(/\s|"/);
  return idx < 0 ? s : s.slice(0, idx).trim();
}

export const MarketNewsView: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // D-03: debounce 200ms — auto-fetch after user stops typing
  const debouncedSearch = useDebounce(searchInput, 200);

  const fetchNews = (params?: { limit?: number; search?: string }) => {
    setLoading(true);
    setError(null);
    marketApi
      .getNews({ limit: params?.limit ?? 30, search: params?.search, format: 'json' })
      .then((res) => {
        const data = res.data as any;
        if (data?.success && Array.isArray(data?.articles)) {
          setArticles(data.articles);
        } else {
          setArticles([]);
        }
      })
      .catch((e) => {
        setError(e?.message ?? 'Không tải được tin tức');
        setArticles([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNews({ limit: 30 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fetch when debounced search term changes (D-03)
  useEffect(() => {
    const term = debouncedSearch.trim();
    setSearch(term);
    fetchNews({ limit: 30, search: term || undefined });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchInput.trim();
    setSearch(term);
    fetchNews({ limit: 30, search: term || undefined });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="border-b border-border-standard pb-4">
        <h1 className="text-xl font-semibold text-text-main tracking-tight">Tin tức thị trường</h1>
        <p className="text-text-muted text-sm mt-0.5">Nguồn: CafeF (cafef.vn)</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm tin (VD: VN30, ngân hàng...)"
          className="flex-1 px-4 py-2.5 border border-border-standard rounded-lg text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          Tìm kiếm
        </button>
      </form>

      {error && (
        <div className="py-3 px-4 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        search ? (
          <EmptyState
            variant="compact"
            icon={EmptyStateIcon.search}
            title="Không có tin phù hợp"
            description="Thử thay đổi từ khoá tìm kiếm."
          />
        ) : (
          <EmptyState
            variant="compact"
            icon={EmptyStateIcon.default}
            title="Chưa có tin tức"
          />
        )
      ) : (
        <ul className="space-y-4">
          {articles.map((article, idx) => (
            <li key={idx}>
              <a
                href={cleanArticleUrl(article.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border border-border-standard bg-panel hover:border-accent/40 hover:bg-panel transition-colors"
              >
                <p className="text-sm font-medium text-text-main leading-snug">{article.title}</p>
                {article.description && (
                  <p className="text-xs text-text-muted mt-1.5 line-clamp-2">{article.description}</p>
                )}
                <p className="text-[10px] text-text-muted mt-2">{article.date}</p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
