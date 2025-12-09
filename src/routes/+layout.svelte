<script lang="ts">
    import { DEFAULT_MORSE } from '$lib/morse';
    import './layout.css';
    import { page } from '$app/stores';
    import { resolve } from '$app/paths';
    let { children } = $props();
    let showHelp: boolean = $state(false);

    // prepare morse entries for a 3-column table
    const MORSE_ENTRIES: [string,string][] = Object.entries(DEFAULT_MORSE).sort((a,b) => a[0].localeCompare(b[0]));
    const COLS = 3;
    const ROWS = Math.ceil(MORSE_ENTRIES.length / COLS);

    function toggleHelp() {
        showHelp = !showHelp;
    }

    function isActive(path: string) {
        // strip resolved base prefix from the current pathname for comparisons
        const raw = $page?.url?.pathname ?? '/';
        const resolvedRoot = resolve('/') || '/';
        // normalize by removing trailing slash so comparisons are consistent
        const b = resolvedRoot.endsWith('/') ? resolvedRoot.slice(0, -1) : resolvedRoot;
        const p = b !== '' && raw.startsWith(b) ? raw.slice(b.length) || '/' : raw;
        if (path === '/') return p === '/';
        return p === path || p.startsWith(path + '/') || p.startsWith(path + '?') || p === path;
    }
</script>

<!-- top header with tabs -->
<header class="app-header">
    <div class="container">
        <a class="brand" href={resolve('/')}>MorsePractice</a>
        <nav class="tabs" aria-label="Primary">
            <a href={resolve('/')} class:active={isActive('/')} aria-current={isActive('/') ? 'page' : undefined}>Home</a>
            <a href={resolve('/word')} class:active={isActive('/word')} aria-current={isActive('/word') ? 'page' : undefined}>Word</a>
            <a href={resolve('/text')} class:active={isActive('/text')} aria-current={isActive('/text') ? 'page' : undefined}>Text</a>
            <a href={resolve('/free')} class:active={isActive('/free')} aria-current={isActive('/free') ? 'page' : undefined}>Free</a>
        </nav>
    </div>
</header>

{@render children()}

<!-- help button bottom-right -->
<button class="help-button" aria-label="Show Morse map" onclick={toggleHelp}>?
</button>

{#if showHelp}
    <div class="help-overlay" role="dialog" aria-modal="true" tabindex="0"
    onclick={(e) => { if (e.target === e.currentTarget) showHelp = false }}
    onkeydown={(e) => { if (e.key === 'Escape') showHelp = false }}>
        <div class="help-box">
            <header>
                <h3>Morse Map (DEFAULT_MORSE)</h3>
                <button class="close" aria-label="Close" onclick={toggleHelp}>✕</button>
            </header>
            <div class="help-body">
                <table class="morse-table" aria-label="Morse map">
                    <tbody>
                        {#each Array.from({ length: ROWS }) as _, r}
                            <tr>
                                {#each Array.from({ length: COLS }) as _, c}
                                    {@const idx = r + c * ROWS}
                                    <td>
                                        {#if idx < MORSE_ENTRIES.length}
                                            {@const pair = MORSE_ENTRIES[idx]}
                                            <span class="morse-key">{pair[0]}</span>
                                            <span class="morse-val">{pair[1]}</span>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
{/if}

<style>
    /* help button + overlay */
    .help-button{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background-color:#0000;border:5px solid #2863b0a8;color:#2f77d59a;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;box-shadow:0 6px 18px rgba(6,95,212,0.18)}
    .help-overlay{position:fixed;inset:0;background:rgba(10,10,12,0.45);display:flex;align-items:center;justify-content:center;z-index:60}
    .help-box{background:#fff;max-width:760px;width:min(92%,760px);max-height:80vh;border-radius:10px;box-shadow:0 18px 40px rgba(10,20,30,0.35);overflow:hidden;display:flex;flex-direction:column}
    .help-box header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(10,20,30,0.04)}
    .help-box .close{background:transparent;border:0;font-size:18px;cursor:pointer}
    .help-body{padding:12px 16px;overflow:auto;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace}
    .morse-table{width:100%;border-collapse:collapse}
    .morse-table td{vertical-align:top;padding:6px 12px;border-bottom:1px solid rgba(0,0,0,0.04)}
    .morse-key{display:inline-block;width:2.2rem;font-weight:700;margin-right:10px}
    .morse-val{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;color:#234}

    /* header/tabs */
    .app-header{background:#fff;border-bottom:1px solid rgba(10,20,30,0.03);box-shadow:0 2px 6px rgba(10,20,30,0.02)}
    .app-header .container{max-width:1100px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;gap:18px}
    .brand{font-weight:700;color:#065fd4;text-decoration:none;margin-right:12px}
    .tabs{display:flex;gap:8px;align-items:center}
    .tabs a{padding:8px 12px;border-radius:8px;color:#065fd4;text-decoration:none;border:1px solid transparent}
    .tabs a:hover{background:rgba(6,95,212,0.04)}
    .tabs a.active{background:#065fd4;color:#fff;border-color:#065fd4}
</style>