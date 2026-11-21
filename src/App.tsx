import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { ArrowRight, Check, ChevronDown, CircleHelp, Clapperboard, Clock3, CloudUpload, Download, Film, FolderOpen, ImagePlus, LayoutGrid, Menu, MoreHorizontal, Plus, RefreshCw, Settings2, Sparkles, WandSparkles, X } from 'lucide-react';

type Page = 'studio' | 'videos' | 'library';
type Notice = { title: string; text: string } | null;
type GeneratedImage = { dataUrl: string };

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Gambar tidak dapat dibaca.'));
    reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    reader.readAsDataURL(file);
  });
}
const navItems: { id: Page; label: string; icon: typeof Sparkles }[] = [
  { id: 'studio', label: 'Studio', icon: WandSparkles },
  { id: 'videos', label: 'Video saya', icon: Film },
  { id: 'library', label: 'Koleksi', icon: FolderOpen },
];

export default function App() {
  const [page, setPage] = useState<Page>('studio');
  const [reference, setReference] = useState<string | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [imageApproved, setImageApproved] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [providerStatus, setProviderStatus] = useState<'checking' | 'ready' | 'missing' | 'unavailable'>('checking');
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/health').then(async (response) => {
      if (!response.ok) throw new Error('Backend tidak tersedia.');
      const health = await response.json() as { imageProviderConfigured?: boolean };
      if (active) setProviderStatus(health.imageProviderConfigured ? 'ready' : 'missing');
    }).catch(() => { if (active) setProviderStatus('unavailable'); });
    return () => { active = false; };
  }, []);

  function notify(title: string, text: string) {
    setNotice({ title, text });
    window.setTimeout(() => setNotice(null), 3800);
  }
  function chooseFile(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('Format belum didukung', 'Pilih gambar JPG, PNG, atau WebP.');
    if (file.size > 12 * 1024 * 1024) return notify('Ukuran gambar terlalu besar', 'Gunakan gambar dengan ukuran maksimum 12 MB.');
    setReference((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setGeneratedImage(null);
    setImageApproved(false);
    setReferenceFile(file);
    setFileName(file.name);
  }
  function removeFile() {
    if (reference) URL.revokeObjectURL(reference);
    setReference(null); setReferenceFile(null); setFileName('');
    if (fileInput.current) fileInput.current.value = '';
  }
  async function generateImage() {
    if (providerStatus !== 'ready') return notify('Backend gambar belum siap', providerStatus === 'missing' ? 'OPENAI_API_KEY belum disetel di backend.' : 'Periksa koneksi ke backend lalu coba lagi.');
    if (!imagePrompt.trim()) return notify('Prompt masih kosong', 'Tulis deskripsi gambar yang ingin dibuat.');
    setGeneratingImage(true);
    setImageApproved(false);
    try {
      const referenceImage = referenceFile;
      const payload = {
        prompt: imagePrompt.trim(),
        referenceImage: referenceImage ? { name: referenceImage.name, dataUrl: await readFileAsDataUrl(referenceImage) } : null,
      };
      const response = await fetch('/api/images/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { imageDataUrl?: string; error?: { message?: string } };
      if (!response.ok || !result.imageDataUrl) throw new Error(result.error?.message || 'Gambar tidak berhasil dibuat.');
      setGeneratedImage({ dataUrl: result.imageDataUrl });
      notify('Gambar selesai dibuat', 'Periksa hasilnya lalu setujui atau buat ulang.');
    } catch (error) {
      notify('Generate gambar gagal', error instanceof Error ? error.message : 'Periksa koneksi backend lalu coba lagi.');
    } finally {
      setGeneratingImage(false);
    }
  }
  const title = page === 'studio' ? 'Studio kreatif' : page === 'videos' ? 'Video saya' : 'Koleksi';
  const canvasImage = generatedImage?.dataUrl || reference;
  const providerLabel = { checking: 'Memeriksa API', ready: 'AI siap', missing: 'Atur API', unavailable: 'API offline' }[providerStatus];

  return <div className={`app-shell ${drawerOpen ? "drawer-open" : ""}`}>
    {drawerOpen && <button className="drawer-overlay" aria-label="Tutup menu" onClick={() => setDrawerOpen(false)} />}
    <aside className="sidebar" aria-label="Menu samping">
      <button className="drawer-close" aria-label="Tutup menu" onClick={() => setDrawerOpen(false)}><X size={19}/></button>
      <a className="brand" href="#studio" onClick={() => setPage('studio')}><span className="brand-mark"><Sparkles size={19}/></span><span className="brand-name">creator<span>studio</span></span></a>
      <button className="workspace-switch" onClick={() => notify('Ruang kerja pribadi', 'Pengaturan tim akan tersedia pada tahap berikutnya.')}><span className="workspace-avatar">A</span><span className="workspace-copy"><strong>Ruang kerja</strong><small>Personal</small></span><ChevronDown size={15}/></button>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Navigasi utama">{navItems.map(({id,label,icon:Icon}) => <button key={id} className={`nav-item ${page===id?'active':''}`} onClick={() => { setPage(id); setDrawerOpen(false); }}><Icon size={18}/><span>{label}</span>{id==='videos'&&<span className="nav-count">0</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-tip"><span className="tip-spark"><Sparkles size={15}/></span><strong>Ide besar, langkah kecil.</strong><p>Bangun visualmu satu frame dalam satu waktu.</p></div>
      <button className="nav-item utility-item" onClick={() => { setDrawerOpen(false); notify('Pusat bantuan', 'Panduan produk akan hadir setelah alur Studio siap.'); }}><CircleHelp size={18}/><span>Bantuan</span></button>
      <div className="profile-row"><div className="profile-avatar">N</div><div className="profile-copy"><strong>Pengguna</strong><small>Studio pribadi</small></div><MoreHorizontal size={19}/></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="menu-button" aria-label="Buka menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div><div className="topbar-actions"><span className="local-badge"><i/> {providerLabel}</span><button className="help-button" onClick={() => notify('Pusat bantuan', 'Panduan produk akan hadir setelah alur Studio siap.')}><CircleHelp size={16}/> Bantuan</button></div></header>
      {page==='studio'&&<div className="content-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><i/> RUANG KREASI</div><h1>Wujudkan ide<br className="mobile-break"/> jadi <em>cerita visual.</em></h1><p className="welcome-subtitle">Mulai dari satu referensi. Rangkai gambar, lalu bayangkan geraknya.</p></div><button className="history-button" onClick={() => setPage('videos')}><Clock3 size={15}/> Riwayat <ArrowRight size={14}/></button></section>
        <div className="studio-grid"><section className="workflow-column">
          <div className="step-heading"><span className="step-number">01</span><div><h2>Referensi utama</h2><p>Unggah gambar untuk menjadi arah visual.</p></div><span className="step-tag">OPSIONAL</span></div>
          <div className={`upload-card ${dragging?'dragging':''} ${reference?'has-image':''}`} onDragOver={(e) => {e.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();setDragging(false);chooseFile(e.dataTransfer.files[0]);}}>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>chooseFile(e.target.files?.[0])}/>
            {reference?<><img className="reference-preview" src={reference} alt="Pratinjau gambar referensi"/><div className="uploaded-overlay"><span><Check size={13}/> Referensi siap</span><button onClick={removeFile} aria-label="Hapus gambar"><X size={15}/></button></div><div className="file-name"><ImagePlus size={13}/>{fileName}</div></>:<div className="upload-empty"><div className="upload-symbol"><CloudUpload size={22}/></div><strong>Taruh gambar di sini</strong><span>atau <button className="text-button" onClick={()=>fileInput.current?.click()}>pilih dari perangkat</button></span><small>JPG, PNG, WebP <i/> Maks. 12 MB</small></div>}
          </div>
          <div className="step-heading prompt-heading"><span className="step-number">02</span><div><h2>Bayangkan gambarnya</h2><p>Ceritakan suasana dan detail yang kamu inginkan.</p></div></div>
          <div className="prompt-card"><div className="prompt-label-row"><label htmlFor="image-prompt">PROMPT GAMBAR</label><button className="prompt-helper" onClick={()=>notify('Asisten prompt belum aktif','Penyusunan prompt otomatis akan ditambahkan pada tahap integrasi AI.')}><Sparkles size={13}/> Bantu tulis</button></div><textarea id="image-prompt" maxLength={500} value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} placeholder="Contoh: Kedai kopi kecil di tepi pantai saat senja, cahaya keemasan, suasana hangat dan sinematik..."/><div className="prompt-footer"><span><i/> Ide tersimpan di sesi ini</span><span>{500-imagePrompt.length} karakter</span></div></div>
          <div className="generate-row"><button className="primary-button" onClick={()=>void generateImage()} disabled={generatingImage || providerStatus !== 'ready'}><Sparkles size={16}/> {generatingImage ? 'Membuat gambar…' : 'Generate gambar'} {generatingImage ? <RefreshCw className="spinning" size={15}/> : <ArrowRight size={15}/>}</button><span className="offline-note"><i/> {providerStatus === 'ready' ? 'Terhubung melalui backend' : providerStatus === 'missing' ? 'API key belum disetel' : providerStatus === 'unavailable' ? 'Backend tidak tersambung' : 'Memeriksa backend'}</span></div>
          <div className="step-heading video-step-heading"><span className="step-number">03</span><div><h2>Tambahkan gerakan</h2><p>Jelaskan bagaimana adegan ini bergerak.</p></div><span className="coming-chip">SEGERA</span></div>
          <div className="video-prompt-card"><div className="video-prompt-icon"><Clapperboard size={19}/></div><div className="video-prompt-body"><label htmlFor="video-prompt">PROMPT VIDEO</label><textarea id="video-prompt" maxLength={350} value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} placeholder="Contoh: Kamera perlahan mendekat, uap kopi bergerak lembut tertiup angin..."/></div><button className="video-prompt-action" onClick={()=>notify('Video belum dapat dibuat','Google Flow belum diintegrasikan. Tidak ada permintaan palsu yang akan dikirim.')} aria-label="Info generate video"><ArrowRight size={16}/></button></div>
          <div className="flow-note"><span>✳</span> Mesin video: <strong>belum dihubungkan</strong><button onClick={()=>notify('Integrasi video','Google Flow tidak terhubung pada tahap antarmuka ini.')}>Tentang ini</button></div>
        </section>
        <aside className="preview-column"><div className="preview-topline"><div><span className="preview-kicker">KANVAS</span><h2>Pratinjau gambar</h2></div><button className="icon-button" aria-label="Pengaturan pratinjau" onClick={()=>notify('Pengaturan kanvas','Pengaturan rasio dan gaya akan tersedia pada tahap berikutnya.')}><Settings2 size={17}/></button></div>
          <div className={`canvas-frame ${canvasImage?'canvas-has-image':''}`}><i className="corner tl"/><i className="corner tr"/><i className="corner bl"/><i className="corner br"/>{canvasImage?<img className="canvas-image" src={canvasImage} alt={generatedImage?'Hasil gambar AI':'Gambar referensi'}/>:<div className="canvas-empty"><div className="canvas-orbit"/><div className="canvas-icon"><ImagePlus size={27}/></div><strong>Kanvasmu menunggu ide</strong><span>Hasil gambar dan referensi akan<br/>tampil di sini.</span><button onClick={()=>fileInput.current?.click()}><Plus size={14}/> Tambah referensi</button></div>}<div className="canvas-label"><i/> {generatedImage?(imageApproved?'DISETUJUI':'HASIL AI'):reference?'REFERENSI':'KOSONG'}</div></div>
          <div className="preview-caption"><span>Rasio kanvas</span><strong>3:4 <ChevronDown size={13}/></strong></div><div className="preview-divider"/><div className="approval-title"><span><Check size={15}/></span><div><strong>{imageApproved?'Gambar disetujui':'Setujui sebelum lanjut'}</strong><small>{generatedImage?'Hasil AI siap diperiksa sebelum digunakan.':'Buat gambar AI untuk mengaktifkan persetujuan.'}</small></div></div>
          <div className="approval-actions"><button className="secondary-button" onClick={()=>void generateImage()} disabled={!generatedImage || generatingImage}><RefreshCw size={14}/> Buat ulang</button><button className={`approve-button ${imageApproved?'approved':''}`} onClick={()=>{if(generatedImage)setImageApproved(true);}} disabled={!generatedImage} aria-pressed={imageApproved}><Check size={15}/> {imageApproved?'Disetujui':'Setujui'}</button></div><div className="preview-footnote">◇ Karya dan prompt tetap milikmu.</div>
        </aside></div>
        <div className="idea-banner"><span className="idea-icon"><Sparkles size={15}/></span><span><strong>Ruang ini masih kosong. Itu bagian yang seru.</strong><small>Unggah referensi atau mulai dengan prompt pertamamu.</small></span><button aria-label="Mulai berkarya" onClick={()=>document.getElementById('image-prompt')?.focus()}><ArrowRight size={16}/></button></div>
      </div>}
      {page==='videos'&&<div className="content-wrap secondary-page"><section className="welcome-row"><div><div className="eyebrow"><i/> HASIL KREASI</div><h1>Cerita yang <em>bergerak.</em></h1><p className="welcome-subtitle">Semua video yang kamu buat, tersimpan di satu tempat.</p></div><button className="history-button" onClick={()=>setPage('studio')}><Plus size={15}/> Kreasi baru</button></section><section className="empty-state-card"><div className="empty-art"><div className="empty-art-glow"/><div className="empty-art-frame"><Clapperboard size={25}/><i/></div><span className="art-star star-a">✳</span><span className="art-star star-b">✦</span><span className="art-squiggle">〰</span></div><span className="empty-eyebrow">BELUM ADA VIDEO</span><h2>Setiap cerita dimulai dari satu frame.</h2><p>Setujui gambar di Studio, lalu ubah idemu menjadi video. Hasilnya akan muncul di sini.</p><button className="primary-button" onClick={()=>setPage('studio')}><WandSparkles size={15}/> Kembali ke Studio <ArrowRight size={14}/></button><div className="empty-state-note"><i/> Penghubung Google Flow belum tersedia</div><button className="save-result-button" disabled title="Tersedia setelah video dibuat"><Download size={14}/> Simpan hasil ke perangkat</button></section><div className="results-info"><span><Film size={14}/> 0 video</span><button onClick={()=>notify('Hasil video','Video yang dihasilkan nantinya bisa diputar dan disimpan dari halaman ini.')}><CircleHelp size={14}/> Cara kerja</button></div></div>}
      {page==='library'&&<div className="content-wrap secondary-page"><section className="welcome-row"><div><div className="eyebrow"><i/> ARSIP KARYA</div><h1>Semua ide, <em>tersimpan.</em></h1><p className="welcome-subtitle">Koleksi referensi dan hasil yang kamu simpan.</p></div></section><section className="empty-state-card library-empty"><div className="library-icons"><span><ImagePlus size={21}/></span><span><FolderOpen size={21}/></span><span><Film size={18}/></span></div><span className="empty-eyebrow">KOLEKSIMU</span><h2>Tempat untuk ide-ide favorit.</h2><p>Gambar dan video yang kamu simpan akan terkumpul di sini.</p><button className="secondary-button" onClick={()=>setPage('studio')}><Plus size={14}/> Mulai kreasi pertama</button></section><div className="results-info"><span><LayoutGrid size={14}/> Koleksi pribadi</span><span className="private-label">Pribadi · hanya kamu</span></div></div>}
      <footer className="page-footer"><span>AI Creator Studio <b>·</b> Tahap antarmuka</span><span>Dirancang untuk ide yang belum selesai.</span></footer>
    </main>
    <nav className="mobile-nav" aria-label="Navigasi mobile">{navItems.map(({id,label,icon:Icon})=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {notice&&<div className="toast" role="status"><span className="toast-icon"><Sparkles size={15}/></span><span><strong>{notice.title}</strong><small>{notice.text}</small></span><button aria-label="Tutup" onClick={()=>setNotice(null)}><X size={15}/></button></div>}
  </div>;
}
