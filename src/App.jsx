import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, LayoutDashboard, Table as TableIcon, TrendingUp, DollarSign, 
  ShoppingCart, Percent, Trash2, Package, Upload, ChevronDown, Search, 
  Sparkles, Loader2, BarChart3, FileSpreadsheet, Pencil, Check, X, 
  Files, AlertTriangle, Merge, Link as LinkIcon, ArrowUpDown, ArrowUp, ArrowDown, Store
} from 'lucide-react';

const CHANNELS = ["Etsy", "In-Person Markets", "Rich Consignment", "6x8 Market", "Website", "Other"];

// API Configuration - Uses Vercel Environment Variables
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ""; 
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);

const getKeywords = (str) => {
  if (!str) return [];
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ')
    .filter(w => w.length > 2 && !['with', 'the', 'and', 'for', 'gift', 'stuff', 'kawaii', 'anime'].includes(w));
};

const areSimilar = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const kwA = getKeywords(nameA);
  const kwB = getKeywords(nameB);
  if (kwA.length === 0 || kwB.length === 0) return false;
  const [shorter, longer] = kwA.length < kwB.length ? [kwA, kwB] : [kwB, kwA];
  const matches = shorter.filter(w => longer.includes(w));
  return (matches.length / shorter.length) >= 0.6;
};

