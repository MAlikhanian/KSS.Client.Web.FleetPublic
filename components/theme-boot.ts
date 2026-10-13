/** Where the visitor's explicit theme choice is kept (localStorage, never a cookie). */
export const THEME_KEY = 'fleet-theme';

/** Runs before first paint (inline in <head>) so a stored choice never flashes the other theme. */
export const THEME_BOOT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
