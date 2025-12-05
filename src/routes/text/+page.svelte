<script lang="ts">
  // Simple, non-interactive UI for Text Mode using dummy data.
  // This intentionally avoids any platform APIs or the MorseInput component.

  import { wpmCalc } from '$lib/morse';
  import MorseInput from '../MorseInput.svelte';

  let morseInput: MorseInput;

  function handleKey(e: KeyboardEvent) {
    if (e.repeat) return;

    // ignore modifier-only keys
    if ((e as any).ctrlKey || (e as any).altKey || (e as any).metaKey) return;
    const key = (e as KeyboardEvent).key;

    if (key.length == 1) {
      morseInput.callMorseInput(key, e.type === 'keydown');
    }
  }

  let makeSound: boolean = $state(true);

  let morseOn: boolean = $state(false);
  let flash: boolean = $state(false);

  function morseOnCallback() {
    morseOn = true;
  }

  function morseOffCallback() {
    morseOn = false;
  }

  // Drag & drop state/handlers: log dropped file path(s)
  let dragging: boolean = $state(false);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragging = false;
  }

  // https://www.reddit.com/r/tauri/comments/1kswzv0/comment/mtp1q9p/
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const dt = e.dataTransfer;
    if (!dt) return;

    // get the file contents from the first dropped file
    if (dt.files.length > 0) {
      const file = dt.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          init(text);
        }
      };
      reader.readAsText(file);
    }
  }

  // Text-mode typing state
  let lines: string[] = $state([])
  let lineIndex: number = $state(0);
  let cursorIndex: number = $state(0); // number of characters correctly typed so far
  let wrongIndex: number = $state(-1);
  let wrongTimeout: number | undefined;

  function init(fromParagraph?: string) {
    if (fromParagraph !== undefined) {
      if (fromParagraph == '') {
        fromParagraph = 'roses are red\nviolets are blue\nmorse code is fun\nto practice with you';
      }
      lines = fromParagraph.split(/\r?\n/).map(line => line + '\n');
    }

    lineIndex = 0;
    cursorIndex = 0;
    wrongIndex = -1;
  }

  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  // initialize
  onMount(() => {
    // svelte:window handles the keydown listener; nothing else required here

    // invoke load_wordserver_from_path with no path to get default words then init with it
    invoke<string>('load_text_from_path', { path: null }).then((defaulttext) => {
      init(defaulttext);
    }).catch((err) => {
      // alert('Error loading default word list: ' + String(err) );
      init('');
    });
  });

  import { open } from '@tauri-apps/plugin-dialog';

  async function loadFile(): Promise<void> {
    try {
      // @ts-ignore: dynamic import - available in Tauri runtime
      const path: string | string[] | null = await open({
        multiple: false,
        directory: false,
      });
      if (path && typeof path === 'string') {
        const newText: string = await invoke<string>('load_text_from_path', { path });
        init(newText);
      }
    } catch (err) {
      alert('Error loading word file: ' + String(err) );
    }
  }


  function letterInput(char: string) {
    // Backspace handling
    if (char === '\b') {
      if (cursorIndex > 0) cursorIndex--;
      wrongIndex = -1;
      return;
    }

    if (char == ';') {
      char = '\n';
    }

    if (char === 'Enter') char = '\n';
    if (char.length !== 1) return;

    if (cursorIndex >= lines[lineIndex].length) {
      if (lineIndex < lines.length - 1) {
        lineIndex++;
        cursorIndex = 0;
      }  else {
        init(); // end of text reached, restart
        return;
      }
    }

    const expected = lines[lineIndex][cursorIndex].toLowerCase();
    if (char.toLowerCase() === expected) {
      cursorIndex++;
    } else {
      wrongIndex = cursorIndex;
      if (wrongTimeout) clearTimeout(wrongTimeout);
      wrongTimeout = window.setTimeout(() => { wrongIndex = -1; }, 180);
    }
  }

</script>

<svelte:window onkeydown={handleKey} onkeyup={handleKey} />

<main class="mode" ondragover={onDragOver} ondragenter={onDragEnter} ondragleave={onDragLeave} ondrop={handleDrop} class:dragging={dragging} class:morse-on={morseOn && flash}>

  <section class="center">
    <h1>Text Mode</h1>
    <p class="hint">Type from the paragraph below. This is a UI-only page using dummy data.</p>

    <div class="controls">
      <button class:active={makeSound} aria-pressed={makeSound} onclick={() => makeSound = !makeSound}>Sound</button>
      <button class:active={flash} aria-pressed={flash} onclick={() => flash = !flash}>Flash</button>
      <button onclick={loadFile} aria-label="Load a text file">Load</button>
      <button onclick={() => init()} aria-label="Reset paragraph">Reset</button>
    </div>

    <article class="text-para" aria-live="polite">
      {#each lines as line, li}
        <p>
          {#each Array.from(line) as ch, ci}
            <span
              class={ch === '\n' ? 'newline' : 'char'}
              class:correct={lineIndex > li || (lineIndex === li && ci < cursorIndex && wrongIndex === -1)}
              class:current={lineIndex === li && ci === cursorIndex}
              class:wrong={lineIndex === li && ci === wrongIndex}
            >{ch !== '\n' ? ch : '↵'}</span>
          {/each}
        </p>
      {/each}
    </article>

    <MorseInput
      bind:this={morseInput}
      makeSound={makeSound}
      emitCallback={letterInput}
      morseOnCallback={morseOnCallback}
      morseOffCallback={morseOffCallback}
    ></MorseInput>
  </section>
</main>

<style>
  .mode{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:28px}
  .center{max-width:880px;text-align:center;margin-top:28px}
  h1{margin:0 0 6px}
  .hint{color:#666;margin:0 0 18px}

  .text-para{margin-top:18px;text-align:left;background:#fff;padding:18px;border-radius:8px;border:1px solid rgba(10,20,30,0.04);box-shadow:0 6px 14px rgba(20,30,60,0.03);
    max-height:40vh;overflow:auto}
  .text-para p{margin:0 0 10px;line-height:1.6;color:#222;font-size:2rem;white-space:pre-wrap;word-break:break-word}
  .controls{margin-top:12px;display:flex;gap:8px;justify-content:center;align-items:center}
  .controls button{padding:2px 10px;border-radius:6px;border:1px solid #cfd9ea;background:#f8fbff;color:#065fd4;cursor:pointer}
  .controls button.active, .controls button[aria-pressed="true"]{background:#065fd4;color:#fff;border-color:#065fd4}
  /* render an inline newline marker span at end of each line so it's selectable */
  .newline{color:#8b949e;margin-left:6px;font-size:0.9em;opacity:0.95;user-select:text}
  /* render chars inline so text selection and drag feel continuous */
  .char{display:inline;padding:0 2px;transition:color .08s ease, background-color .12s ease;white-space:pre}
  .char.current{text-decoration:underline dotted rgba(0,0,0,0.12)}
  .char.correct{color:#117a12}
  .char.wrong{color:#a81b1b;background:rgba(168,27,27,0.04);animation:flicker .18s linear}

  @keyframes flicker{0%{background:rgba(168,27,27,0.04)}50%{background:rgba(168,27,27,0.08)}100%{background:rgba(168,27,27,0.04)}}

  /* visual state when a draggable file is over the page */
  .mode.dragging{outline:3px dashed rgba(6,95,212,0.9);background:rgba(6,95,212,0.03)}
  .mode.morse-on{background:rgba(255, 180, 180, 0.356);transition:background .05s linear, .03s linear}
</style>

