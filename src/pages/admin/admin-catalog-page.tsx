import React, { useState, useEffect, useCallback } from 'react';
import {
  getCategories,
  saveCategory,
  getProducts,
  toggleProductAvailable,
} from '../../services/supabase/admin';
import type { CategoryRow, ProductRow } from '../../types/admin';
import {
  Layers,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const AdminCatalogPage: React.FC = () => {
  const [tab, setTab] = useState<'categories' | 'products'>('categories');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catService, setCatService] = useState('food');
  const [catSaving, setCatSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (tab === 'categories') {
        const cats = await getCategories();
        setCategories((cats.data || []) as unknown as CategoryRow[]);
      } else {
        const prods = await getProducts();
        setProducts((prods.data || []) as unknown as ProductRow[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query catalog');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCatSaving(true);
      await saveCategory({
        name: catName.trim(),
        description: catSlug.trim() || undefined,
        is_active: true,
      });
      setIsCategoryModalOpen(false);
      setCatName('');
      setCatSlug('');
      loadData();
    } catch (err: unknown) {
      alert(`Failed to save category: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setCatSaving(false);
    }
  };

  const handleToggleProduct = async (id: string, current: boolean) => {
    try {
      await toggleProductAvailable(id, !current);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_available: !current } : p))
      );
    } catch (err: unknown) {
      alert(`Toggle failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Catalog & Category Governance</h2>
            <p className="text-xs text-text-secondary">
              Taxonomies for Food, Grocery & Courier • Global category creation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'categories' && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary bg-light-surface hover:bg-slate-100 rounded-xl transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setTab('categories')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'categories'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Service Categories ({categories.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('products')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'products'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Product Availability Moderation
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
          <span>{error}</span>
        </div>
      )}

      {/* Content Table */}
      <div className="rounded-2xl bg-white border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'categories' ? (
            <table className="w-full text-left text-xs text-text-secondary">
              <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Sort Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-1" />
                      Loading categories...
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      No categories found. Click "New Category" to create one.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">{cat.name}</td>
                      <td className="px-4 py-3 font-mono text-text-muted">{cat.slug}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-light-surface text-text-secondary border border-border">
                          {cat.service_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cat.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface text-text-muted border border-border">
                            <XCircle className="w-3 h-3" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{cat.sort_order}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-text-secondary">
              <thead className="bg-light-surface/80 text-text-secondary font-semibold uppercase tracking-wider border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Base Price</th>
                  <th className="px-4 py-3">Vendor Owner</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary mx-auto mb-1" />
                      Loading merchant products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                      No merchant products found.
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-light-surface/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">{prod.name}</td>
                      <td className="px-4 py-3 font-mono text-text-primary font-semibold">
                        ₦{Number(prod.price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{prod.vendor_id}</td>
                      <td className="px-4 py-3">
                        {prod.is_available ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-primary border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            Suppressed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleProduct(prod.id, prod.is_available)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            prod.is_available
                              ? 'bg-rose-50 text-primary hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {prod.is_available ? 'Suppress' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Create New Platform Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Traditional Soups, Fresh Produce, Parcel"
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  URL Slug (Optional)
                </label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="Leave empty to auto-slugify"
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-primary font-mono shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Target Service Type
                </label>
                <select
                  value={catService}
                  onChange={(e) => setCatService(e.target.value)}
                  className="w-full p-2.5 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-hidden focus:border-primary shadow-xs capitalize"
                >
                  <option value="food">Food Delivery</option>
                  <option value="grocery">Grocery Delivery</option>
                  <option value="courier">Courier Dispatch</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors disabled:opacity-50 shadow-xs"
                >
                  {catSaving ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCatalogPage;
