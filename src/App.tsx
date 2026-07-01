import { useState, useEffect, useCallback, useMemo, FormEvent, MouseEvent } from "react";
import { 
  Link2, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Calendar, 
  Clock, 
  Smartphone, 
  Monitor, 
  Tablet, 
  Globe, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Plus, 
  Activity, 
  Info, 
  ChevronRight, 
  Share2 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ClickLog {
  id: string;
  timestamp: string;
  userAgent: string;
  ip: string;
  referrer: string;
  browser: string;
  os: string;
  device: "Mobile" | "Tablet" | "Desktop" | "Unknown";
  queryParams: Record<string, string>;
}

interface TrackedLink {
  id: string;
  targetUrl: string;
  title: string;
  createdAt: string;
  clicks: ClickLog[];
}

export default function App() {
  // Application State
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load backend configuration
  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        if (data.appUrl) {
          setAppUrl(data.appUrl);
        }
      })
      .catch(err => console.error("Could not fetch server config", err));
  }, []);

  // Compute the current absolute base tracking URL
  const baseTrackingUrl = useMemo(() => {
    return appUrl || window.location.origin;
  }, [appUrl]);

  // Fetch tracked links from the server
  const fetchLinks = useCallback(async (silent = false) => {
    if (!silent) setIsFetching(true);
    try {
      const res = await fetch("/api/links");
      if (!res.ok) throw new Error("Failed to load links");
      const data: TrackedLink[] = await res.json();
      setLinks(data);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not retrieve tracked links");
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, []);

  // Poll for clicks/updates periodically
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLinks(true); // Silent update in background
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLinks]);

  // Handle new link creation
  const handleCreateLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setIsCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          title: title.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate link");
      }

      const newLink: TrackedLink = await res.json();
      setLinks(prev => [newLink, ...prev]);
      setSelectedLinkId(newLink.id);
      
      // Reset inputs
      setTargetUrl("");
      setTitle("");
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while creating the link");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle link deletion
  const handleDeleteLink = async (id: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this tracked link and all its click logs?")) {
      return;
    }

    try {
      const res = await fetch(`/api/links/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete link");

      setLinks(prev => prev.filter(l => l.id !== id));
      if (selectedLinkId === id) {
        setSelectedLinkId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Could not delete link");
    }
  };

  // Clipboard copy helper
  const handleCopy = (id: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    const linkUrl = `${baseTrackingUrl}/t/${id}`;
    navigator.clipboard.writeText(linkUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Computed links list based on search filter
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const query = searchQuery.toLowerCase();
    return links.filter(link => 
      link.title.toLowerCase().includes(query) || 
      link.targetUrl.toLowerCase().includes(query) ||
      link.id.toLowerCase().includes(query)
    );
  }, [links, searchQuery]);

  // Selected link info
  const selectedLink = useMemo(() => {
    return links.find(l => l.id === selectedLinkId) || null;
  }, [links, selectedLinkId]);

  // If no link is selected, default to the first one if links exist
  useEffect(() => {
    if (!selectedLinkId && filteredLinks.length > 0) {
      setSelectedLinkId(filteredLinks[0].id);
    }
  }, [filteredLinks, selectedLinkId]);

  // Calculate overall stats
  const totalClicksCount = useMemo(() => {
    return links.reduce((acc, link) => acc + link.clicks.length, 0);
  }, [links]);

  // Format relative time helper
  const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Link2 className="w-6 h-6 animate-pulse" id="nav-logo-icon" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
                Link Click Tracker
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Surgical Redirect Analytics & Live Click Auditor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
                autoRefresh 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
              title={autoRefresh ? "Click to pause automatic real-time sync" : "Click to enable automatic real-time sync"}
              id="btn-toggle-refresh"
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`}></span>
              {autoRefresh ? "Live Sync Active" : "Sync Paused"}
            </button>

            <button
              onClick={() => fetchLinks()}
              disabled={isFetching}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              title="Manual Reload"
              id="btn-manual-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Create Form & Links Feed (cols 1 to 5) */}
        <section className="lg:col-span-5 flex flex-col gap-6 h-fit lg:sticky lg:top-[88px]">
          
          {/* Quick Stats Widget */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs grid grid-cols-3 gap-2">
            <div className="text-center border-r border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Created</p>
              <p className="text-xl font-display font-bold text-slate-800">{links.length}</p>
            </div>
            <div className="text-center border-r border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Clicks</p>
              <p className="text-xl font-display font-bold text-indigo-600">{totalClicksCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Live Rate</p>
              <p className="text-xl font-display font-bold text-emerald-600">
                {links.length > 0 ? (totalClicksCount / links.length).toFixed(1) : "0.0"}
                <span className="text-[10px] font-medium text-slate-400 ml-0.5">/L</span>
              </p>
            </div>
          </div>

          {/* Form: Create Tracker Link */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <h2 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-600" />
              Generate Tracked Link
            </h2>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                  Destination Link (Target URL)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. google.com or https://mywork.com/post/1"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.targetUrl || e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
                    id="input-target-url"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                  Reference Label / Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. June Newsletter Campaign"
                  value={title}
                  onChange={(e) => setTitle(e.title || e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400"
                  id="input-link-title"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-start gap-2 border border-red-100 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="btn-create-link"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Safe Tracker...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Generate Tracking Link
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Links List Filter and Container */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col flex-1 max-h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter links..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.searchQuery || e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  id="input-filter-links"
                />
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 custom-scrollbar">
              <AnimatePresence initial={false}>
                {filteredLinks.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-semibold">No tracked links found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery ? "Try searching for a different label" : "Create a link above to get started!"}
                    </p>
                  </div>
                ) : (
                  filteredLinks.map((link) => {
                    const isSelected = selectedLinkId === link.id;
                    const trackingUrl = `${baseTrackingUrl}/t/${link.id}`;
                    return (
                      <motion.div
                        key={link.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setSelectedLinkId(link.id)}
                        className={`p-4 cursor-pointer transition-all flex items-start justify-between gap-3 relative overflow-hidden group ${
                          isSelected 
                            ? "bg-slate-50 border-l-4 border-indigo-600" 
                            : "hover:bg-slate-50/70 border-l-4 border-transparent"
                        }`}
                        id={`link-item-${link.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display font-bold text-sm text-slate-800 truncate block">
                              {link.title}
                            </span>
                            <span className="text-[10px] font-bold font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {link.id}
                            </span>
                          </div>

                          <span className="text-xs text-slate-400 font-mono truncate block mb-1">
                            {link.targetUrl}
                          </span>

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(link.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                            <span className="flex items-center gap-1 font-bold text-slate-500">
                              <Activity className="w-3 h-3" />
                              {link.clicks.length} {link.clicks.length === 1 ? "click" : "clicks"}
                            </span>
                          </div>
                        </div>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          <button
                            onClick={(e) => handleCopy(link.id, e)}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                            title="Copy Tracking URL"
                            id={`btn-copy-link-feed-${link.id}`}
                          >
                            {copiedId === link.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => handleDeleteLink(link.id, e)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete Link"
                            id={`btn-delete-link-feed-${link.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-indigo-600" : "group-hover:translate-x-0.5"}`} />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Right Side: Analytics and Logs Board (cols 6 to 12) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!selectedLink ? (
              <motion.div
                key="empty-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm flex flex-col justify-center items-center min-h-[500px]"
              >
                <div className="p-4 bg-slate-50 rounded-full mb-3 text-slate-300">
                  <Activity className="w-12 h-12 stroke-[1.5]" />
                </div>
                <h3 className="font-display font-bold text-slate-800 text-lg">No Link Selected</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-sm">
                  Create a tracked link, or select one from the feed on the left to inspect its live logs and traffic dashboard.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedLink.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                {/* Selected Link Metadata & Shortener Utility */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                  
                  {/* Top row with Title and Delete action */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold font-mono tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          CODE: {selectedLink.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          Created {new Date(selectedLink.createdAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-slate-900 text-xl tracking-tight leading-snug break-words">
                        {selectedLink.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleDeleteLink(selectedLink.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold tracking-wide transition-colors border border-red-100/50 cursor-pointer"
                      id="btn-delete-active-link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Tracker
                    </button>
                  </div>

                  {/* Core Addresses (Original vs Tracked) */}
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                        Redirect Destination URL
                      </span>
                      <a
                        href={selectedLink.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-mono flex items-center gap-1 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl hover:underline break-all group"
                      >
                        <span className="truncate flex-1">{selectedLink.targetUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>

                    {/* The generated tracker URL widget */}
                    <div className="p-4 bg-slate-900 text-white rounded-xl relative overflow-hidden">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            Your Live Tracking Link
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-900/50 px-1.5 py-0.5 rounded-full">
                            Active & Redirecting
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1 bg-black/40 p-2 rounded-lg border border-white/5">
                          <div className="font-mono text-xs text-slate-200 select-all break-all px-2 py-1 flex-1">
                            {baseTrackingUrl}/t/{selectedLink.id}
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`${baseTrackingUrl}/t/${selectedLink.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 transition-all"
                              id="btn-test-redirect-link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Test Link
                            </a>

                            <button
                              onClick={() => handleCopy(selectedLink.id)}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                copiedId === selectedLink.id 
                                  ? "bg-emerald-600 text-white" 
                                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                              }`}
                              id="btn-copy-big-link"
                            >
                              {copiedId === selectedLink.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy Link
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Shortcut instructions and TinyURL prefilled button */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400">
                          <p className="flex items-start gap-1.5 max-w-sm">
                            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <span>
                              Send this link to anyone. Or, click the button to prefill it inside <strong>TinyURL</strong> to shorten it easily!
                            </span>
                          </p>

                          <a
                            href={`https://tinyurl.com/app/?url=${encodeURIComponent(`${baseTrackingUrl}/t/${selectedLink.id}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold tracking-wide transition-colors shrink-0"
                            id="btn-open-tinyurl"
                          >
                            Shorten with TinyURL
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Click Logs Section */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-slate-900 text-lg">
                          Live Click Auditor
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Exact timestamps and metadata parsed on arrival
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-display font-bold text-slate-900">
                        {selectedLink.clicks.length}
                      </span>
                      <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">
                        Clicks Logged
                      </span>
                    </div>
                  </div>

                  {/* Clicks list */}
                  <div className="flex-1 overflow-y-auto max-h-[480px] pr-1 space-y-3 custom-scrollbar">
                    {selectedLink.clicks.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center min-h-[220px]">
                        <Clock className="w-10 h-10 text-slate-300 stroke-[1.2] mb-3 animate-pulse" />
                        <p className="text-sm font-semibold text-slate-600">Waiting for first audit click...</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-normal">
                          Shorten your tracking link, send it out, and the instant someone clicks, their arrival time and system details will stream in here.
                        </p>
                      </div>
                    ) : (
                      // Sort clicks newest first in display
                      [...selectedLink.clicks].reverse().map((click, index) => {
                        const hasParams = Object.keys(click.queryParams).length > 0;
                        const clickDate = new Date(click.timestamp);
                        const formattedDateStr = clickDate.toLocaleString(undefined, { 
                          dateStyle: "medium", 
                          timeStyle: "medium" 
                        });

                        return (
                          <div 
                            key={click.id} 
                            className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 transition-all hover:bg-slate-50"
                            id={`click-log-${click.id}`}
                          >
                            {/* Header: Click # and exact click time */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/50 pb-2.5 mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-mono text-slate-400 uppercase bg-slate-200/50 px-1.5 py-0.5 rounded">
                                  #{selectedLink.clicks.length - index}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  {formattedDateStr}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full shrink-0 self-start sm:self-auto uppercase tracking-wider">
                                {formatRelativeTime(click.timestamp)}
                              </span>
                            </div>

                            {/* Click Metadata Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                              
                              {/* Left Column: Device and Browser Details */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {click.device === "Mobile" && <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                  {click.device === "Tablet" && <Tablet className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                  {click.device === "Desktop" && <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                  {click.device === "Unknown" && <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                  
                                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">SYSTEM:</span>
                                  <span className="font-medium text-slate-800">
                                    {click.browser} on {click.os} ({click.device})
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">VISITOR IP:</span>
                                  <span className="font-mono bg-slate-200/50 px-1.5 py-0.5 rounded font-bold text-slate-700">
                                    {click.ip || "Direct Link Access"}
                                  </span>
                                </div>
                              </div>

                              {/* Right Column: Referer and Query Params */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">REFERRER:</span>
                                  <span className="truncate font-medium text-slate-800" title={click.referrer || "None"}>
                                    {click.referrer ? new URL(click.referrer).hostname : "Direct (e.g. Email / Chat)"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">UTM / ARGS:</span>
                                  {hasParams ? (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                      {Object.keys(click.queryParams).length} parameters captured
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">None detected</span>
                                  )}
                                </div>
                              </div>

                            </div>

                            {/* Expanded Query parameters viewer if present */}
                            {hasParams && (
                              <div className="mt-3 bg-white border border-slate-200 rounded-lg p-2 text-xs">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                  Captured Parameters Table
                                </p>
                                <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-1.5 font-mono">
                                  {Object.entries(click.queryParams).map(([key, val]) => (
                                    <div key={key} className="col-span-2 flex items-center justify-between text-[11px] py-0.5 border-b border-slate-50 last:border-0">
                                      <span className="text-slate-500 font-bold">{key}</span>
                                      <span className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-medium select-all">
                                        {val}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </section>

      </main>

      {/* Humble craft footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-6 text-center text-xs text-slate-400 mt-auto">
        <p className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Click logging server active &middot; Fully localized timestamp precision
          </span>
          <span className="font-mono text-[11px]">
            UTC: {new Date().toISOString().substring(0, 10)}
          </span>
        </p>
      </footer>
    </div>
  );
}
