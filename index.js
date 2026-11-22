/**
 * MÉMÉ OS v0.7.0
 * Uses the proven legacy installation identity that previously hosted RiverPhone.
 * No legacy runtime names or features are retained.
 */
const MEME_BOOT_ID = 'meme-os-legacy-slot-test';

function activate() {
  if (document.getElementById(MEME_BOOT_ID)) return;
  const button = document.createElement('button');
  button.id = MEME_BOOT_ID;
  button.type = 'button';
  button.textContent = 'MÉ TEST';
  button.title = 'MÉMÉ OS v0.7.0';
  Object.assign(button.style, {
    position:'fixed', right:'14px', bottom:'86px', zIndex:'2147483647',
    display:'block', visibility:'visible', opacity:'1',
    width:'72px', height:'44px', margin:'0', padding:'0',
    borderRadius:'22px', border:'2px solid #6d4b75',
    background:'#f7eefb', color:'#4d3156', fontWeight:'800',
    fontSize:'13px', boxShadow:'0 4px 18px rgba(0,0,0,.25)', cursor:'pointer'
  });
  button.addEventListener('click', () => {
    if (globalThis.toastr?.success) globalThis.toastr.success('MÉMÉ OS v0.7.0 已成功运行。');
    else alert('MÉMÉ OS v0.7.0 已成功运行。');
  });
  document.body.appendChild(button);
  console.info('[MÉMÉ OS] v0.7.0 loaded from proven legacy installation slot');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', activate, { once:true });
} else {
  queueMicrotask(activate);
}
