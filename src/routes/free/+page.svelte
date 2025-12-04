<script lang="ts">
  // Free Mode UI: user types or inputs text into a textarea using the chosen input method.
  // This is UI-only and uses dummy behavior for morse buffer updates.

  import MorseInput from '../MorseInput.svelte';

  let content: string = $state('');

  let morseInput: MorseInput;

	function letterInput(char: string) {
		if (char === '=') {
			while (content.endsWith('␣')) {
				content = content.slice(0, -1);
			}
			content = content.slice(0, -1);
			while (content.endsWith('␣')) {
				content = content.slice(0, -1);
			}
			return;
		}

		if (char === ';') {
			char = '\n';
		}

		if (char === ' ') {
			char = '␣';
		}

		content += char;
	}

	let morseOn: boolean = $state(false);
	function morseOnCallback() {
		morseOn = true;
	}

	function morseOffCallback() {
		morseOn = false;
	}

  function clear() {
    content = '';
  }

  function handleKey(e: KeyboardEvent) {
    if (e.repeat) return;

    // ignore modifier-only keys
    if ((e as any).ctrlKey || (e as any).altKey || (e as any).metaKey) return;
    const key = (e as KeyboardEvent).key;

    if (key.length == 1) {
      morseInput.callMorseInput(key, e.type === 'keydown');
    }
  }

</script>

<svelte:window onkeydown={handleKey} onkeyup={handleKey} />

<main class="mode" class:morse-on={morseOn}>
  <a class="back" href="/">← Back</a>

  <section class="center">
    <h1>Free Mode</h1>
    <p class="hint">Type any text into the box below. Choose an input method (UI placeholder) and adjust WPM (dummy).</p>

    <div class="controls">
      <button onclick={clear} aria-label="clear">Reset</button>
    </div>

    <MorseInput
      bind:this={morseInput}
      emitCallback={letterInput}
      morseOnCallback={morseOnCallback}
      morseOffCallback={morseOffCallback}
    ></MorseInput>

    <div class="editor">
      <textarea
        placeholder="..."
        bind:value={content}
        readonly
        onpaste={(e) => e.preventDefault()}
        onbeforeinput={(e) => e.preventDefault()}
        aria-label="Free text input (read-only)"
      ></textarea>
    </div>
  </section>
</main>

<style>
  .mode{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px}
  .back{position:absolute;left:18px;top:18px;color:#065fd4;text-decoration:none}
  .center{max-width:880px;text-align:center;margin-top:28px}
  h1{margin:0 0 6px}
  .hint{color:#666;margin:0 0 18px}

  .controls{margin-top:12px;display:flex;gap:8px;justify-content:center;align-items:center}
  .controls button{padding:6px 10px;border-radius:6px;border:1px solid #cfd9ea;background:#f8fbff;color:#065fd4;cursor:pointer}

  .editor{margin-top:14px}
  textarea{width:min(800px,100%);min-height:240px;padding:12px;border-radius:8px;border:1px solid rgba(10,20,30,0.06);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;font-size:2rem}
  .mode.morse-on{background:rgba(255, 180, 180, 0.356);transition:background .05s linear, .03s linear}
</style>

