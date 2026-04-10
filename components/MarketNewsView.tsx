import React, { useState, useEffect } from 'react';
import { marketApi } from '../services/api';

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
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    fetchNews({ limit: 30, search: searchInput.trim() || undefined });
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
          className="flex-1 px-4 py-2.5 border border-border-standard rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] outline-none"
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
        <div className="py-12 text-center text-text-muted text-sm">Đang tải tin tức...</div>
      ) : articles.length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm">
          {search ? 'Không có tin nào phù hợp.' : 'Chưa có tin tức.'}
        </div>
      ) : (
        <ul className="space-y-4">
          {articles.map((article, idx) => (
            <li key={idx}>
              <a
                href={cleanArticleUrl(article.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg border border-border-standard bg-panel hover:border-[#1E3A5F]/40 hover:bg-panel transition-colors"
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