const App = () => {
  const [view, setView] = useState('dashboard');
  const [sales, setSales] = useState(() => JSON.parse(localStorage.getItem('sales_data') || '[]'));
  const [products, setProducts] = useState(() => JSON.parse(localStorage.getItem('product_catalog') || '[{"id":"1","name":"Sample Product","defaultCog":5,"defaultPrice":25}]'));
  
  const [salesSort, setSalesSort] = useState({ key: 'date', direction: 'desc' });
  const [productSort, setProductSort] = useState({ key: 'name', direction: 'asc' });
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showBatchCogModal, setShowBatchCogModal] = useState(false);
  const [batchCogValue, setBatchCogValue] = useState('');
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [mergingGroup, setMergingGroup] = useState(null);
  const [filterChannel, setFilterChannel] = useState('All');
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState('magic');
  const [importText, setImportText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], itemName: '', productId: '', channel: 'Etsy', soldPrice: '', shippingFee: '', marketingTax: '', packaging: '', cog: '' });

  useEffect(() => { localStorage.setItem('sales_data', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('product_catalog', JSON.stringify(products)); }, [products]);

  const getSaleEffectiveData = (sale) => {
    const product = products.find(p => p.id === sale.productId);
    const effectiveCog = product ? product.defaultCog : (parseFloat(sale.cog) || 0);
    const sold = parseFloat(sale.soldPrice) || 0;
    const expenses = (parseFloat(sale.shippingFee) || 0) + (parseFloat(sale.marketingTax) || 0) + (parseFloat(sale.packaging) || 0) + effectiveCog;
    const profit = sold - expenses;
    return { effectiveCog, profit, margin: sold > 0 ? (profit / sold) * 100 : 0, productName: product?.name || 'Unlinked' };
  };

  const filteredSales = useMemo(() => {
    let result = sales.map(s => ({ ...s, ...getSaleEffectiveData(s) })).filter(sale => {
      const matchesChannel = filterChannel === 'All' || sale.channel === filterChannel;
      const matchesSearch = (sale.itemName || '').toLowerCase().includes(salesSearchTerm.toLowerCase()) || (sale.productName || '').toLowerCase().includes(salesSearchTerm.toLowerCase());
      return matchesChannel && matchesSearch;
    });
    return result.sort((a, b) => {
      let valA = a[salesSort.key], valB = b[salesSort.key];
      if (valA < valB) return salesSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return salesSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sales, filterChannel, salesSearchTerm, products, salesSort]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => (p.name || '').toLowerCase().includes(productSearchTerm.toLowerCase()));
    return result.sort((a, b) => {
      let valA = a[productSort.key], valB = b[productSort.key];
      if (productSort.key === 'revenue') {
        valA = sales.filter(s => s.productId === a.id).reduce((acc, s) => acc + (parseFloat(s.soldPrice) || 0), 0);
        valB = sales.filter(s => s.productId === b.id).reduce((acc, s) => acc + (parseFloat(s.soldPrice) || 0), 0);
      }
      if (valA < valB) return productSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return productSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, productSearchTerm, productSort, sales]);

  const stats = useMemo(() => {
    const enhancedSales = sales.map(s => getSaleEffectiveData(s));
    const totalRevenue = sales.reduce((acc, s) => acc + (parseFloat(s.soldPrice) || 0), 0);
    const totalProfit = enhancedSales.reduce((acc, s) => acc + s.profit, 0);
    const totalCOGs = enhancedSales.reduce((acc, s) => acc + s.effectiveCog, 0);
    const channelData = CHANNELS.map(channel => {
      const raw = sales.filter(s => s.channel === channel);
      return { name: channel, revenue: raw.reduce((acc, s) => acc + (parseFloat(s.soldPrice) || 0), 0), profit: raw.reduce((acc, s) => acc + getSaleEffectiveData(s).profit, 0), count: raw.length };
    }).filter(c => c.count > 0);
    return { totalRevenue, totalProfit, totalCOGs, avgMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0, channelData };
  }, [sales, products]);

  // --- ACTIONS ---
  function handleInputChange(e) {
    const { name, value } = e.target;
    if (name === 'productId') {
      const p = products.find(p => p.id === value);
      if (p) { setFormData(prev => ({ ...prev, productId: value, itemName: prev.itemName || p.name, cog: p.defaultCog.toString(), soldPrice: (prev.soldPrice || p.defaultPrice.toString()) })); return; }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  const saveSale = (e) => {
    e.preventDefault();
    const data = { ...formData, soldPrice: parseFloat(formData.soldPrice) || 0, shippingFee: parseFloat(formData.shippingFee) || 0, marketingTax: parseFloat(formData.marketingTax) || 0, packaging: parseFloat(formData.packaging) || 0, cog: parseFloat(formData.cog) || 0 };
    if (editingSaleId) setSales(prev => prev.map(s => s.id === editingSaleId ? { ...data, id: s.id } : s));
    else setSales(prev => [{ ...data, id: Date.now() }, ...prev]);
    setShowSaleModal(false); setEditingSaleId(null); setFormData({ date: new Date().toISOString().split('T')[0], itemName: '', productId: '', channel: 'Etsy', soldPrice: '', shippingFee: '', marketingTax: '', packaging: '', cog: '' });
  };

  const handleBatchCogUpdate = () => {
    setProducts(prev => prev.map(p => selectedProductIds.includes(p.id) ? { ...p, defaultCog: parseFloat(batchCogValue) || 0 } : p));
    setShowBatchCogModal(false); setSelectedProductIds([]); setBatchCogValue('');
  };

  const handleEtsyCSVUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsImporting(true);
    try {
      let combined = [];
      for (const file of files) {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const data = lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/"/g, '').trim());
          return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] || '' }), {});
        });
        combined = [...combined, ...data];
      }
      let currentProducts = [...products];
      const newSales = combined.map(row => {
        const itemName = row['Item Name'] || 'Etsy Sale';
        let matched = currentProducts.find(p => areSimilar(p.name, itemName));
        if (!matched) { matched = { id: Math.random().toString(36).substr(2, 9), name: itemName.split('|')[0].trim(), defaultCog: 0, defaultPrice: parseFloat(row['Price']) || 0 }; currentProducts.push(matched); }
        let date = ''; try { const [m, d, y] = row['Sale Date'].split('/'); date = `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; } catch (e) { date = new Date().toISOString().split('T')[0]; }
        return { id: Math.random().toString(36).substr(2, 9), date, itemName, productId: matched.id, channel: row['Order Type']?.toLowerCase().includes('inperson') ? 'In-Person Markets' : 'Etsy', soldPrice: parseFloat(row['Item Total']) || 0, shippingFee: parseFloat(row['Order Shipping']) || 0, marketingTax: parseFloat(row['Order Sales Tax']) || 0, packaging: 0 };
      });
      setProducts(currentProducts); setSales(prev => [...newSales, ...prev]); setShowImportModal(false);
    } catch (err) { alert("Error importing Etsy CSV."); } finally { setIsImporting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <nav className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg"><TrendingUp className="text-white w-5 h-5" /></div>
          <h1 className="text-xl font-bold tracking-tight">SalesTracker Pro</h1>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${view === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Dashboard</button>
          <button onClick={() => setView('table')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${view === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Sales</button>
          <button onClick={() => setView('products')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${view === 'products' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Products</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 mt-4">
        {view === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Revenue</p><h2 className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</h2></div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Live Profit</p><h2 className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalProfit)}</h2></div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Avg Margin</p><h2 className="text-xl font-bold text-indigo-600">{stats.avgMargin.toFixed(1)}%</h2></div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Inventory COG</p><h2 className="text-xl font-bold text-slate-700">{formatCurrency(stats.totalCOGs)}</h2></div>
          </div>
        )}

        {view === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b flex gap-4">
              <input type="text" placeholder="Search sales..." className="flex-1 px-4 py-2 bg-slate-50 rounded-xl text-sm" value={salesSearchTerm} onChange={e => setSalesSearchTerm(e.target.value)} />
              <select className="px-4 py-2 bg-slate-50 rounded-xl text-sm" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
                <option value="All">All Channels</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-400">
                    <th className="px-6 py-4 cursor-pointer" onClick={() => setSalesSort({ key: 'date', direction: salesSort.direction === 'asc' ? 'desc' : 'asc' })}>Date</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Catalog Link</th>
                    <th className="px-6 py-4 text-right">Price</th>
                    <th className="px-6 py-4 text-right">Net Profit</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 group">
                      <td className="px-6 py-4 text-xs text-slate-400">{sale.date}</td>
                      <td className="px-6 py-4 font-semibold text-sm truncate max-w-[200px]">{sale.itemName}</td>
                      <td className="px-6 py-4 text-xs font-bold text-indigo-600">{sale.productName}</td>
                      <td className="px-6 py-4 text-right font-bold">{formatCurrency(sale.soldPrice)}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(sale.profit)}</td>
                      <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100">
                        <button onClick={() => openEditSale(sale)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={14}/></button>
                        <button onClick={() => setSales(prev => prev.filter(s => s.id !== sale.id))} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'products' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-bold">Catalog</h2>
               <button onClick={() => setProducts(prev => [{ id: Math.random().toString(36).substr(2, 9), name: "New Product", defaultCog: 0, defaultPrice: 0 }, ...prev])} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">New Product</button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-6 py-4 w-10">Select</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4 text-right">Cost (COG)</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4"><input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => setSelectedProductIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} /></td>
                        <td className="px-6 py-4"><input type="text" value={p.name} onChange={e => setProducts(prev => prev.map(item => item.id === p.id ? { ...item, name: e.target.value } : item))} className="bg-transparent border-none font-bold text-sm w-full" /></td>
                        <td className="px-6 py-4 text-right"><input type="number" step="0.01" value={p.defaultCog} onChange={e => setProducts(prev => prev.map(item => item.id === p.id ? { ...item, defaultCog: parseFloat(e.target.value) || 0 } : item))} className="bg-slate-50 rounded px-2 py-1 text-right text-sm w-20 font-bold" /></td>
                        <td className="px-6 py-4 text-right"><button onClick={() => setProducts(prev => prev.filter(item => item.id !== p.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
            {selectedProductIds.length > 0 && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4">
                <span className="font-bold">{selectedProductIds.length} Selected</span>
                <input type="number" placeholder="New COG" className="w-24 px-3 py-1 rounded text-slate-900" value={batchCogValue} onChange={e => setBatchCogValue(e.target.value)} />
                <button onClick={handleBatchCogUpdate} className="bg-white text-indigo-600 px-4 py-1 rounded-lg font-bold">Apply COG</button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Menu */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
        {isFabOpen && (
          <div className="flex flex-col items-end gap-2 mb-2 animate-in slide-in-from-bottom-4">
            <button onClick={() => { setImportTab('etsy'); setShowImportModal(true); setIsFabOpen(false); }} className="bg-white px-4 py-2 rounded-xl shadow-lg border text-sm font-bold text-slate-600 hover:bg-slate-50">Import Etsy CSV</button>
            <button onClick={() => { setEditingSaleId(null); setView('table'); setShowSaleModal(true); setIsFabOpen(false); }} className="bg-white px-4 py-2 rounded-xl shadow-lg border text-sm font-bold text-slate-600 hover:bg-slate-50">Log Manual Sale</button>
          </div>
        )}
        <button onClick={() => setIsFabOpen(!isFabOpen)} className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isFabOpen ? 'bg-slate-800 rotate-45 text-white' : 'bg-indigo-600 text-white hover:scale-110'}`}><Plus size={28} /></button>
      </div>

      {/* Sale Modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveSale} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
             <h2 className="text-xl font-bold">{editingSaleId ? 'Edit Sale' : 'Manual Entry'}</h2>
             <div className="grid grid-cols-2 gap-4">
               <div><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl" required /></div>
               <div><label className="text-[10px] font-bold text-slate-400 uppercase">Channel</label><select name="channel" value={formData.channel} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl">{CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
             </div>
             <div><label className="text-[10px] font-bold text-indigo-600 uppercase">Catalog Link</label><select name="productId" value={formData.productId} onChange={handleInputChange} className="w-full px-4 py-2 border-2 border-indigo-100 bg-indigo-50 rounded-xl font-bold">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="">-- Manual Entry --</option></select></div>
             <div><label className="text-[10px] font-bold text-slate-400 uppercase">Title</label><input type="text" name="itemName" value={formData.itemName} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl" required /></div>
             <div className="grid grid-cols-2 gap-4">
               <div><label className="text-[10px] font-bold text-slate-400 uppercase">Price</label><input type="number" step="0.01" name="soldPrice" value={formData.soldPrice} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl font-bold text-emerald-600" required /></div>
               <div><label className="text-[10px] font-bold text-slate-400 uppercase">Shipping</label><input type="number" step="0.01" name="shippingFee" value={formData.shippingFee} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-xl" /></div>
             </div>
             <div className="flex gap-2"><button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Save Sale</button><button type="button" onClick={() => setShowSaleModal(false)} className="px-6 py-3 bg-slate-100 rounded-xl font-bold">Cancel</button></div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Sync Etsy CSV</h2>
            <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-12 hover:bg-slate-50 cursor-pointer">
              <input type="file" accept=".csv" multiple onChange={handleEtsyCSVUpload} className="hidden" />
              <Upload className="mx-auto text-slate-300 mb-2" />
              <span className="text-xs font-bold text-indigo-600">Select Files</span>
            </label>
            <button onClick={() => setShowImportModal(false)} className="mt-4 text-slate-400 font-bold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;