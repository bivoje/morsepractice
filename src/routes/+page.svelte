<script>
</script>

<main class="container">
	<header>
		<h1>Morse Practice</h1>
		<p class="subtitle">Choose a mode to start practicing typing Morse.</p>
	</header>

	<ul class="grid" role="list">
		<li role="listitem">
			<a class="card" href="/word">
				<div class="icon" aria-hidden="true">
				<!-- word icon -->
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h16"/></svg>
			</div>
			<h2>Word Mode</h2>
			<p>Practice individual words one at a time. Great for focused accuracy drills.</p>
			<span class="cta">Start</span>
			</a>
		</li>

		<li role="listitem">
			<a class="card" href="/text">
				<div class="icon" aria-hidden="true">
				<!-- text icon -->
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>
			</div>
			<h2>Text Mode</h2>
			<p>Type full sentences or paragraphs to practice rhythm and spacing.</p>
			<span class="cta">Start</span>
			</a>
		</li>

		<li role="listitem">
			<a class="card" href="/free">
				<div class="icon" aria-hidden="true">
				<!-- free icon -->
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>
			</div>
			<h2>Free Mode</h2>
			<p>Type whatever you like — freeform practice with live feedback.</p>
			<span class="cta">Start</span>
			</a>
		</li>
	</ul>
</main>

<style>
	:global(body) { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; }
	.container{max-width:980px;margin:48px auto;padding:0 20px}
	header{ text-align:center }
	header h1{font-size:2rem;margin:0 0 6px}
	.subtitle{color:#666;margin:0 0 24px;text-align:center}
	.grid{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}
	.card{display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:10px;text-decoration:none;background:linear-gradient(180deg,#fff,#fbfdff);border:1px solid #e6eef9;color:inherit;box-shadow:0 6px 18px rgba(20,30,60,0.04);transition:transform .12s ease,box-shadow .12s ease}
	.card:hover,.card:focus{transform:translateY(-4px);box-shadow:0 12px 28px rgba(20,30,60,0.08);outline:3px solid rgba(100,150,255,0.12)}
	.icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:10px;background:#f2f8ff;color:#065fd4}
	.card h2{margin:0;font-size:1.05rem}
	.card p{margin:0;color:#555;font-size:.95rem}
	.cta{align-self:flex-start;margin-top:8px;padding:6px 10px;border-radius:6px;background:#065fd4;color:#fff;font-weight:600}
	@media (max-width:420px){.container{margin:24px auto}.icon{width:48px;height:48px}}
</style>